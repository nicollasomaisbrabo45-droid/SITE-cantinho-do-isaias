/* ═══════════════════════════════════════
   CHECKOUT — checkout.js
   Sistema de localização avançado,
   cálculo dinâmico de frete por Haversine,
   gerenciamento de endereços salvos,
   cupons de desconto e finalização do pedido.
═══════════════════════════════════════ */

// ─── CONSTANTES ───────────────────────────────────────────────
// Ponto de origem: Estrada São Pedro, 896, Vista Alegre, São Gonçalo, RJ
const STORE_LAT = -22.8141483;
const STORE_LNG = -42.9668196;
const STORE_ADDR = 'Estrada São Pedro, 896, Vista Alegre, São Gonçalo';
const MAX_SAVED_LOCATIONS = 3;

// Estado da sessão de checkout
let checkoutDeliveryFee = 0;
let checkoutDiscountPct = 0;
let checkoutCouponCode = '';
let checkoutSelectedLocation = null;
let orderCount = parseInt(localStorage.getItem('ciOrderCount') || '0');

// ─── CUPONS VÁLIDOS ───────────────────────────────────────────
// Formato: { CÓDIGO: porcentagem_de_desconto }
const VALID_COUPONS = {
  'ISAIAS10': 10,
  'LANCHE20': 20,
  'BEM_VINDO': 15,
  'PRIMEIRA': 25,
};

// ─── HAVERSINE: Calcula distância entre dois pontos (em km) ──
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Raio médio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── CÁLCULO DE FRETE ────────────────────────────────────────
function calcDeliveryFee(distKm) {
  if (distKm < 1)  return 2.00;
  if (distKm <= 2) return 5.00;
  if (distKm <= 5) return 7.00;
  if (distKm <= 8) return 10.00;
  return 12.00 + (distKm - 8) * 1.50;
}

// ─── CÁLCULO DO TEMPO DE BIKE ────────────────────────────────
function calcBikeTime(distKm) {
  const baseMinutes = (distKm / 15) * 60; // 15 km/h
  const trafficMargin = 3 + Math.round(Math.random() * 2); // 3 a 5 min
  return Math.ceil(baseMinutes) + trafficMargin;
}

// ─── RENDER DO PREVIEW DE LOGÍSTICA ─────────────────────────
function renderLogisticsPreview(distKm, neighborhood) {
  const fee = calcDeliveryFee(distKm);
  const bikeTime = calcBikeTime(distKm);
  checkoutDeliveryFee = fee;
  updateCheckoutTotals();

  const bairro = neighborhood || 'destino';
  const box = document.getElementById('checkoutLogisticsPreview');
  if (!box) return;
  box.innerHTML = `
    <div class="logistics-info-box">
      📍 O valor estimado para a entrega no <strong>${bairro}</strong> é de <strong>R$ ${fmtPrice(fee)}</strong>.
    </div>
  `;
}

// ─── GPS: USAR LOCALIZAÇÃO ATUAL ────────────────────────────
function useGPSCheckout() {
  if (!navigator.geolocation) {
    showToast('⚠️ GPS não disponível neste dispositivo');
    return;
  }

  const btn = document.getElementById('btnGPS');
  if (btn) {
    btn.classList.add('loading');
    btn.textContent = '📡 Detectando localização...';
  }
  showToast('📡 Detectando sua localização...');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const dist = haversineDistance(STORE_LAT, STORE_LNG, lat, lng);

      // Geocodificação reversa via OpenStreetMap Nominatim
      let street = 'Localização detectada via GPS';
      let neighborhood = '';
      let city = 'São Gonçalo';

      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        );
        if (resp.ok) {
          const data = await resp.json();
          const a = data.address || {};
          street = [a.road || a.highway || '', a.house_number || ''].filter(Boolean).join(', ') || street;
          neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || '';
          city = a.city || a.town || a.municipality || city;
        }
      } catch (_) { /* fallback silencioso */ }

      // Guarda coordenadas na sessão para usar ao salvar o endereço
      window._lastGPSLat = lat;
      window._lastGPSLng = lng;

      // Preenche o formulário
      setValue('checkoutStreet', street);
      setValue('checkoutNeighborhood', neighborhood);
      setValue('checkoutCity', city);
      setValue('checkoutNumber', '');
      setValue('checkoutComplement', '');

      renderLogisticsPreview(dist, neighborhood || city);
      showToast('✅ Localização detectada com sucesso!');

      if (btn) {
        btn.classList.remove('loading');
        btn.textContent = '📡 Usar Minha Localização Atual (GPS)';
      }
    },
    () => {
      showToast('❌ Não foi possível detectar a localização. Digite o endereço manualmente.');
      if (btn) {
        btn.classList.remove('loading');
        btn.textContent = '📡 Usar Minha Localização Atual (GPS)';
      }
    }
  );
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ─── CALCULAR FRETE PELO ENDEREÇO DIGITADO (via Nominatim) ──
async function calcDeliveryFromAddress() {
  const street = (document.getElementById('checkoutStreet')?.value || '').trim();
  const number = (document.getElementById('checkoutNumber')?.value || '').trim();
  const neighborhood = (document.getElementById('checkoutNeighborhood')?.value || '').trim();
  const city = (document.getElementById('checkoutCity')?.value || 'São Gonçalo').trim();

  if (!street) {
    document.getElementById('checkoutLogisticsPreview').innerHTML = '';
    checkoutDeliveryFee = 0;
    updateCheckoutTotals();
    return;
  }

  const query = encodeURIComponent(`${street} ${number}, ${neighborhood}, ${city}, RJ, Brasil`);
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=pt-BR`
    );
    if (!resp.ok) throw new Error('fail');
    const data = await resp.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const dist = haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
      renderLogisticsPreview(dist, neighborhood || city);
    } else {
      document.getElementById('checkoutLogisticsPreview').innerHTML =
        `<div class="logistics-info-box" style="border-left-color:#e74c3c">⚠️ Não foi possível calcular a taxa automaticamente para este endereço. A taxa será definida pelo entregador.</div>`;
      checkoutDeliveryFee = 5; // mínimo
      updateCheckoutTotals();
    }
  } catch (_) {
    checkoutDeliveryFee = 5;
    updateCheckoutTotals();
  }
}

// ─── ENDEREÇOS SALVOS ─────────────────────────────────────────

/** Busca endereços: Supabase (se logado) ou localStorage */
async function getSavedLocations() {
  if (supabase && currentUser) {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(r => ({
        _id: r.id,
        name: r.name,
        icon: r.icon,
        street: r.street,
        number: r.number || '',
        complement: r.complement || '',
        neighborhood: r.neighborhood || '',
        city: r.city,
        lat: r.lat,
        lng: r.lng,
      }));
    } catch (e) {
      console.warn('Falha ao buscar endereços no Supabase, usando localStorage:', e);
    }
  }
  // fallback local
  try { return JSON.parse(localStorage.getItem('ciSavedLocations') || '[]'); } catch { return []; }
}

/** Salva no localStorage (usado apenas no fallback) */
function _setLocalLocations(locs) {
  localStorage.setItem('ciSavedLocations', JSON.stringify(locs));
}

async function renderSavedLocations() {
  const grid = document.getElementById('savedLocationsGrid');
  if (!grid) return;

  grid.innerHTML = `<p style="font-size:0.82rem;color:var(--ash-light);font-style:italic;">Carregando...</p>`;
  const locs = await getSavedLocations();

  if (locs.length === 0) {
    grid.innerHTML = `<p style="font-size:0.82rem;color:var(--ash-light);font-style:italic;">Nenhum endereço salvo ainda. Adicione um abaixo!</p>`;
    return;
  }

  grid.innerHTML = locs.map((loc, idx) => `
    <div class="loc-card${checkoutSelectedLocation && (checkoutSelectedLocation._id === loc._id || checkoutSelectedLocation._idx === idx) ? ' active' : ''}"
         onclick="selectSavedLocation(${idx})">
      <span class="loc-card-badge">✓</span>
      <div class="loc-card-name">${loc.icon || '📍'} ${loc.name}</div>
      <div class="loc-card-addr">${loc.street}${loc.number ? ', ' + loc.number : ''}${loc.neighborhood ? ' - ' + loc.neighborhood : ''}</div>
      <div class="loc-card-actions">
        <button class="loc-card-map-btn" onclick="event.stopPropagation(); openDeliveryMap(${idx})" title="Ver rota no mapa">🗺️ Ver Rota</button>
        <button class="loc-card-remove-btn" onclick="removeSavedLocation(event, ${idx}, ${loc._id ? `'${loc._id}'` : 'null'})">🗑 Remover</button>
      </div>
    </div>
  `).join('');

  // Guarda a lista em cache para selectSavedLocation
  window._cachedLocations = locs;
}

async function selectSavedLocation(idx) {
  const locs = window._cachedLocations || await getSavedLocations();
  const loc = locs[idx];
  if (!loc) return;

  checkoutSelectedLocation = { ...loc, _idx: idx };

  setValue('checkoutStreet', loc.street || '');
  setValue('checkoutNumber', loc.number || '');
  setValue('checkoutComplement', loc.complement || '');
  setValue('checkoutNeighborhood', loc.neighborhood || '');
  setValue('checkoutCity', loc.city || 'São Gonçalo');

  renderSavedLocations();

  // Se tiver coordenadas do GPS, usa Haversine direto
  if (loc.lat && loc.lng) {
    const dist = haversineDistance(STORE_LAT, STORE_LNG, loc.lat, loc.lng);
    renderLogisticsPreview(dist, loc.neighborhood || loc.city);
  } else {
    calcDeliveryFromAddress();
  }
  showToast(`📍 Usando "${loc.name}"`);
}

async function saveCurrentLocation() {
  const name        = (document.getElementById('checkoutAddressName')?.value || '').trim();
  const street      = (document.getElementById('checkoutStreet')?.value || '').trim();
  const number      = (document.getElementById('checkoutNumber')?.value || '').trim();
  const complement  = (document.getElementById('checkoutComplement')?.value || '').trim();
  const neighborhood= (document.getElementById('checkoutNeighborhood')?.value || '').trim();
  const city        = (document.getElementById('checkoutCity')?.value || 'São Gonçalo').trim();

  if (!street) { showToast('⚠️ Informe pelo menos a rua do endereço'); return; }

  const locs = await getSavedLocations();
  if (locs.length >= MAX_SAVED_LOCATIONS) {
    showToast(`⚠️ Limite de ${MAX_SAVED_LOCATIONS} endereços atingido. Remova um antes.`);
    return;
  }

  const icons = ['🏠', '💼', '⭐', '📍'];
  const icon = icons[locs.length] || '📍';
  const locName = name || `Endereço ${locs.length + 1}`;

  // Captura coordenadas GPS da sessão (se vieram do botão GPS)
  const gpsLat = window._lastGPSLat || null;
  const gpsLng = window._lastGPSLng || null;

  if (supabase && currentUser) {
    try {
      const { data, error } = await supabase.from('user_locations').insert([{
        user_id: currentUser.id,
        name: locName, icon, street, number, complement, neighborhood, city,
        lat: gpsLat,
        lng: gpsLng,
      }]).select().single();
      if (error) throw error;
      checkoutSelectedLocation = { ...data, _id: data.id, _idx: locs.length };
      showToast(`✅ Endereço "${locName}" salvo na sua conta!`);
    } catch (e) {
      console.error('Erro ao salvar endereço no Supabase:', e);
      showToast('❌ Erro ao salvar. Tente novamente.');
      return;
    }
  } else {
    // fallback local
    const newLoc = { name: locName, icon, street, number, complement, neighborhood, city, lat: gpsLat, lng: gpsLng };
    locs.push(newLoc);
    _setLocalLocations(locs);
    checkoutSelectedLocation = { ...newLoc, _idx: locs.length - 1 };
    showToast(`✅ Endereço "${locName}" salvo localmente.`);
  }

  // Limpa GPS da sessão após salvar
  window._lastGPSLat = null;
  window._lastGPSLng = null;

  await renderSavedLocations();
  await calcDeliveryFromAddress();
  setValue('checkoutAddressName', '');
}

async function removeSavedLocation(event, idx, supabaseId) {
  event.stopPropagation();
  const locs = window._cachedLocations || await getSavedLocations();
  const removed = locs[idx];
  if (!removed) return;

  if (supabase && currentUser && supabaseId) {
    try {
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('id', supabaseId)
        .eq('user_id', currentUser.id);
      if (error) throw error;
    } catch (e) {
      console.error('Erro ao remover endereço:', e);
      showToast('❌ Erro ao remover. Tente novamente.');
      return;
    }
  } else {
    const localLocs = JSON.parse(localStorage.getItem('ciSavedLocations') || '[]');
    localLocs.splice(idx, 1);
    _setLocalLocations(localLocs);
  }

  if (checkoutSelectedLocation && (checkoutSelectedLocation._id === supabaseId || checkoutSelectedLocation._idx === idx)) {
    checkoutSelectedLocation = null;
    checkoutDeliveryFee = 0;
    updateCheckoutTotals();
    const prev = document.getElementById('checkoutLogisticsPreview');
    if (prev) prev.innerHTML = '';
  }

  await renderSavedLocations();
  showToast(`🗑 "${removed.name}" removido`);
}


// ─── CUPOM DE DESCONTO ────────────────────────────────────────
function applyCoupon() {
  const code = (document.getElementById('couponCode')?.value || '').trim().toUpperCase();
  const feedback = document.getElementById('couponFeedback');

  if (!code) {
    if (feedback) { feedback.textContent = '⚠️ Digite um código de cupom.'; feedback.className = 'coupon-feedback error'; }
    return;
  }

  const pct = VALID_COUPONS[code];
  if (!pct) {
    checkoutDiscountPct = 0;
    checkoutCouponCode = '';
    if (feedback) { feedback.textContent = '❌ Cupom inválido ou expirado.'; feedback.className = 'coupon-feedback error'; }
    updateCheckoutTotals();
    return;
  }

  checkoutDiscountPct = pct;
  checkoutCouponCode = code;
  if (feedback) { feedback.textContent = `✅ Cupom "${code}" aplicado! ${pct}% de desconto.`; feedback.className = 'coupon-feedback success'; }
  updateCheckoutTotals();
  showToast(`🏷️ Cupom ${code} (${pct}%) aplicado!`);
}

// ─── ATUALIZAR TOTAIS DO CHECKOUT ────────────────────────────
function updateCheckoutTotals() {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const fee = checkoutDeliveryFee;
  const discountAmt = checkoutDiscountPct > 0 ? subtotal * (checkoutDiscountPct / 100) : 0;
  const total = subtotal + fee - discountAmt;

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setText('checkoutSubtotal', `R$ ${fmtPrice(subtotal)}`);
  setText('checkoutDeliveryFee', fee > 0 ? `R$ ${fmtPrice(fee)}` : 'Calculando...');
  setText('checkoutTotal', `R$ ${fmtPrice(Math.max(0, total))}`);

  const discRow = document.getElementById('checkoutDiscountRow');
  if (discRow) discRow.style.display = checkoutDiscountPct > 0 ? 'flex' : 'none';
  setText('checkoutDiscountLabel', `Desconto (${checkoutDiscountPct}%)`);
  setText('checkoutDiscountValue', `- R$ ${fmtPrice(discountAmt)}`);

  // Também atualiza o sidebar do carrinho
  const cartSubEl = document.getElementById('cartSubtotal');
  if (cartSubEl) cartSubEl.textContent = `R$ ${fmtPrice(subtotal)}`;
  const cartTotalEl = document.getElementById('cartTotal');
  if (cartTotalEl) cartTotalEl.textContent = `R$ ${fmtPrice(subtotal)}`;
}

// ─── RENDERIZAR ITENS NA PÁGINA DE CHECKOUT ─────────────────
async function renderCheckoutPage() {
  const list = document.getElementById('checkoutItemsList');
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = `<p style="font-size:0.85rem;color:var(--ash);text-align:center;padding:1rem 0;">Nenhum item no carrinho.</p>`;
  } else {
    list.innerHTML = cart.map(item => `
      <div class="summary-item-row">
        <span class="summary-item-qty">${item.qty}×</span>
        <span class="summary-item-name">${item.name}</span>
        <span class="summary-item-price">R$ ${fmtPrice(item.price * item.qty)}</span>
      </div>
    `).join('');
  }

  await renderSavedLocations();
  updateCheckoutTotals();
}

// ─── FINALIZAR PEDIDO ─────────────────────────────────────────
async function submitCheckoutOrder() {
  if (cart.length === 0) { showToast('⚠️ Adicione itens ao carrinho antes de finalizar.'); return; }

  if (typeof isStoreOpen !== 'undefined' && !isStoreOpen) {
    showToast('🔴 A loja está fechada no momento.');
    return;
  }

  const street = (document.getElementById('checkoutStreet')?.value || '').trim();
  if (!street) {
    showToast('📍 Informe seu endereço de entrega antes de finalizar!');
    return;
  }

  const btn = document.getElementById('checkoutConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmt = checkoutDiscountPct > 0 ? subtotal * (checkoutDiscountPct / 100) : 0;
  const total = Math.max(0, subtotal + checkoutDeliveryFee - discountAmt);

  const address = {
    street: street,
    number: document.getElementById('checkoutNumber')?.value || '',
    complement: document.getElementById('checkoutComplement')?.value || '',
    neighborhood: document.getElementById('checkoutNeighborhood')?.value || '',
    city: document.getElementById('checkoutCity')?.value || 'São Gonçalo',
  };

  const orderData = {
    total,
    delivery_fee: checkoutDeliveryFee,
    discount_amount: discountAmt,
    coupon_code: checkoutCouponCode || null,
    delivery_type: 'entrega',
    address,
    status: 'preparando',
  };
  if (currentUser && currentUser.id) orderData.user_id = currentUser.id;

  try {
    let orderNumToDisplay = null;

    if (supabase) {
      const { data: orderResponse, error: orderError } = await supabase
        .from('orders').insert([orderData]).select().single();
      if (orderError) throw orderError;

      orderNumToDisplay = String(orderResponse.id).padStart(4, '0');

      const itemsToInsert = cart.map(item => ({
        order_id: orderResponse.id,
        menu_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

    } else {
      orderCount++;
      localStorage.setItem('ciOrderCount', orderCount);
      orderNumToDisplay = String(orderCount).padStart(4, '0');
      const localOrder = {
        num: orderNumToDisplay,
        date: new Date().toLocaleString('pt-BR'),
        items: cart.map(c => ({ name: c.name, qty: c.qty })),
        total: fmtPrice(total),
        address,
      };
      const orders = JSON.parse(localStorage.getItem('ciOrders') || '[]');
      orders.push(localOrder);
      localStorage.setItem('ciOrders', JSON.stringify(orders));
    }

    // Exibe modal de sucesso
    document.getElementById('orderNum').textContent = '#' + orderNumToDisplay;
    document.getElementById('orderTotalDisplay').textContent = 'R$ ' + fmtPrice(total);
    generateQR(orderNumToDisplay, total);
    openModal('successModal');

    // Reseta o estado
    cart = [];
    checkoutDeliveryFee = 0;
    checkoutDiscountPct = 0;
    checkoutCouponCode = '';
    checkoutSelectedLocation = null;
    updateCartUI();
    updateCheckoutTotals();
    document.getElementById('checkoutItemsList').innerHTML = '';
    document.getElementById('checkoutLogisticsPreview').innerHTML = '';
    if (document.getElementById('couponFeedback')) {
      document.getElementById('couponFeedback').textContent = '';
      document.getElementById('couponCode').value = '';
    }
    renderMenu(globalMenu);

  } catch (error) {
    console.error('Erro ao finalizar pedido:', error);
    showToast('❌ Erro ao processar pedido. Tente novamente.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar e Enviar Pedido →'; }
  }
}

// ─── QR CODE ─────────────────────────────────────────────────
function generateQR(orderNum, total) {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 145;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, W);

  const seed = orderNum.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(total * 100);
  const modules = 13;
  const cell = Math.floor((W - 20) / modules);
  const offset = 10;

  ctx.fillStyle = '#1A0F05';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if ((r < 4 && c < 4) || (r < 4 && c > 8) || (r > 8 && c < 4)) continue;
      const v = (seed * (r * 17 + c * 13) * 7) % 3;
      if (v === 0) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
    }
  }
  [[0,0],[9,0],[0,9]].forEach(([cx, cy]) => {
    ctx.strokeStyle = '#1A0F05'; ctx.lineWidth = 1.5;
    ctx.strokeRect(offset + cx * cell, offset + cy * cell, 3.5 * cell, 3.5 * cell);
    ctx.fillStyle = '#1A0F05';
    ctx.fillRect(offset + (cx + 1) * cell, offset + (cy + 1) * cell, 1.5 * cell, 1.5 * cell);
  });
  ctx.fillStyle = '#FF2D00';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CANTINHO DO ISAIAS', W / 2, W - 3);
}

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

let checkoutCurrentStep = 'location'; // 'location', 'payment', 'pix'
let checkoutSelectedPayment = null;

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
  if (distKm <= 0.5) return 2.00;
  if (distKm <= 1.0) return 4.00;
  if (distKm <= 1.5) return 5.00;
  if (distKm <= 2.0) return 6.00;
  if (distKm <= 2.5) return 7.50;
  if (distKm <= 3.0) return 9.00;
  return -1; // -1 indicates out of range
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
  const box = document.getElementById('checkoutLogisticsPreview');
  const btn = document.getElementById('checkoutConfirmBtn');

  if (fee === -1) {
    checkoutDeliveryFee = 0;
    updateCheckoutTotals();
    if (box) {
      box.innerHTML = `
        <div class="logistics-info-box" style="border-left-color: #e74c3c; background: rgba(231,76,60,0.08);">
          ❌ <strong>Infelizmente este endereço está fora do nosso raio de entrega de 3km.</strong><br>
          <span style="font-size: 0.8rem;">(Distância detectada: ${distKm.toFixed(1)} km)</span>
        </div>
      `;
    }
    if (btn) btn.disabled = true;
    return;
  }

  const bikeTime = calcBikeTime(distKm);
  checkoutDeliveryFee = fee;
  updateCheckoutTotals();
  if (btn) btn.disabled = false;

  const bairro = neighborhood || 'destino';
  if (!box) return;
  box.innerHTML = `
    <div class="logistics-info-box">
      📍 O valor estimado para a entrega no <strong>${bairro}</strong> é de <strong>R$ ${fmtPrice(fee)}</strong>.<br>
      <span style="font-size: 0.8rem; color: var(--ash);">Distância real: ${distKm.toFixed(1)} km (Até ${bikeTime} min de 🚲)</span>
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

      if (btn) {
        btn.classList.remove('loading');
        btn.textContent = '📡 Usar Minha Localização Atual (GPS)';
      }
      
      if (typeof openLocationPicker === 'function') {
        openLocationPicker(lat, lng);
      } else {
        showToast('❌ Erro: Módulo de mapa não carregado.');
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
  let saveLat = window._lastGPSLat || null;
  let saveLng = window._lastGPSLng || null;

  // Se não tem GPS, verifica o endereço manualmente antes de permitir salvar
  if (!saveLat || !saveLng) {
    const query = encodeURIComponent(`${street} ${number}, ${neighborhood}, ${city}, RJ, Brasil`);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=pt-BR`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          saveLat = parseFloat(data[0].lat);
          saveLng = parseFloat(data[0].lon);
        }
      }
    } catch (_) {}

    if (!saveLat || !saveLng) {
      showToast('❌ Endereço não reconhecido. Verifique os dados para poder salvar.');
      return;
    }
  }

  if (supabase && currentUser) {
    try {
      const { data, error } = await supabase.from('user_locations').insert([{
        user_id: currentUser.id,
        name: locName, icon, street, number, complement, neighborhood, city,
        lat: saveLat,
        lng: saveLng,
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
    const newLoc = { name: locName, icon, street, number, complement, neighborhood, city, lat: saveLat, lng: saveLng };
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

// ─── FLUXO DE CHECKOUT (MULTI-STEP) ───────────────────────────

function handleCheckoutNextStep() {
  if (cart.length === 0) { showToast('⚠️ Adicione itens ao carrinho antes de finalizar.'); return; }

  if (checkoutCurrentStep === 'location') {
    const street = (document.getElementById('checkoutStreet')?.value || '').trim();
    if (!street) {
      showToast('📍 Informe seu endereço de entrega antes de continuar!');
      return;
    }
    // Vai para pagamento
    checkoutCurrentStep = 'payment';
    document.getElementById('checkoutStepLocation').style.display = 'none';
    document.getElementById('checkoutStepPayment').style.display = 'block';
    
    document.getElementById('checkoutNextBtn').textContent = 'Confirmar Pedido →';
    document.getElementById('checkoutBackBtn').textContent = '← Voltar para Localização';
    return;
  }

  if (checkoutCurrentStep === 'payment') {
    if (!checkoutSelectedPayment) {
      showToast('💳 Selecione uma forma de pagamento!');
      return;
    }

    if (checkoutSelectedPayment === 'pix_antecipado') {
      // Vai para a tela do Pix
      checkoutCurrentStep = 'pix';
      document.getElementById('checkoutStepPayment').style.display = 'none';
      document.getElementById('checkoutStepPix').style.display = 'block';
      
      const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
      const discountAmt = checkoutDiscountPct > 0 ? subtotal * (checkoutDiscountPct / 100) : 0;
      const total = Math.max(0, subtotal + checkoutDeliveryFee - discountAmt);
      
      document.getElementById('pixValorDisplay').textContent = `R$ ${fmtPrice(total)}`;
      
      document.getElementById('checkoutNextBtn').style.display = 'none';
      document.getElementById('checkoutBackBtn').textContent = '← Voltar para Pagamento';
      return;
    }

    // Se for pagamento na entrega, finaliza o pedido direto
    criarPedido();
  }
}

function handleCheckoutBackStep() {
  if (checkoutCurrentStep === 'pix') {
    checkoutCurrentStep = 'payment';
    document.getElementById('checkoutStepPix').style.display = 'none';
    document.getElementById('checkoutStepPayment').style.display = 'block';
    
    document.getElementById('checkoutNextBtn').style.display = 'block';
    document.getElementById('checkoutNextBtn').textContent = 'Confirmar Pedido →';
    document.getElementById('checkoutBackBtn').textContent = '← Voltar para Localização';
    return;
  }

  if (checkoutCurrentStep === 'payment') {
    checkoutCurrentStep = 'location';
    document.getElementById('checkoutStepPayment').style.display = 'none';
    document.getElementById('checkoutStepLocation').style.display = 'block';
    
    document.getElementById('checkoutNextBtn').textContent = 'Continuar para Pagamento →';
    document.getElementById('checkoutBackBtn').textContent = '← Voltar para o Cardápio';
    return;
  }

  if (checkoutCurrentStep === 'location') {
    switchTab('cardapio');
  }
}

function selectPaymentMethod(method) {
  checkoutSelectedPayment = method;
  const warning = document.getElementById('paymentMachineWarning');
  if (method === 'credito_entrega' || method === 'debito_entrega') {
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
  }
}

function copyPixCode() {
  const input = document.getElementById('pixCopiaCola');
  input.select();
  input.setSelectionRange(0, 99999); 
  navigator.clipboard.writeText(input.value)
    .then(() => showToast('📋 Código copiado!'))
    .catch(() => showToast('❌ Erro ao copiar.'));
}

function simularPagamentoPix() {
  const overlay = document.getElementById('pixStatusOverlay');
  overlay.style.display = 'flex';
  
  setTimeout(() => {
    criarPedido();
  }, 1500);
}

// ─── FINALIZAR PEDIDO (SUPABASE + WHATSAPP) ───────────────────
async function criarPedido() {
  const btn = document.getElementById('checkoutNextBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmt = checkoutDiscountPct > 0 ? subtotal * (checkoutDiscountPct / 100) : 0;
  const total = Math.max(0, subtotal + checkoutDeliveryFee - discountAmt);

  const address = {
    street: document.getElementById('checkoutStreet')?.value || '',
    number: document.getElementById('checkoutNumber')?.value || '',
    complement: document.getElementById('checkoutComplement')?.value || '',
    neighborhood: document.getElementById('checkoutNeighborhood')?.value || '',
    city: document.getElementById('checkoutCity')?.value || 'São Gonçalo',
  };

  const orderData = {
    total_amount: total,
    delivery_fee: checkoutDeliveryFee,
    customer_name: (currentUser && currentUser.user_metadata?.name) || 'Cliente',
    address_street: address.street,
    address_number: address.number,
    address_neighborhood: address.neighborhood,
    address_complement: address.complement,
    payment_method: checkoutSelectedPayment,
    status: 'recebido',
    status_pagamento: checkoutSelectedPayment === 'pix_antecipado' ? 'pago' : 'pendente',
    is_delivery: true
  };

  if (currentUser && currentUser.id) orderData.user_id = currentUser.id;

  try {
    let orderId = null;
    let orderNum = '';

    if (supabase) {
      const { data: orderResponse, error: orderError } = await supabase
        .from('orders').insert([orderData]).select().single();
      if (orderError) throw orderError;

      orderId = orderResponse.id;
      // Pega os primeiros 4 caracteres do UUID para exibir como número curto (exemplo simplificado)
      orderNum = String(orderResponse.id).substring(0, 4).toUpperCase();

      const itemsToInsert = cart.map(item => ({
        order_id: orderResponse.id,
        item_id: item.id,
        item_name: item.name,
        unit_price: item.price,
        quantity: item.qty,
        total_price: item.price * item.qty
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

    } else {
      // Fallback Local
      orderId = 'local-' + Date.now();
      orderCount++;
      localStorage.setItem('ciOrderCount', orderCount);
      orderNum = String(orderCount).padStart(4, '0');
    }

    // ─── GERAR MENSAGEM DO WHATSAPP ───
    let textoPagamento = '';
    if (checkoutSelectedPayment === 'pix_antecipado') textoPagamento = "Pagamento via Pix (JÁ PAGO ✅)";
    else if (checkoutSelectedPayment === 'pix_entrega') textoPagamento = "Pagamento em Pix na entrega";
    else if (checkoutSelectedPayment === 'credito_entrega') textoPagamento = "Pagamento em Cartão de Crédito na entrega";
    else if (checkoutSelectedPayment === 'debito_entrega') textoPagamento = "Pagamento em Cartão de Débito na entrega";

    const fTempo = calcBikeTime(checkoutDeliveryFee > 2 ? checkoutDeliveryFee * 1.5 : 2); // mockup estimativa
    const hAgora = new Date();
    const hFim = new Date(hAgora.getTime() + fTempo * 60000);
    const formatoHora = (d) => d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    let wappMsg = `✅ *NOVO PEDIDO*\n-----------------------------\n▶️ *RESUMO DO PEDIDO*\n\nPedido #${orderNum}\n\n`;

    cart.forEach(item => {
      wappMsg += `*${item.qty}x* _${item.name}_\n`;
      // Observações podem ser inseridas se tivéssemos no cart
      wappMsg += `*Subtotal do item: R$ ${fmtPrice(item.price * item.qty)}*\n`;
      wappMsg += ` -  -  -  -  -  -  -  -  -  -  -\n`;
    });

    wappMsg += `\n*SUBTOTAL:* R$ ${fmtPrice(subtotal)}\n`;
    wappMsg += `------------------------------------------\n▶️ *Dados para entrega*\n\n`;
    wappMsg += `*Nome:* ${orderData.customer_name}\n`;
    wappMsg += `*Endereço:* ${address.street}, ${address.number}\n`;
    wappMsg += `*Bairro:* ${address.neighborhood}\n`;
    if (address.complement) wappMsg += `*Complemento:* ${address.complement}\n`;
    wappMsg += `\n*Taxa de Entrega:* R$ ${fmtPrice(checkoutDeliveryFee)}\n`;
    wappMsg += `🕙 *Tempo de Entrega:* aprox. ${formatoHora(hAgora)} a ${formatoHora(hFim)}\n`;
    wappMsg += `-------------------------------\n▶️ *TOTAL* = *R$ ${fmtPrice(total)}*\n------------------------------\n`;
    wappMsg += `▶️ *PAGAMENTO*\n\n${textoPagamento}\n`;

    // Reseta carrinho e UI
    cart = [];
    updateCartUI();
    
    // Abre WhatsApp
    const foneLoja = "5521966089311"; // Número oficial
    const wpLink = `https://wa.me/${foneLoja}?text=${encodeURIComponent(wappMsg)}`;
    window.open(wpLink, '_blank');

    // Redireciona para acompanhamento
    window.location.href = `pedido.html?id=${orderId}`;

  } catch (error) {
    console.error('Erro ao finalizar pedido:', error);
    showToast('❌ Erro ao processar pedido. Tente novamente.');
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar Pedido →'; }
  }
}

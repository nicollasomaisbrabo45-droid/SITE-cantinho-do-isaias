/* ═══════════════════════════════════════
   CHECKOUT E ENDEREÇO — checkout.js
   Lógica de GPS, cálculo de frete e
   salvamento de pedidos no Supabase.
═══════════════════════════════════════ */

let locationData = null;
let deliveryFee = 0;
let orderCount = parseInt(localStorage.getItem('ciOrderCount') || '0');

function openLocationModal() { 
  openModal('locationModal'); 
}

function useGPS() {
  if (!navigator.geolocation) { 
    showToast('⚠️ GPS não disponível neste dispositivo'); 
    return; 
  }
  
  showToast('📡 Detectando sua localização...');
  navigator.geolocation.getCurrentPosition(
    () => {
      const dist = (Math.random() * 6 + 1).toFixed(1);
      document.getElementById('addressDist').value = dist;
      document.getElementById('addressStreet').value = 'Localização detectada via GPS';
      document.getElementById('addressCity').value = 'São Gonçalo';
      calcDelivery();
      
      const gpsBtn = document.getElementById('gpsOption');
      if (gpsBtn) gpsBtn.classList.add('selected');
      
      showToast('✅ Localização detectada!');
    },
    () => showToast('❌ Não foi possível detectar. Digite o endereço.')
  );
}

function calcDelivery() {
  const dist = parseFloat(document.getElementById('addressDist').value) || 0;
  deliveryFee = dist <= 2 ? 5 : dist <= 5 ? 8 : dist <= 10 ? 12 : 18;
  
  const prev = document.getElementById('deliveryFeePreview');
  if (!prev) return;

  if (dist > 0) {
    prev.innerHTML = `<div class="delivery-fee-info">🛵 Taxa estimada: <strong>R$ ${fmtPrice(deliveryFee)}</strong> (${dist} km)</div>`;
  } else {
    prev.innerHTML = '';
  }
}

function confirmLocation() {
  const street = document.getElementById('addressStreet').value.trim();
  const city = document.getElementById('addressCity').value.trim();
  
  if (!street) { showToast('⚠️ Digite o endereço'); return; }
  
  locationData = { street, city };
  calcDelivery();
  
  const lp = document.getElementById('locationPicker');
  if (lp) lp.classList.add('set');
  
  document.getElementById('locationText').textContent = `${street}${city ? ', ' + city : ''}`;
  document.getElementById('deliveryRow').style.display = 'flex';
  document.getElementById('cartDelivery').textContent = `R$ ${fmtPrice(deliveryFee)}`;
  
  updateCartUI();
  closeModal('locationModal');
  showToast('📍 Endereço confirmado!');
}

async function checkout() {
  if (cart.length === 0) return;

  if (typeof isStoreOpen !== 'undefined' && !isStoreOpen) {
    showToast('🔴 A loja está fechada no momento. Não é possível realizar novos pedidos.');
    return;
  }
  
  if (!locationData) { 
    openLocationModal(); 
    showToast('📍 Informe seu endereço primeiro!'); 
    return; 
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const total = subtotal + deliveryFee;

  document.getElementById('checkoutBtn').disabled = true;
  document.getElementById('checkoutBtn').textContent = 'Processando...';

  // 1. Prepara dados do pedido
  const orderData = {
    total: total,
    delivery_fee: deliveryFee,
    delivery_type: 'entrega',
    address: locationData,
    status: 'preparando'
  };

  if (currentUser && currentUser.id) {
    orderData.user_id = currentUser.id;
  }

  try {
    let orderIdToSave = null;
    let orderNumToDisplay = null;

    if (supabase) {
      // ─── SALVAR NO SUPABASE ───
      const { data: orderResponse, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();
        
      if (orderError) throw orderError;
      
      orderIdToSave = orderResponse.id;
      orderNumToDisplay = String(orderResponse.id).padStart(4, '0');

      // ─── SALVAR ITENS ───
      const itemsToInsert = cart.map(item => ({
        order_id: orderIdToSave,
        menu_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

    } else {
      // ─── FALLBACK LOCAL ───
      orderCount++;
      localStorage.setItem('ciOrderCount', orderCount);
      orderNumToDisplay = String(orderCount).padStart(4, '0');
      
      const localOrder = {
        num: orderNumToDisplay,
        date: new Date().toLocaleString('pt-BR'),
        items: cart.map(c => ({ name: c.name, qty: c.qty })),
        total: fmtPrice(total),
        address: locationData,
      };
      const orders = JSON.parse(localStorage.getItem('ciOrders') || '[]');
      orders.push(localOrder);
      localStorage.setItem('ciOrders', JSON.stringify(orders));
    }

    // ─── SUCESSO ───
    document.getElementById('orderNum').textContent = '#' + orderNumToDisplay;
    document.getElementById('orderTotalDisplay').textContent = 'R$ ' + fmtPrice(total);
    generateQR(orderNumToDisplay, total);

    // Limpar carrinho
    cart = [];
    deliveryFee = 0;
    locationData = null;
    updateCartUI();
    closeCart();
    renderMenu(globalMenu);

    const lp = document.getElementById('locationPicker');
    if (lp) lp.classList.remove('set');
    
    document.getElementById('locationText').textContent = 'Adicionar endereço de entrega';
    document.getElementById('deliveryRow').style.display = 'none';

    openModal('successModal');

  } catch (error) {
    console.error('Erro ao finalizar pedido:', error);
    showToast('❌ Erro ao processar pedido. Tente novamente.');
    document.getElementById('checkoutBtn').disabled = false;
    document.getElementById('checkoutBtn').textContent = `Finalizar (R$ ${fmtPrice(total)}) →`;
  }
}

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

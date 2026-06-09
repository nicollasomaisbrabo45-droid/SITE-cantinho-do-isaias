/* ═══════════════════════════════════════
   CART — cart.js
   Lógica do carrinho de compras.
═══════════════════════════════════════ */

let cart = [];

function addToCart(id) {
  const item = globalMenu.find(m => m.id === id);
  if (!item) return;

  const existing = cart.find(c => c.id === id);
  if (existing) existing.qty++;
  else cart.push({ ...item, qty: 1 });

  renderQtyControl(id, cart.find(c => c.id === id).qty);
  updateCartUI();
  showToast(`✅ ${item.name} adicionado!`);

  const btn = document.getElementById('cartBtn');
  if (btn) {
    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 500);
  }
}

function changeQty(id, delta) {
  const idx = cart.findIndex(c => c.id === id);
  if (idx === -1) return;

  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);

  renderQtyControl(id, cart.find(c => c.id === id)?.qty || 0);
  updateCartUI();
  renderCartItems();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderQtyControl(id, 0);
  updateCartUI();
  renderCartItems();
}

function updateCartUI() {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const count = cart.reduce((s, c) => s + c.qty, 0);
  
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.style.display = count > 0 ? 'flex' : 'none';
    badge.textContent = count > 99 ? '99+' : count;
  }
  
  const subEl = document.getElementById('cartSubtotal');
  if (subEl) subEl.textContent = `R$ ${fmtPrice(subtotal)}`;
  
  const grand = subtotal + deliveryFee;
  const totEl = document.getElementById('cartTotal');
  if (totEl) totEl.textContent = `R$ ${fmtPrice(grand)}`;
  
  const btn = document.getElementById('checkoutBtn');
  if (btn) {
    btn.disabled = cart.length === 0;
    btn.textContent = cart.length === 0
      ? 'Adicione itens →'
      : `Finalizar (R$ ${fmtPrice(grand)}) →`;
  }
}

function renderCartItems() {
  const c = document.getElementById('cartItems');
  if (!c) return;

  if (cart.length === 0) {
    c.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p><strong>Carrinho vazio</strong></p>
        <p>Adicione itens do cardápio!</p>
      </div>`;
    return;
  }

  c.innerHTML = cart.map(item => `
    <div class="cart-item fade-in">
      <div class="cart-item-icon">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">R$ ${fmtPrice(item.price * item.qty)} (${item.qty}x)</div>
      </div>
      <div class="qty-control" style="gap:6px">
        <button class="qty-btn" style="width:28px;height:28px;font-size:15px" onclick="changeQty(${item.id},-1)" aria-label="Diminuir">−</button>
        <span class="qty-num" style="font-size:0.9rem">${item.qty}</span>
        <button class="qty-btn" style="width:28px;height:28px;font-size:15px" onclick="changeQty(${item.id},1)" aria-label="Aumentar">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" aria-label="Remover ${item.name}">🗑️</button>
    </div>
  `).join('');
  
  updateCartUI();
}

function openCart() {
  renderCartItems();
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartSidebar').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartSidebar').classList.remove('open');
  document.body.style.overflow = '';
}

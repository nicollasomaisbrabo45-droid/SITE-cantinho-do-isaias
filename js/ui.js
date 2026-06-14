/* ═══════════════════════════════════════
   UI — ui.js
   Renderização do cardápio, promocoes,
   pedidos e avaliações.
═══════════════════════════════════════ */

function fmtPrice(n) {
  return n.toFixed(2).replace('.', ',');
}

function showToast(msg, duration = 3200) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  
  setTimeout(() => {
    t.style.animation = 'none';
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all 0.3s';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  const anyOpen = document.querySelector('.modal-overlay.open') || document.getElementById('cartSidebar').classList.contains('open');
  if (!anyOpen) document.body.style.overflow = '';
}

function toggleMobileNav() {
  const nav = document.getElementById('mobileNav');
  const btn = document.getElementById('hamburgerBtn');
  const isOpen = nav.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', isOpen);
}

function switchTab(tab, btn) {
  ['cardapio','promos','pedidos','sobre','pagamento'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = 'none';
  });
  
  const active = document.getElementById(`tab-${tab}`);
  if (active) active.style.display = 'block';

  document.querySelectorAll('.nav-tab, .mobile-nav-tab').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }

  // statusBar foi removido do HTML — linha mantida apenas como comentário
  // document.getElementById('statusBar').style.display = ...

  if (tab === 'promos') renderPromos();
  if (tab === 'pedidos') renderOrders();
  if (tab === 'sobre') {
    document.getElementById('reviewsGrid2').innerHTML = document.getElementById('reviewsGrid').innerHTML;
  }
  if (tab === 'pagamento') {
    if (typeof renderCheckoutPage === 'function') renderCheckoutPage();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Fecha o carrinho e abre a aba de pagamento */
function goToCheckout() {
  if (typeof isStoreOpen !== 'undefined' && !isStoreOpen) {
    showToast('🔴 A loja está fechada no momento. Não é possível finalizar pedidos.');
    return;
  }
  if (cart.length === 0) { showToast('⚠️ Adicione itens ao carrinho primeiro!'); return; }
  closeCart();
  switchTab('pagamento');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMenu(items) {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;

  document.getElementById('menuCount').textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;

  grid.innerHTML = items.map(item => {
    const imgHtml = item.imageUrl 
      ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
         <span class="card-img-emoji" style="display:none">${item.emoji}</span>`
      : `<span class="card-img-emoji">${item.emoji}</span>`;

    return `
    <div class="product-card fade-in" id="card-${item.id}" role="listitem">
      <div class="card-img" style="position:relative;overflow:hidden">
        ${item.badge ? `<span class="card-badge badge-${item.badge}" style="z-index:2">${item.badge==='hot'?'🔥 Top':item.badge==='new'?'✨ Novo':'⭐ Popular'}</span>` : ''}
        ${imgHtml}
      </div>
      <div class="card-body">
        <div class="card-title">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
        <div class="card-footer">
          <div class="card-price-wrap">
            <span class="card-price">R$ ${fmtPrice(item.price)}</span>
            ${item.oldPrice ? `<span class="card-price-old">R$ ${fmtPrice(item.oldPrice)}</span>` : ''}
          </div>
          <div id="addControl-${item.id}">
            <button class="add-btn" onclick="addToCart('${item.id}')" aria-label="Adicionar ${item.name} ao carrinho" title="Adicionar">+</button>
          </div>
        </div>
      </div>
    </div>
  `}).join('');

  cart.forEach(ci => {
    const el = document.getElementById(`addControl-${ci.id}`);
    if (el) renderQtyControl(ci.id, ci.qty);
  });
}

function renderQtyControl(id, qty) {
  const el = document.getElementById(`addControl-${id}`);
  if (!el) return;
  if (qty <= 0) {
    el.innerHTML = `<button class="add-btn" onclick="addToCart('${id}')" aria-label="Adicionar ao carrinho">+</button>`;
  } else {
    el.innerHTML = `
      <div class="qty-control" role="group" aria-label="Quantidade">
        <button class="qty-btn" onclick="changeQty('${id}',-1)" aria-label="Diminuir">−</button>
        <span class="qty-num" aria-live="polite">${qty}</span>
        <button class="qty-btn" onclick="changeQty('${id}',1)" aria-label="Aumentar">+</button>
      </div>`;
  }
}

/* Configuração de todas as categorias possíveis */
const CATEGORY_CONFIG = [
  { key: 'todos',      label: 'Todos',      emoji: '🍽️', titles: ['Cardápio',   'Completo']      },
  { key: 'lanches',   label: 'Lanches',    emoji: '🍔', titles: ['Lanches',    'Artesanais']    },
  { key: 'porcoes',   label: 'Porções',    emoji: '🍟', titles: ['Porções',    'Deliciosas']    },
  { key: 'bebidas',   label: 'Bebidas',    emoji: '🥤', titles: ['Bebidas',    'Geladinhas']    },
  { key: 'combos',    label: 'Combos',     emoji: '🎁', titles: ['Combos',     'Especiais']     },
  { key: 'sobremesas',label: 'Sobremesas', emoji: '🍦', titles: ['Sobremesas', 'Irresistíveis'] },
];

/**
 * Renderiza dinamicamente os pills de categoria.
 */
function renderCategoryPills() {
  const row = document.getElementById('catsRow');
  if (!row) return;

  let catList = [ { key: 'todos', label: 'Todos', emoji: '🍽️', titles: ['Cardápio', 'Completo'] } ];
  
  if (typeof globalCategories !== 'undefined' && globalCategories.length > 0) {
    globalCategories.forEach(c => {
      const slug = c.slug || c.id || c.nome.toLowerCase();
      const existing = CATEGORY_CONFIG.find(cfg => cfg.key === slug);
      catList.push({
        key: slug,
        label: c.nome,
        emoji: c.icone || '🏷️',
        titles: existing ? existing.titles : [c.nome, '']
      });
    });
  } else {
    // Fallback caso globalCategories não retorne (ex: Supabase off ou sem categorias)
    const activeCats = new Set(globalMenu.map(m => m.cat));
    const fallbackCats = CATEGORY_CONFIG.filter(c => c.key === 'todos' || activeCats.has(c.key));
    
    activeCats.forEach(catKey => {
      if (!fallbackCats.find(c => c.key === catKey)) {
        fallbackCats.push({
          key: catKey,
          label: catKey.charAt(0).toUpperCase() + catKey.slice(1),
          emoji: '🏷️',
          titles: [catKey.charAt(0).toUpperCase() + catKey.slice(1), '']
        });
      }
    });
    catList = fallbackCats;
  }

  row.innerHTML = catList.map((c, i) => `
    <button
      class="cat-pill${i === 0 ? ' active' : ''}"
      role="listitem"
      id="cat-${c.key}"
      onclick="filterCategory('${c.key}', this)"
    >${c.emoji} ${c.label}</button>
  `).join('');
  
  window.ACTIVE_CATEGORY_CONFIG = catList;
}

function filterCategory(cat, btn) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const filtered = cat === 'todos' ? globalMenu : globalMenu.filter(m => m.cat === cat);
  
  const configList = window.ACTIVE_CATEGORY_CONFIG || CATEGORY_CONFIG;
  const cfg = configList.find(c => c.key === cat);
  const [l1, l2] = cfg && cfg.titles ? cfg.titles : ['Cardápio', ''];
  document.getElementById('menuTitle').innerHTML = `${l1} <em>${l2}</em>`;
  renderMenu(filtered);
}

function renderPromos() {
  const promos = globalMenu.filter(m => m.oldPrice || m.badge === 'hot');
  document.getElementById('promosGrid').innerHTML = promos.map(item => {
    const imgHtml = item.imageUrl 
      ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
         <span class="card-img-emoji" style="display:none">${item.emoji}</span>`
      : `<span class="card-img-emoji">${item.emoji}</span>`;

    return `
    <div class="product-card fade-in" role="listitem">
      <div class="card-img" style="position:relative;overflow:hidden">
        <span class="card-badge badge-hot" style="z-index:2">🔥 Oferta</span>
        ${imgHtml}
      </div>
      <div class="card-body">
        <div class="card-title">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
        <div class="card-footer">
          <div>
            <span class="card-price">R$ ${fmtPrice(item.price)}</span>
            ${item.oldPrice ? `<span class="card-price-old">R$ ${fmtPrice(item.oldPrice)}</span>` : ''}
          </div>
          <button class="add-btn" onclick="addToCart('${item.id}')" aria-label="Adicionar ${item.name}">+</button>
        </div>
      </div>
    </div>
  `}).join('');
}

async function renderOrders() {
  const cont = document.getElementById('ordersContent');
  if (!cont) return;

  let ordersToRender = [];

  if (supabase && currentUser) {
    try {
      cont.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--ash)">Carregando pedidos...</div>`;
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, total,
          order_items(name, quantity)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      ordersToRender = data.map(o => ({
        num: String(o.id).padStart(4, '0'),
        date: new Date(o.created_at).toLocaleString('pt-BR'),
        items: o.order_items.map(i => ({ qty: i.quantity, name: i.name })),
        total: fmtPrice(Number(o.total)),
        status: o.status
      }));

    } catch (e) {
      console.error('Erro ao buscar pedidos:', e);
    }
  } else {
    // Modo local / Fallback
    ordersToRender = JSON.parse(localStorage.getItem('ciOrders') || '[]');
    ordersToRender = [...ordersToRender].reverse();
  }

  if (ordersToRender.length === 0) {
    cont.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;color:var(--ash)">
        <div style="font-size:80px;margin-bottom:1rem;opacity:0.25">📦</div>
        <p style="font-family:'Bebas Neue',cursive;font-size:1.6rem;letter-spacing:0.04em;color:var(--charcoal);margin-bottom:0.5rem">
          ${!currentUser && supabase ? 'FAÇA LOGIN PARA VER SEUS PEDIDOS' : 'NENHUM PEDIDO AINDA'}
        </p>
        <p style="font-size:0.87rem">Faça seu primeiro pedido e ele aparecerá aqui!</p>
        <button class="btn-fire" style="margin-top:1.75rem;margin-inline:auto;" onclick="switchTab('cardapio')">🍔 Ver Cardápio</button>
      </div>`;
    return;
  }

  cont.innerHTML = ordersToRender.map(o => `
    <div class="order-card fade-in">
      <div class="order-card-head">
        <span class="order-num">#${o.num}</span>
        <span class="order-date">${o.date}</span>
      </div>
      <div class="order-items">${o.items.map(i => `${i.qty}× ${i.name}`).join(' · ')}</div>
      <div class="order-foot">
        <span class="order-status ${o.status === 'preparando' ? 'preparando' : ''}">
          ${o.status === 'preparando' ? '⏳ Preparando' : '✅ Entregue'}
        </span>
        <span class="order-total">R$ ${o.total}</span>
      </div>
    </div>
  `).join('');
}

function renderReviewsUI(reviews) {
  const html = reviews.map(r => `
    <div class="review-card fade-in">
      <div class="review-header">
        <div class="review-avatar">${r.init}</div>
        <div>
          <div class="review-name">${r.name}</div>
          <div class="review-date">${r.date}</div>
        </div>
      </div>
      <div class="review-stars">${'⭐'.repeat(r.stars)}</div>
      <div class="review-text">"${r.text}"</div>
    </div>
  `).join('');
  
  document.getElementById('reviewsGrid').innerHTML = html;
}

function setRating(n) {
  currentRating = n;
  document.querySelectorAll('.star-pick').forEach((s, i) => {
    s.classList.toggle('active', i < n);
    s.style.filter = i < n ? 'none' : 'grayscale(1) opacity(0.4)';
    s.style.transform = i < n ? 'scale(1.05)' : 'scale(1)';
  });
  showToast(`⭐ Nota ${n} selecionada`);
}

async function submitReview() {
  const text = document.getElementById('reviewText').value.trim();
  if (!text) { showToast('⚠️ Escreva sua avaliação antes de enviar'); return; }
  
  const name = currentUser ? currentUser.name : 'Visitante';

  if (supabase) {
    try {
      const { error } = await supabase.from('reviews').insert([{
        user_name: name,
        rating: currentRating,
        text: text,
        date: new Date().toLocaleDateString('pt-BR')
      }]);
      if (error) throw error;
    } catch (e) {
      console.error('Erro ao enviar review:', e);
      showToast('❌ Erro ao enviar avaliação.');
      return;
    }
  }

  showToast('✅ Avaliação enviada! Obrigado 💛');
  document.getElementById('reviewText').value = '';
  setRating(5);
  
  // Atualiza as reviews na tela
  const latestReviews = await fetchReviews();
  renderReviewsUI(latestReviews);
  if (document.getElementById('tab-sobre').style.display !== 'none') {
    document.getElementById('reviewsGrid2').innerHTML = document.getElementById('reviewsGrid').innerHTML;
  }
}

function initParticles() {
  const container = document.getElementById('heroParticles');
  if (!container) return;
  const colors = ['rgba(255,184,0,0.6)', 'rgba(255,45,0,0.5)', 'rgba(255,107,26,0.5)'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'hero-particle';
    const size = Math.random() * 6 + 3;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${Math.random() * 8 + 6}s;
      animation-delay:${Math.random() * 6}s;
    `;
    container.appendChild(p);
  }
}

function toggleMobileSimulator() {
  if (window.self !== window.top) {
    showToast('⚠️ Você já está no simulador!');
    return;
  }
  
  let overlay = document.getElementById('mobileSimulatorOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobileSimulatorOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:99999; display:none; justify-content:center; align-items:center; backdrop-filter:blur(5px); flex-direction:column; gap:1.5rem;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕ Fechar Visualização Mobile';
    closeBtn.style.cssText = 'background:#ef4444; color:#fff; border:none; padding:12px 24px; border-radius:99px; font-family:"Barlow Condensed",sans-serif; font-weight:700; font-size:1.1rem; cursor:pointer; box-shadow:0 4px 15px rgba(239,68,68,0.4); transition:transform 0.2s;';
    closeBtn.onmouseover = () => closeBtn.style.transform = 'scale(1.05)';
    closeBtn.onmouseout = () => closeBtn.style.transform = 'scale(1)';
    closeBtn.onclick = () => {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
      document.getElementById('mobileSimulatorFrame').src = ''; // Clear to save memory
    };

    const phone = document.createElement('div');
    // Common iPhone dimensions (approximate)
    phone.style.cssText = 'width: 390px; height: 844px; max-height:85vh; border: 14px solid #1a1a1a; border-radius: 40px; overflow: hidden; box-shadow: 0 0 40px rgba(0,0,0,0.8); background: #000; position: relative; flex-shrink:0;';
    
    const notch = document.createElement('div');
    notch.style.cssText = 'position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 140px; height: 28px; background: #1a1a1a; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px; z-index: 10;';

    const iframe = document.createElement('iframe');
    iframe.id = 'mobileSimulatorFrame';
    iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: #0d0d0f; border-radius: 26px;';
    
    phone.appendChild(notch);
    phone.appendChild(iframe);
    overlay.appendChild(closeBtn);
    overlay.appendChild(phone);
    document.body.appendChild(overlay);
  }
  
  if (overlay.style.display === 'none' || overlay.style.display === '') {
    let currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('in_simulator', '1');
    document.getElementById('mobileSimulatorFrame').src = currentUrl.toString();
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } else {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('mobileSimulatorFrame').src = '';
  }
}

// Hide mobile preview button if we are already inside the simulator
window.addEventListener('load', () => {
  if (new URL(window.location.href).searchParams.get('in_simulator') === '1') {
    const btn = document.getElementById('adminMobilePreviewBtn');
    if(btn) btn.style.display = 'none !important';
    
    // Create a generic style element to hide the button forcefully inside the iframe
    const style = document.createElement('style');
    style.innerHTML = '.admin-mobile-preview-btn { display: none !important; }';
    document.head.appendChild(style);
  }
});

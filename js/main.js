/* ═══════════════════════════════════════
   MAIN — main.js
   Ponto de entrada: carrega sessão, dados
   e inicializa eventos globais.
═══════════════════════════════════════ */

// ── Funções de Interface Global ──────────────────────────
function updateStoreStatusUI() {
  const badge = document.getElementById('storeStatusBadge');
  if (!badge) return;
  if (typeof isStoreOpen !== 'undefined' && isStoreOpen) {
    badge.className = 'store-badge open';
    badge.innerHTML = 'Aberto Agora';
  } else {
    badge.className = 'store-badge closed';
    badge.innerHTML = 'Fechado';
  }
}

window.addEventListener('load', async () => {
  // 0. Busca a logo e o status da loja
  if (typeof fetchStoreSettings === 'function') {
    await fetchStoreSettings();
  }

  // 1. Tenta recuperar o usuário local
  const savedUser = localStorage.getItem('ciUser');
  if (savedUser) {
    try { 
      currentUser = JSON.parse(savedUser); 
    } catch(e) {}
  }

  // 2. Se o Supabase estiver configurado, checar sessão real
  if (supabase) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        // Busca informações complementares na tabela profiles (role e id_reconhecimento)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, id_reconhecimento')
          .eq('id', session.user.id)
          .single();

        currentUser = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          email: session.user.email,
          role: profile?.role || 'cliente',
          reconhecimento_id: profile?.id_reconhecimento || session.user.user_metadata?.reconhecimento_id
        };
        localStorage.setItem('ciUser', JSON.stringify(currentUser));
      } else {
        currentUser = null;
        localStorage.removeItem('ciUser');
      }
    } catch (e) {
      console.error('Erro ao checar sessão:', e);
    }
  }

  // 3. Atualizar UI de usuário
  updateUserUI();

  // 4. Buscar e renderizar Menu + Pills de categoria dinâmicos
  await fetchCategories();
  const menuData = await fetchMenu();
  renderCategoryPills();
  renderMenu(menuData);


  // 5. Buscar e renderizar Reviews
  const reviewsData = await fetchReviews();
  renderReviewsUI(reviewsData);

  // 6. Atualizar Carrinho e Efeitos Visuais
  updateCartUI();
  initParticles();

  // 7. Eventos Globais
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', function(e) {
      if (e.target === this) closeModal(this.id);
    });
  });

  document.querySelectorAll('.star-pick').forEach(s => {
    s.style.filter = 'none';
  });
});

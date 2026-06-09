/* ═══════════════════════════════════════
   MAIN — main.js
   Ponto de entrada: carrega sessão, dados
   e inicializa eventos globais.
═══════════════════════════════════════ */

window.addEventListener('load', async () => {
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
        currentUser = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          email: session.user.email
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

  // 4. Buscar e renderizar Menu
  const menuData = await fetchMenu();
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

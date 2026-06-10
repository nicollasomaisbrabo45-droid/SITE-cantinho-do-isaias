/* ═══════════════════════════════════════
   AUTH — auth.js
   Gerencia login, cadastro e logout
   usando Supabase Auth e LocalStorage.
═══════════════════════════════════════ */

let currentUser = null;
let authMode = 'login'; // 'login' | 'register'

/**
 * Abre o modal de autenticação ou realiza logout se já logado.
 */
function openAuth() {
  if (currentUser) {
    if (confirm(`Sair da conta de ${currentUser.name}?`)) logout();
    return;
  }
  authMode = 'login';
  document.getElementById('authTitle').textContent = 'Entrar na conta';
  document.getElementById('authSubmitBtn').textContent = 'Entrar';
  document.querySelector('.form-toggle').innerHTML = 'Não tem conta? <a onclick="toggleAuthMode()" role="button">Criar conta</a>';
  const nameGroup = document.getElementById('authNameGroup');
  if (nameGroup) nameGroup.style.display = 'none';
  openModal('authModal');
}

/**
 * Alterna entre modo de login e cadastro.
 */
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('authTitle').textContent = authMode === 'login' ? 'Entrar na conta' : 'Criar conta';
  document.getElementById('authSubmitBtn').textContent = authMode === 'login' ? 'Entrar' : 'Criar conta';
  document.querySelector('.form-toggle').innerHTML = authMode === 'login'
    ? 'Não tem conta? <a onclick="toggleAuthMode()" role="button">Criar conta</a>'
    : 'Já tem conta? <a onclick="toggleAuthMode()" role="button">Entrar</a>';
  const nameGroup = document.getElementById('authNameGroup');
  if (nameGroup) nameGroup.style.display = authMode === 'login' ? 'none' : 'block';
}

/**
 * Gera um ID de reconhecimento único baseado no email (Ex: #TDS1828)
 */
function generateUniqueId(email) {
  let prefix = email.split('@')[0].replace(/[0-9]/g, '').toUpperCase();
  let letters = prefix.substring(0, 3);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  while (letters.length < 3) {
    letters += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `#${letters}${numbers}`;
}

/**
 * Executa a ação do formulário de auth (Login ou Cadastro).
 */
async function handleAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  let name = '';

  if (authMode === 'register') {
    name = document.getElementById('authName').value.trim();
    if (!name) {
      showToast('⚠️ Preencha seu nome');
      return;
    }
  } else {
    name = email.split('@')[0];
  }

  if (!email || !pass) {
    showToast('⚠️ Preencha email e senha');
    return;
  }

  if (!supabase) {
    // ─── MODO FALLBACK (Sem Supabase) ───
    let user_id;
    let savedUser = null;
    try { savedUser = JSON.parse(localStorage.getItem('ciUser')); } catch(e){}

    if (authMode === 'login' && savedUser && savedUser.email === email) {
      user_id = savedUser.reconhecimento_id || generateUniqueId(email);
    } else {
      user_id = generateUniqueId(email);
    }

    currentUser = { name, email, reconhecimento_id: user_id };
    localStorage.setItem('ciUser', JSON.stringify(currentUser));
    updateUserUI();
    closeModal('authModal');
    showToast(`👋 Bem-vindo(a), ${name}! ID: ${user_id}`);
    return;
  }

  // ─── MODO SUPABASE REAL ───
  try {
    document.getElementById('authSubmitBtn').textContent = 'Carregando...';
    document.getElementById('authSubmitBtn').disabled = true;

    if (authMode === 'register') {
      const reconhecimento_id = generateUniqueId(email);
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: pass,
        options: {
          data: { name: name, reconhecimento_id: reconhecimento_id }
        }
      });
      if (error) throw error;

      // Salva explicitamente as informações na tabela "profiles"
      if (data && data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert([{
          id: data.user.id,
          email: email,
          nome: name,
          id_reconhecimento: reconhecimento_id
        }]);
        
        if (profileError) {
          console.error("Erro ao salvar perfil:", profileError);
        }
      }

      // Descobre se o novo usuário ganhou o cargo de admin
      let userRole = 'cliente';
      if (data && data.user) {
        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        if (profileData) userRole = profileData.role;
      }

      showToast('✅ Conta criada! Você já pode entrar.');
      toggleAuthMode();
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: pass,
      });
      if (error) throw error;
      
      // Busca a role no banco
      let userRole = 'cliente';
      const { data: profileData } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (profileData) userRole = profileData.role;
      
      currentUser = {
        id: data.user.id,
        name: data.user.user_metadata?.name || name,
        email: data.user.email,
        reconhecimento_id: data.user.user_metadata?.reconhecimento_id || generateUniqueId(email),
        role: userRole
      };
      localStorage.setItem('ciUser', JSON.stringify(currentUser));
      updateUserUI();
      closeModal('authModal');
      showToast(`👋 Bem-vindo(a), ${currentUser.name}! ID: ${currentUser.reconhecimento_id}`);
    }
  } catch (error) {
    console.error('Erro na autenticação:', error);
    showToast(`❌ Falha: ${error.message}`);
  } finally {
    document.getElementById('authSubmitBtn').disabled = false;
    document.getElementById('authSubmitBtn').textContent = authMode === 'login' ? 'Entrar' : 'Criar conta';
  }
}

/**
 * Desloga o usuário e limpa a sessão.
 */
async function logout() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  currentUser = null;
  localStorage.removeItem('ciUser');
  updateUserUI();
  showToast('👋 Até logo!');
}

/**
 * Atualiza o nome/avatar na navbar.
 */
function updateUserUI() {
  const nameEl = document.getElementById('navUserName');
  const avatarEl = document.getElementById('navAvatar');
  const gearBtn = document.getElementById('adminGearBtn');
  
  if (nameEl) {
    if (currentUser) {
      const adminTag = currentUser.role === 'admin'
        ? '<span style="color: gold; font-weight: bold; margin-left: 5px; font-size: 0.75em;">★ ADMIN</span>'
        : '';
      nameEl.innerHTML = `${currentUser.name} <span style="font-size: 0.8em; opacity: 0.8; margin-left: 5px;">${currentUser.reconhecimento_id}</span>${adminTag}`;
    } else {
      nameEl.textContent = 'Entrar';
    }
  }

  // Mostra ou oculta o botão de engrenagem de acordo com o cargo
  if (gearBtn) {
    gearBtn.style.display = (currentUser && currentUser.role === 'admin') ? 'flex' : 'none';
  }

  if (avatarEl) avatarEl.textContent = currentUser ? currentUser.name[0].toUpperCase() : '👤';
}

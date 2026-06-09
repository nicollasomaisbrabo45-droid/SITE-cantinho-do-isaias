/* ═══════════════════════════════════════
   SUPABASE CLIENT — supabase.js
   Inicializa a conexão com o banco de dados.
═══════════════════════════════════════ */

// ==========================================
// ⚠️ ATENÇÃO: SUBSTITUA COM SEUS DADOS! ⚠️
// ==========================================
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co'; // Substitua pela URL do seu projeto
const SUPABASE_ANON_KEY = 'Sua-Anon-Key-Aqui'; // Substitua pela sua Anon Key

let supabase = null;

// Inicializa o cliente do Supabase apenas se as chaves tiverem sido alteradas
if (SUPABASE_URL.includes('SEU-PROJETO') || SUPABASE_ANON_KEY.includes('Sua-Anon-Key-Aqui')) {
  console.warn("⚠️ SUPABASE NÃO CONFIGURADO! As requisições ao banco falharão.");
  console.warn("Por favor, adicione sua URL e Anon Key no arquivo /js/supabase.js");
  // Sobrescreve a biblioteca global com nulo para ativar o MODO FALLBACK nos outros scripts
  window.supabase = null;
} else {
  // Inicializa o client usando a lib importada via CDN no index.html e expõe globalmente
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

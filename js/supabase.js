/* ═══════════════════════════════════════
   SUPABASE CLIENT — supabase.js
   Inicializa a conexão com o banco de dados.
═══════════════════════════════════════ */

// ==========================================
// ⚠️ ATENÇÃO: SUBSTITUA COM SEUS DADOS! ⚠️
// ==========================================
const SUPABASE_URL = 'https://zsyoffmopznlznrvsysp.supabase.co'; // URL corrigida do seu projeto
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzeW9mZm1vcHpubHpucnZzeXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTEzMDIsImV4cCI6MjA5NjU4NzMwMn0.At4KCVbHjH1Lrt1IDR1wU1klLiCstcPnQf1ZoxBj5Fg';

// Salva a referência da biblioteca original que veio do CDN
const supabaseLib = window.supabase;

// Inicializa o cliente do Supabase apenas se as chaves tiverem sido alteradas
if (SUPABASE_URL.includes('SEU-PROJETO') || SUPABASE_ANON_KEY.includes('Sua-Anon-Key-Aqui')) {
  console.warn("⚠️ SUPABASE NÃO CONFIGURADO! As requisições ao banco falharão.");
  console.warn("Por favor, adicione sua URL e Anon Key no arquivo /js/supabase.js");
  // Sobrescreve a biblioteca global com nulo para ativar o MODO FALLBACK nos outros scripts
  window.supabase = null;
} else {
  // Inicializa o client usando a lib importada via CDN no index.html e expõe globalmente
  window.supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

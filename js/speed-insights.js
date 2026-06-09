/* ═══════════════════════════════════════
   SPEED INSIGHTS — speed-insights.js
   Inicializa o Vercel Speed Insights
═══════════════════════════════════════ */

// Importa e inicializa o Speed Insights
import { injectSpeedInsights } from 'https://cdn.jsdelivr.net/npm/@vercel/speed-insights@1.0.12/dist/index.mjs';

// Inicializa o Speed Insights
injectSpeedInsights({
  // Habilita modo debug apenas em desenvolvimento
  debug: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  // Framework: vanilla (não é React, Next.js, etc.)
  framework: 'vanilla'
});

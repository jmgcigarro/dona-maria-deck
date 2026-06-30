window.DECK_CONFIG = {
  appVersion: '2026.06.30-02',
  cacheName: 'dona-maria-deck-v12',
  supabaseUrl: 'https://hrlfwpwzciljwpgejmha.supabase.co',
  supabasePublicKey: 'sb_publishable_2VSqW87Rn7f4OwC1EXDSoQ_CInkq7mK',
  recentRecordsTtlMs: 24 * 60 * 60 * 1000,
  restaurantTables: [
    'faturacao_historica',
    'faturacao_diaria',
    'fornecedores_historico',
    'ordenados',
    'despesas_fixas',
    'investimentos'
  ],
  filesToCache: [
    './',
    './index.html',
    './css/styles.css',
    './js/config.js',
    './js/core/app-core.js',
    './js/pages/pages-suppliers-fixed.js',
    './js/pages/pages-home-history.js',
    './js/pages/pages-results-analysis.js',
    './js/auth.js',
    './js/pages/home-supplier-alert.js',
    './js/pages/summary-legacy.js',
    './js/pages/summary.js',
    './js/assistant.js',
    './js/sw-register.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
  ]
};

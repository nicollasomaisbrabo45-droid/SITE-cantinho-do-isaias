/* ═══════════════════════════════════════
   DATA — data.js
   Gerencia a busca de dados do Supabase.
   Fallback para dados locais se o Supabase
   não estiver configurado.
═══════════════════════════════════════ */

// ─── DADOS LOCAIS (FALLBACK) ───
const FALLBACK_MENU = [
  { id:1,  name:'X-Burguer Clássico',    desc:'Hambúrguer artesanal, queijo, alface, tomate, molho especial da casa.',          price:18.90, oldPrice:22,   emoji:'🍔', cat:'lanches',    rating:4.9, badge:'hot',     reviews:142 },
  { id:2,  name:'X-Salada Duplo',         desc:'Dois hambúrgueres, queijo duplo, salada fresca e maionese temperada.',           price:24.90,               emoji:'🍔', cat:'lanches',    rating:4.8,                  reviews:98  },
  { id:3,  name:'X-Frango Crocante',      desc:'Frango empanado crocante, queijo, alface e molho ranch especial.',               price:21.90,               emoji:'🍗', cat:'lanches',    rating:4.7, badge:'popular', reviews:76  },
  { id:4,  name:'X-Bacon Especial',       desc:'Hambúrguer artesanal, bacon crocante, cheddar derretido e cebola crispy.',       price:27.90,               emoji:'🥓', cat:'lanches',    rating:5.0, badge:'new',     reviews:34  },
  { id:5,  name:'Batata Frita P',         desc:'Batata palito crocante frita na hora com sal e tempero especial.',               price:9.90,                emoji:'🍟', cat:'porcoes',    rating:4.6,                  reviews:211 },
  { id:6,  name:'Batata Frita G + Molho', desc:'Porção grande de batata frita com molho cheddar ou barbecue.',                  price:17.90,               emoji:'🍟', cat:'porcoes',    rating:4.8, badge:'hot',     reviews:189 },
  { id:7,  name:'Onion Rings',            desc:'Anéis de cebola empanados e fritos, servidos com molho ranch.',                  price:14.90,               emoji:'🧅', cat:'porcoes',    rating:4.5,                  reviews:67  },
  { id:8,  name:'Coca-Cola 350ml',        desc:'Gelada, na latinha. Também disponível em versão sem açúcar.',                   price:6.90,                emoji:'🥤', cat:'bebidas',    rating:4.9,                  reviews:300 },
  { id:9,  name:'Suco de Laranja',        desc:'Laranja natural espremida na hora, gelado e sem conservantes.',                 price:8.90,                emoji:'🍊', cat:'bebidas',    rating:4.8,                  reviews:145 },
  { id:10, name:'Milk Shake',             desc:'Milk shake cremoso nos sabores: morango, chocolate ou baunilha.',               price:16.90,               emoji:'🥛', cat:'bebidas',    rating:5.0, badge:'popular', reviews:88  },
  { id:11, name:'Combo Família',          desc:'2 X-Burguer + 2 batatas médias + 2 refris. Perfeito para dividir!',             price:52.90, oldPrice:62,   emoji:'🎁', cat:'combos',     rating:4.9, badge:'hot',     reviews:201 },
  { id:12, name:'Combo Individual',       desc:'X-Burguer + batata pequena + refri 350ml. Rápido e prático.',                   price:29.90, oldPrice:35,   emoji:'🎁', cat:'combos',     rating:4.7,                  reviews:167 },
  { id:13, name:'Açaí na Tigela',         desc:'Açaí cremoso com granola, leite condensado e banana. 400ml.',                   price:15.90,               emoji:'🍇', cat:'sobremesas', rating:4.8, badge:'new',     reviews:42  },
  { id:14, name:'Churros c/ Doce de Leite', desc:'Churros fresquinhos recheados com doce de leite e açúcar canela.',           price:11.90,               emoji:'🥐', cat:'sobremesas', rating:4.9,                  reviews:73  },
];

const FALLBACK_REVIEWS = [
  { name:'Ana Carolina',  text:'Melhor hambúrguer do bairro! O molho especial é incrível 😍',              stars:5, date:'há 2 dias',    init:'AC' },
  { name:'Lucas Ferreira', text:'Entrega super rápida e o lanche chegou quentinho. Nota 10! 👏',           stars:5, date:'há 5 dias',    init:'LF' },
  { name:'Maria Souza',    text:'O X-Frango Crocante é maravilhoso. Já pedi 3 vezes essa semana!',         stars:5, date:'há 1 semana',  init:'MS' },
  { name:'Pedro Oliveira', text:'Porção de batata enorme e muito crocante. Vale cada centavo!',            stars:4, date:'há 10 dias',   init:'PO' },
  { name:'Julia Santos',   text:'O combo família salvou o almoço de domingo. Muito bom tudo!',             stars:5, date:'há 2 semanas', init:'JS' },
  { name:'Rafael Costa',   text:'Açaí delicioso! Muito cremoso e bem servido. Recomendo 🍇',              stars:5, date:'há 3 semanas', init:'RC' },
];

let globalMenu = [];

/**
 * Busca o cardápio no Supabase. Se falhar ou o Supabase não estiver
 * configurado, retorna os dados locais de fallback.
 */
async function fetchMenu() {
  if (!supabase) {
    console.log('Usando cardápio local (Fallback)');
    globalMenu = FALLBACK_MENU;
    return globalMenu;
  }

  try {
    const { data, error } = await supabase.from('menu').select('*').order('category').order('name');
    if (error) throw error;
    
    if (data && data.length > 0) {
      // Mapear colunas do banco para o formato usado pelo front
      globalMenu = data
        .filter(item => item.is_active !== false) // Só pega os ativos
        .map(item => ({
          id: item.id,
          name: item.name,
          desc: item.description,
          price: Number(item.price),
          oldPrice: item.old_price ? Number(item.old_price) : null,
          emoji: item.emoji || '🍔',
          imageUrl: item.image_url || null,
          cat: item.category,
          rating: Number(item.rating) || 5.0,
          badge: item.badge,
          reviews: Math.floor(Math.random() * 200) + 10 // Simula quantidade de reviews
        }));
      return globalMenu;
    } else {
      console.log('Menu no Supabase está vazio. Usando fallback.');
      globalMenu = FALLBACK_MENU;
      return globalMenu;
    }
  } catch (error) {
    console.error('Erro ao buscar o menu no Supabase:', error);
    globalMenu = FALLBACK_MENU;
    return globalMenu;
  }
}

let globalCategories = [];

/**
 * Busca as categorias no Supabase.
 */
async function fetchCategories() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('categories').select('*').order('nome');
    if (error) throw error;
    globalCategories = data || [];
    return globalCategories;
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    return [];
  }
}

/**
 * Busca as avaliações no Supabase.
 */
async function fetchReviews() {
  if (!supabase) return FALLBACK_REVIEWS;

  try {
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    if (data && data.length > 0) {
      return data.map(r => ({
        name: r.user_name,
        text: r.text,
        stars: r.rating,
        date: r.date,
        init: r.user_name.substring(0, 2).toUpperCase()
      }));
    } else {
      return FALLBACK_REVIEWS;
    }
  } catch (error) {
    console.error('Erro ao buscar reviews no Supabase:', error);
    return FALLBACK_REVIEWS;
  }
}

let isStoreOpen = true;

/**
 * Busca a logo e o status da loja (aberto/fechado) no Supabase
 */
async function fetchStoreSettings() {
  let logoUrl = 'img/logo.jpg'; // default

  // Fallback rápido local
  const localLogo = localStorage.getItem('ci_site_logo');
  if (localLogo) logoUrl = localLogo;

  if (window.supabase) {
    try {
      const { data, error } = await window.supabase.from('settings').select('id, value');
      if (!error && data) {
        data.forEach(setting => {
          if (setting.id === 'site_logo' && setting.value) {
            logoUrl = setting.value;
            localStorage.setItem('ci_site_logo', logoUrl); // Atualiza o cache local
          }
          if (setting.id === 'site_status') {
            isStoreOpen = (setting.value === 'open');
          }
        });
      }
    } catch(e) {
      console.warn('Configurações não encontradas ou erro na busca.');
    }
  }

  // Atualiza as imagens de logo na página atual
  const logoImgs = document.querySelectorAll('img[alt*="Logo"], #navLogoImg, .nav-logo img');
  logoImgs.forEach(img => {
    img.src = logoUrl;
  });
  
  // Update status UI Se existir a função (definida no main.js)
  if (typeof updateStoreStatusUI === 'function') {
    updateStoreStatusUI();
  }
}

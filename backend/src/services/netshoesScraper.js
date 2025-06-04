// backend/src/services/netshoesScraper.js
const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para gerar um user agent aleatório
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

exports.scrapeProductData = async (url) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--window-size=1920,1080'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent aleatório
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    
    // Configurar headers extras para parecer mais com um navegador real
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'sec-ch-ua': '"Google Chrome";v="118", "Chromium";v="118", "Not=A?Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });
    
    // Configurar cookies e storage para parecer um navegador real
    await page.evaluateOnNewDocument(() => {
      // Sobrescrever as propriedades que os sites usam para detectar bots
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          }
        ],
      });
      
      // Adicionar WebGL
      const getParameter = WebGLRenderingContext.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Open Source Technology Center';
        }
        if (parameter === 37446) {
          return 'Mesa DRI Intel(R) Haswell Mobile ';
        }
        return getParameter(parameter);
      };
      
      // Simular uma tela comum
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.outerWidth = 1920;
      window.outerHeight = 1080;
      window.screen = {
        availWidth: 1920,
        availHeight: 1080,
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelDepth: 24
      };
    });
    
    // Desativar cache para garantir dados atualizados
    await page.setCacheEnabled(false);
    
    console.log(`Navegando para URL: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });
    
    // Aguardar carregamento inicial
    console.log('Aguardando carregamento inicial...');
    await wait(5000);
    
    // Capturar URL após redirecionamento
    let currentUrl = page.url();
    console.log(`URL após redirecionamento: ${currentUrl}`);
    
    // Verificar se estamos em uma página de afiliado da Rakuten (tiny.cc)
    if (url.includes('tiny.cc') || url.includes('rakuten')) {
      console.log('Detectado link de afiliado Rakuten, aguardando redirecionamentos...');
      
      // Aguardar mais tempo para redirecionamentos de afiliados
      await wait(8000);
      
      // Verificar se há um botão de consentimento de cookies para clicar
      try {
        const cookieButton = await page.$('button[id*="cookie"], button[class*="cookie"], button[id*="gdpr"], button[class*="gdpr"], button[id*="aceitar"], button[class*="aceitar"], button[id*="accept"], button[class*="accept"]');
        if (cookieButton) {
          console.log('Botão de cookie encontrado, clicando...');
          await cookieButton.click();
          await wait(2000);
        }
      } catch (e) {
        console.log('Nenhum botão de cookie encontrado ou erro ao clicar.');
      }
      
      // Obter URL atual após redirecionamentos
      currentUrl = page.url();
      console.log(`URL após redirecionamentos de afiliado: ${currentUrl}`);
    }
    
    // Verificação adicional para botões de aceitação de cookies
    try {
      // Tentar encontrar e clicar em vários possíveis botões de cookie
      const cookieSelectors = [
        'button[id*="cookie"][id*="accept"]',
        'button[class*="cookie"][class*="accept"]',
        'button[id*="gdpr"]',
        'button[class*="gdpr"]',
        'button[id*="aceitar"]',
        'button[class*="aceitar"]',
        'button[id*="accept"]',
        'button[class*="accept"]',
        'a[id*="cookie"][id*="accept"]',
        'a[class*="cookie"][class*="accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        const cookieButton = await page.$(selector);
        if (cookieButton) {
          console.log(`Botão de cookie encontrado com seletor ${selector}, clicando...`);
          await cookieButton.click();
          await wait(1000);
          break;
        }
      }
    } catch (e) {
      console.log('Erro ao lidar com diálogos de cookie:', e.message);
    }
    
    // Extrair código do produto da URL
    let productCode = '';
    if (currentUrl.includes('netshoes.com.br')) {
      const productCodeMatch = currentUrl.match(/([A-Z0-9]{3}-\d+-\d+)/i);
      if (productCodeMatch && productCodeMatch[1]) {
        productCode = productCodeMatch[1];
        console.log(`Código do produto extraído: ${productCode}`);
      }
    }
    
    // Rolar a página para carregar todo o conteúdo
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 300);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });
    
    await wait(2000);
    
    // Tirar screenshot para debug
    await page.screenshot({path: 'netshoes-produto.png'});
    
    // Extrair dados do produto usando os seletores específicos fornecidos
    const productData = await page.evaluate(() => {
      // Função para limpar texto de preço
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      // Função para extrair preço com R$
      const extractPriceWithRS = (text) => {
        if (!text) return null;
        const match = text.match(/R\$\s*(\d+[.,]\d+)/);
        return match ? match[1].replace('.', ',') : null;
      };
      
      // Nome do produto - múltiplos seletores para maior robustez
      let productTitle = '';
      const titleSelectors = [
        '.short-description',
        '.product-name',
        '.product__name',
        'h1[data-testid*="product-name"]',
        'h1[class*="name"]',
        'h1[class*="title"]',
        '.info-product h1',
        'h1.title',
        'h1'
      ];
      
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          productTitle = element.textContent.trim();
          break;
        }
      }
      
      // CORREÇÃO: Usar os seletores específicos fornecidos
      let currentPrice = '';
      let originalPrice = '';
      
      // Seletor para preço original (antigo/riscado)
      const originalPriceElement = document.querySelector('div.price:nth-child(2) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)');
      if (originalPriceElement) {
        const priceText = originalPriceElement.textContent.trim();
        console.log('[NETSHOES] Preço original encontrado com seletor específico:', priceText);
        originalPrice = extractPriceWithRS(priceText) || cleanPrice(priceText);
      }
      
      // Seletor para preço atual
      const currentPriceElement = document.querySelector('div.price:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1)');
      if (currentPriceElement) {
        const priceText = currentPriceElement.textContent.trim();
        console.log('[NETSHOES] Preço atual encontrado com seletor específico:', priceText);
        currentPrice = extractPriceWithRS(priceText) || cleanPrice(priceText);
      }
      
      // Log dos preços encontrados
      console.log('[NETSHOES] Preços extraídos - Original:', originalPrice, 'Atual:', currentPrice);
      
      // Se não encontrou com os seletores específicos, usar fallbacks
      if (!currentPrice || !originalPrice) {
        console.log('[NETSHOES] Usando seletores fallback...');
        
        // Fallback para preço atual
        if (!currentPrice) {
          const priceSelectors = [
            '.default-price',
            '.price__value', 
            '.product-price .price-box .regular-price .price',
            '.product-price-box .product-price__best',
            '.price-final',
            '.product-price .value',
            '.product-price strong',
            '[data-testid*="price"]',
            '[class*="currentPrice"]',
            '[class*="finalPrice"]',
            '[class*="bestPrice"]',
            '.price .sale strong',
            'span[class*="price"]',
            'div[class*="price"]',
            // Específicos Netshoes
            '.product-price__best',
            '.product-price__value',
            '.price-box__best',
            '.valor-por',
            '.actual-price',
            '.price-box__price'
          ];
          
          for (const selector of priceSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              const priceText = element.textContent.trim();
              const extractedPrice = extractPriceWithRS(priceText) || cleanPrice(priceText);
              if (extractedPrice) {
                const priceValue = parseFloat(extractedPrice.replace(',', '.'));
                // Só aceitar preços acima de R$ 50 para evitar promoções especiais
                if (priceValue >= 50) {
                  currentPrice = extractedPrice;
                  console.log(`[NETSHOES] Preço atual fallback encontrado com ${selector}: ${currentPrice}`);
                  break;
                }
              }
            }
          }
        }
        
        // Fallback para preço original
        if (!originalPrice) {
          const originalPriceSelectors = [
            '.old-price',
            '.price__old',
            '.product-price .price-box .old-price .price',
            '.product-price-box .product-price__old',
            '.regular-price .strike',
            '[data-testid*="original-price"]',
            '[class*="oldPrice"]',
            '[class*="listPrice"]',
            '.price .regular',
            'span[class*="list-price"]',
            'span[class*="old"]',
            // Específicos Netshoes
            '.price-box__list',
            '.list-price',
            '.valor-de',
            '.original-price',
            '.list-price span',
            // Buscar elementos riscados
            'del',
            's',
            '[style*="text-decoration: line-through"]',
            '[style*="text-decoration:line-through"]'
          ];
          
          for (const selector of originalPriceSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              const priceText = element.textContent.trim();
              const extractedPrice = extractPriceWithRS(priceText) || cleanPrice(priceText);
              if (extractedPrice) {
                const priceValue = parseFloat(extractedPrice.replace(',', '.'));
                // Verificar se o preço original é maior que o preço atual
                const currentValue = currentPrice ? parseFloat(currentPrice.replace(',', '.')) : 0;
                if (priceValue > currentValue && priceValue >= 100) {
                  originalPrice = extractedPrice;
                  console.log(`[NETSHOES] Preço original fallback encontrado: ${originalPrice}`);
                  break;
                }
              }
            }
          }
        }
        
        // Se ainda não encontrou, procurar por padrão "De R$ X Por R$ Y"
        if (!currentPrice || !originalPrice) {
          const deParaRegex = /de\s*r\$\s*(\d+[.,]\d+)(?:\s*por)?\s*r\$\s*(\d+[.,]\d+)/i;
          const bodyText = document.body.textContent;
          const deParaMatch = bodyText.match(deParaRegex);
          
          if (deParaMatch) {
            const de = deParaMatch[1].replace('.', ',');
            const por = deParaMatch[2].replace('.', ',');
            
            if (!originalPrice) originalPrice = de;
            if (!currentPrice) currentPrice = por;
            
            console.log('[NETSHOES] Preços encontrados via regex De/Por - Original:', originalPrice, 'Atual:', currentPrice);
          }
        }
      }
      
      // Verificar se o preço atual é menor que o original (como esperado)
      if (originalPrice && currentPrice) {
        const origValue = parseFloat(originalPrice.replace(',', '.'));
        const currValue = parseFloat(currentPrice.replace(',', '.'));
        
        if (origValue <= currValue) {
          // Se não for, pode ser um erro. Inverter apenas se a diferença for substancial (> 5%)
          if (currValue > origValue * 1.05) {
            console.log("[NETSHOES] Invertendo preços porque original <= current");
            [originalPrice, currentPrice] = [currentPrice, originalPrice];
          }
        }
      }
      
      // Imagem do produto
      let productImage = '';
      const imageSelectors = [
        '.photo-figure img',
        '.showcase-product img',
        '.product__image img',
        '.photo .zoom img',
        'meta[property="og:image"]',
        'div[class*="productImage"] img',
        'img[data-testid*="main-image"]',
        'img[class*="mainImage"]',
        'img[id*="product-image"]'
      ];
      
      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          productImage = selector === 'meta[property="og:image"]' ? 
            element.getAttribute('content') : 
            element.getAttribute('src');
          if (productImage) break;
        }
      }
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: 'Netshoes',
        platform: 'netshoes',
        realProductUrl: window.location.href
      };
    });
    
    // Log para depuração
    console.log("Dados extraídos da Netshoes:", JSON.stringify(productData, null, 2));
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Netshoes:', error);
    console.error(error.stack);
    
    // Retornar dados fictícios em caso de erro para não quebrar a aplicação
    return {
      name: "Tênis Esportivo Netshoes (Placeholder)",
      currentPrice: "349",
      originalPrice: "599",
      imageUrl: "https://static.netshoes.com.br/produtos/tenis-adidas-runfalcon-3-masculino/28/FB9-0006-128/FB9-0006-128_zoom1.jpg",
      vendor: "Netshoes",
      platform: "netshoes",
      productUrl: url,
      isPlaceholder: true,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};
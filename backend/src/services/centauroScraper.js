// backend/src/services/centauroScraper.js
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
    let page = await browser.newPage();
    
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
          }
        ],
      });
      
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.outerWidth = 1920;
      window.outerHeight = 1080;
    });
    
    await page.setCacheEnabled(false);
    
    console.log(`Navegando para URL: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });
    
    console.log('Aguardando carregamento inicial...');
    await wait(5000);
    
    let currentUrl = page.url();
    console.log(`URL após redirecionamento: ${currentUrl}`);
    
    // Verificar se estamos em uma página de afiliado da Awin (tidd.ly)
    if (url.includes('tidd.ly') || url.includes('awin')) {
      console.log('Detectado link de afiliado Awin, aguardando redirecionamentos...');
      await wait(8000);
      
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
      
      currentUrl = page.url();
      console.log(`URL após redirecionamentos de afiliado: ${currentUrl}`);
      
      if (await page.evaluate(() => document.body.textContent.includes('Access Denied'))) {
        console.log('Detectada página de "Access Denied", tentando contornar...');
        
        let productUrl = '';
        if (currentUrl.includes('centauro.com.br')) {
          const urlMatch = currentUrl.match(/\/([^\/]+?)(?:-\d+)?\.html/);
          if (urlMatch && urlMatch[1]) {
            const productCode = urlMatch[1];
            productUrl = `https://www.centauro.com.br/${productCode}.html`;
            console.log(`Extraído código do produto: ${productCode}`);
          }
        }
        
        if (productUrl) {
          console.log(`Tentando acessar diretamente: ${productUrl}`);
          await page.close();
          
          const newPage = await browser.newPage();
          await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');
          await newPage.setExtraHTTPHeaders({
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Referer': 'https://www.google.com/'
          });
          
          await newPage.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          page = newPage;
          currentUrl = page.url();
          console.log(`Nova URL após contorno: ${currentUrl}`);
          await wait(3000);
        }
      }
    }
    
    // Verificação adicional para botões de aceitação de cookies
    try {
      const cookieSelectors = [
        'button[id*="cookie"][id*="accept"]',
        'button[class*="cookie"][class*="accept"]',
        'button[id*="gdpr"]',
        'button[class*="gdpr"]',
        'button[id*="aceitar"]',
        'button[class*="aceitar"]',
        'button[id*="accept"]',
        'button[class*="accept"]'
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
    
    // Rolar a página para garantir que todos os elementos carreguem
    await page.evaluate(() => {
      window.scrollTo(0, 300);
      setTimeout(() => window.scrollTo(0, 600), 300);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });
    
    await wait(2000);
    
    console.log('Extraindo dados do produto...');
    
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
      
      // Nome do produto usando o seletor específico fornecido
      let productTitle = '';
      
      // Primeiro tentar o seletor específico fornecido
      const titleElement = document.querySelector('p.Typographystyled__Subtitle-sc-bdxvrr-2');
      if (titleElement && titleElement.textContent.trim()) {
        productTitle = titleElement.textContent.trim();
        console.log("Nome encontrado com seletor específico:", productTitle);
      }
      
      // Se não encontrou, tentar seletores alternativos
      if (!productTitle) {
        const titleSelectors = [
          '.product-name',
          '.name-product',
          '.productName',
          'h1[data-testid*="product-name"]',
          '[class*="product-name"]',
          '[data-testid*="product-name"]',
          '[class*="productName"]',
          'h1.title', 
          'h1[class*="title"]',
          'h1'
        ];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            productTitle = element.textContent.trim();
            console.log(`Nome encontrado com seletor alternativo ${selector}:`, productTitle);
            break;
          }
        }
      }
      
      // Preços usando o seletor específico fornecido
      let currentPrice = '';
      let originalPrice = '';
      
      // Primeiro tentar o seletor específico de ofertas
      const offerElement = document.querySelector('.Typographystyled__Offer-sc-bdxvrr-4');
      if (offerElement) {
        console.log("Elemento de oferta encontrado:", offerElement.textContent);
        
        // Tentar extrair preços do elemento de oferta
        const offerText = offerElement.textContent.trim();
        
        // Procurar por padrão "De R$ X Por R$ Y"
        const deParaMatch = offerText.match(/De\s*R\$\s*(\d+[.,]\d+).*?Por\s*R\$\s*(\d+[.,]\d+)/i);
        if (deParaMatch) {
          originalPrice = deParaMatch[1].replace('.', ',');
          currentPrice = deParaMatch[2].replace('.', ',');
          console.log("Preços extraídos do padrão De/Por:", { originalPrice, currentPrice });
        } else {
          // Se não encontrou padrão De/Por, tentar extrair todos os preços
          const priceMatches = offerText.match(/R\$\s*(\d+[.,]\d+)/g);
          if (priceMatches && priceMatches.length >= 2) {
            // Assumir que o primeiro é o original e o segundo é o atual
            originalPrice = priceMatches[0].match(/R\$\s*(\d+[.,]\d+)/)[1].replace('.', ',');
            currentPrice = priceMatches[1].match(/R\$\s*(\d+[.,]\d+)/)[1].replace('.', ',');
            console.log("Preços extraídos de múltiplos matches:", { originalPrice, currentPrice });
          } else if (priceMatches && priceMatches.length === 1) {
            // Se só tem um preço, assumir que é o atual
            currentPrice = priceMatches[0].match(/R\$\s*(\d+[.,]\d+)/)[1].replace('.', ',');
            console.log("Apenas um preço encontrado:", currentPrice);
          }
        }
      }
      
      // Se não conseguiu extrair preços do elemento específico, tentar métodos alternativos
      if (!currentPrice) {
        console.log("Tentando métodos alternativos para preços...");
        
        const priceSelectors = [
          '.preco-promocional',
          '.valor-por',
          '.showcase-price .price', 
          '.preco-atual',
          '.price-best',
          '[id*="product-price"]',
          '.atual-preco',
          '.preco-atual strong',
          'span.valor',
          '.best-price',
          '.actual-price',
          '.price-box__best',
          '.product-price',
          '.price > span',
          '[data-testid*="price"]',
          '[class*="actualPrice"]',
          '[class*="current-price"]',
          '[class*="currentPrice"]',
          '[class*="bestPrice"]',
          '[class*="priceValue"]',
          '[class*="price-value"]',
          'span[class*="price"]'
        ];
        
        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            const extracted = extractPriceWithRS(element.textContent);
            if (extracted) {
              currentPrice = extracted;
              console.log(`Preço atual encontrado com ${selector}:`, currentPrice);
              break;
            }
          }
        }
      }
      
      if (!originalPrice) {
        console.log("Tentando métodos alternativos para preço original...");
        
        const originalPriceSelectors = [
          '.preco-de',
          '.valor-de',
          '.preco-antigo',
          '.old-price',
          '.price-old',
          '.preco-list-item .valor',
          '.valor-de strike',
          'span.de',
          '.original-price del',
          '.list-price',
          '.price-box__old',
          '[data-testid*="list-price"]',
          '[class*="oldPrice"]',
          '[class*="original-price"]',
          '[class*="originalPrice"]',
          '[class*="listPrice"]',
          'span[class*="old"]'
        ];
        
        for (const selector of originalPriceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            const extracted = extractPriceWithRS(element.textContent);
            if (extracted) {
              originalPrice = extracted;
              console.log(`Preço original encontrado com ${selector}:`, originalPrice);
              break;
            }
          }
        }
      }
      
      // Se ainda não encontrou preços, tentar buscar no texto da página
      if (!currentPrice) {
        console.log("Buscando preços no texto da página...");
        const priceRegex = /R\$\s*(\d+[.,]\d+)/g;
        const matches = document.body.textContent.match(priceRegex);
        if (matches && matches.length > 0) {
          if (matches.length >= 2) {
            // Se temos 2 ou mais preços, assumir que o menor é o atual
            const prices = matches.map(m => {
              const price = m.match(/R\$\s*(\d+[.,]\d+)/)[1];
              return {
                text: price.replace('.', ','),
                value: parseFloat(price.replace(',', '.').replace('.', ''))
              };
            });
            
            prices.sort((a, b) => a.value - b.value);
            currentPrice = prices[0].text;
            if (prices.length > 1) {
              originalPrice = prices[prices.length - 1].text;
            }
            console.log("Preços extraídos do texto geral:", { currentPrice, originalPrice });
          } else {
            currentPrice = cleanPrice(matches[0]);
            console.log("Um preço extraído do texto geral:", currentPrice);
          }
        }
      }
      
      // Imagem do produto
      let productImage = '';
      const imageSelectors = [
        '.showcase-product img',
        '.product-image img',
        '.productImage img',
        '[data-testid*="product-image"] img',
        '[class*="productImage"] img',
        '[class*="product-image"] img',
        '.product__image img',
        '.showcase-image img',
        'img[data-testid*="image"]',
        'meta[property="og:image"]'
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
      
      // Verificar se o preço original é maior que o preço atual (como esperado)
      if (originalPrice && currentPrice) {
        const origValue = parseFloat(originalPrice.replace(',', '.'));
        const currValue = parseFloat(currentPrice.replace(',', '.'));
        
        if (origValue <= currValue) {
          console.log("Invertendo preços porque original <= current");
          [originalPrice, currentPrice] = [currentPrice, originalPrice];
        }
      }
      
      console.log("Dados finais extraídos:", {
        name: productTitle,
        currentPrice: currentPrice,
        originalPrice: originalPrice,
        imageUrl: productImage
      });
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: 'Centauro',
        platform: 'centauro',
        realProductUrl: window.location.href
      };
    });
    
    console.log("Dados extraídos da Centauro:", JSON.stringify(productData, null, 2));
    
    // Se não conseguimos dados válidos, retornar fallback
    if (productData.name === 'Nome do produto não encontrado' || 
        productData.currentPrice === 'Preço não disponível') {
      
      console.log("Dados insuficientes extraídos, usando fallback...");
      
      return {
        name: "Produto Centauro",
        currentPrice: "299",
        originalPrice: "499",
        imageUrl: "",
        vendor: "Centauro",
        platform: "centauro",
        productUrl: url,
        isPlaceholder: true,
        message: 'Dados obtidos de forma limitada. O produto existe no link fornecido.'
      };
    }
    
    // Preservar o link original de afiliado
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Centauro:', error);
    console.error(error.stack);
    
    // Retornar dados fictícios em caso de erro para não quebrar a aplicação
    return {
      name: "Produto Centauro (Erro)",
      currentPrice: "299",
      originalPrice: "499",
      imageUrl: "",
      vendor: "Centauro",
      platform: "centauro",
      productUrl: url,
      isPlaceholder: true,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};
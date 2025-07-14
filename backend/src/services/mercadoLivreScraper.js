const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.scrapeProductData = async (url) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-features=site-per-process',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    
    // OTIMIZAÇÃO AGRESSIVA: Sempre bloquear recursos desnecessários
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9'
    });
    await page.setCacheEnabled(false);
    
    console.log(`Navegando para URL: ${url}`);
    
    // OTIMIZAÇÃO AGRESSIVA: domcontentloaded + timeout reduzido
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    // OTIMIZAÇÃO AGRESSIVA: Wait mínimo
    await wait(1000);
    
    let currentUrl = page.url();
    console.log(`URL após redirecionamento inicial: ${currentUrl}`);
    
    const isSocialPage = currentUrl.includes('/social/') || currentUrl.includes('forceInApp=true');
    
    if (isSocialPage) {
      console.log('Detectada página social. Procurando produto principal...');
      
      const productFound = await page.evaluate(() => {
        const verProdutoButtons = Array.from(document.querySelectorAll('a, button')).filter(el => {
          return el.textContent.trim().toLowerCase() === 'ver produto';
        });
        
        if (verProdutoButtons.length > 0) {
          // OTIMIZAÇÃO: Pegar o primeiro sem ordenar
          verProdutoButtons[0].click();
          return true;
        }
        
        return false;
      });
      
      if (productFound) {
        console.log('Botão "Ver produto" encontrado e clicado.');
        
        try {
          // OTIMIZAÇÃO AGRESSIVA: Timeout muito reduzido
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
        } catch (e) {
          // OTIMIZAÇÃO: Wait mínimo
          await wait(1000);
        }
        
        currentUrl = page.url();
        console.log(`Nova URL após clicar no botão: ${currentUrl}`);
      } else {
        console.log('Botão "Ver produto" não encontrado. Tentando alternativas...');
        
        const mainProductUrl = await page.evaluate(() => {
          const productLinks = Array.from(document.querySelectorAll('a[href*="produto.mercadolivre"], a[href*="/p/MLB"]'))
            .filter(link => link.href && (
              link.href.includes('produto.mercadolivre.com.br/MLB-') || 
              link.href.includes('/p/MLB')
            ));
          
          return productLinks.length > 0 ? productLinks[0].href : null;
        });
        
        if (mainProductUrl) {
          console.log(`Link direto encontrado: ${mainProductUrl}`);
          await page.goto(mainProductUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await wait(500);
          currentUrl = page.url();
        }
      }
    }
    
    // OTIMIZAÇÃO: Verificação simplificada
    const isProductPage = await page.evaluate(() => {
      return document.querySelector('.ui-pdp-title') !== null && 
             document.querySelector('.andes-money-amount') !== null;
    });
    
    console.log(`Verificação de página de produto: ${isProductPage ? 'É uma página de produto' : 'Não é uma página de produto'}`);
    
    if (!isProductPage) {
      const productLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
          .filter(a => a.href && (
            a.href.includes('produto.mercadolivre.com.br/MLB-') ||
            a.href.includes('mercadolivre.com.br/p/MLB')
          ));
        return links.length > 0 ? links[0].href : null;
      });
      
      if (productLink) {
        console.log(`Link MLB encontrado: ${productLink}`);
        await page.goto(productLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await wait(500);
      }
    }
    
    // OTIMIZAÇÃO: Scroll mínimo
    await page.evaluate(() => window.scrollTo(0, 300));
    await wait(200);
    
    // MANTER A LÓGICA DE EXTRAÇÃO ORIGINAL (sem mudanças)
    const productData = await page.evaluate(() => {
      const cleanPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d,]/g, '').trim();
      };
      
      const productTitle = 
        document.querySelector('.ui-pdp-title')?.textContent.trim() || 
        document.querySelector('h1[class*="ui-pdp-title"]')?.textContent.trim() ||
        document.querySelector('h1')?.textContent.trim();
      
      let currentPrice = '';
      
      const priceWithDiscountElement = document.querySelector('.andes-money-amount.andes-money-amount--cents.ui-pdp-price__part');
      if (priceWithDiscountElement) {
        const integerPart = priceWithDiscountElement.querySelector('.andes-money-amount__fraction')?.textContent.trim() || '';
        const centsPart = priceWithDiscountElement.querySelector('.andes-money-amount__cents')?.textContent.trim() || '00';
        currentPrice = `${integerPart},${centsPart}`;
      }
      
      if (!currentPrice || currentPrice === ',00') {
        const priceElement = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction');
        if (priceElement) {
          const integerPart = priceElement.textContent.trim();
          const centsPart = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__cents')?.textContent.trim() || '00';
          currentPrice = `${integerPart},${centsPart}`;
        }
      }
      
      if (!currentPrice || currentPrice === ',00') {
        const priceFull = document.querySelector('.andes-money-amount')?.textContent.trim();
        if (priceFull) {
          currentPrice = cleanPrice(priceFull);
        }
      }
      
      let originalPrice = '';
      const originalPriceElement = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__fraction');
      if (originalPriceElement) {
        const integerPart = originalPriceElement.textContent.trim();
        const centsPart = document.querySelector('.ui-pdp-price__original-value .andes-money-amount__cents')?.textContent.trim() || '00';
        originalPrice = `${integerPart},${centsPart}`;
      }
      
      if (!originalPrice) {
        const originalPriceAlt = document.querySelector('.ui-pdp-price__original-value');
        if (originalPriceAlt) {
          originalPrice = cleanPrice(originalPriceAlt.textContent);
        }
      }
      
      const productImage = 
        document.querySelector('.ui-pdp-gallery__figure img')?.src ||
        document.querySelector('.ui-pdp-image')?.src ||
        document.querySelector('[class*="ui-pdp-gallery"] img')?.src;
      
      const vendorElement = 
        document.querySelector('.ui-pdp-seller__header__title') || 
        document.querySelector('[class*="seller-info"] [class*="title"]');
      const vendor = vendorElement ? vendorElement.textContent.trim() : 'Mercado Livre';
      
      const isOfficialStore = 
        document.querySelector('.ui-pdp-seller__header-status .ui-pdp-official-store-label') !== null;
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: vendor,
        isOfficialStore: isOfficialStore,
        realProductUrl: window.location.href
      };
    });
    
    console.log("Dados extraídos:", JSON.stringify(productData, null, 2));
    
    // OTIMIZAÇÃO: Remover toda a lógica de fallback que demora muito
    // Se não conseguiu extrair, falhar rápido
    
    productData.productUrl = url;
    return productData;
    
  } catch (error) {
    console.error('Erro ao fazer scraping no Mercado Livre:', error);
    throw new Error(`Falha ao extrair dados do produto no Mercado Livre: ${error.message}`);
  } finally {
    await browser.close();
  }
};
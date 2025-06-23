// backend/src/services/amazonScraper.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Usar stealth plugin
puppeteer.use(StealthPlugin());

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
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ],
    ignoreDefaultArgs: ['--disable-extensions']
  });
  
  try {
    const page = await browser.newPage();
    
    // User agent mais atualizado
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Headers extras
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });
    
    console.log(`Navegando para Amazon: ${url}`);
    
    // Navegação mais robusta
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    // Aguardar carregamento
    await wait(4000);
    
    // Extrair dados com seletores corretos baseados no debug
    const productData = await page.evaluate(() => {
      // Função para extrair apenas os números do preço (sem centavos)
      const extractPrice = (priceText) => {
        if (!priceText) return '';
        // Extrair só a parte inteira (284 de R$284,90)
        const match = priceText.match(/R?\$?\s*(\d+)/);
        return match ? match[1] : priceText.replace(/[^\d]/g, '');
      };
      
      // Nome do produto - CONFIRMADO NO DEBUG ✅
      const productTitle = document.querySelector('#productTitle')?.textContent.trim();
      console.log(`[AMAZON] Nome extraído: "${productTitle}"`);
      
      // PREÇO ATUAL - SELETORES CORRETOS BASEADOS NO DEBUG
      let currentPrice = '';
      
      // Seletor principal: elemento 35 do debug ✅
      const mainPriceElement = document.querySelector('.a-price.aok-align-center.reinventPricePriceToPayMargin.priceToPay');
      if (mainPriceElement) {
        const priceText = mainPriceElement.textContent.trim();
        console.log(`[AMAZON] ✅ Preço principal encontrado: "${priceText}"`);
        currentPrice = extractPrice(priceText);
      }
      
      // Fallback 1: Seletor que funcionou no debug ✅
      if (!currentPrice) {
        const fallback1 = document.querySelector('.reinventPricePriceToPayMargin > span:nth-child(2)');
        if (fallback1) {
          const priceText = fallback1.textContent.trim();
          console.log(`[AMAZON] ✅ Fallback 1 encontrado: "${priceText}"`);
          currentPrice = extractPrice(priceText);
        }
      }
      
      // Fallback 2: Buscar por qualquer reinventPrice
      if (!currentPrice) {
        const fallback2 = document.querySelector('[class*="reinventPrice"]');
        if (fallback2) {
          const priceText = fallback2.textContent.trim();
          console.log(`[AMAZON] ✅ Fallback 2 encontrado: "${priceText}"`);
          currentPrice = extractPrice(priceText);
        }
      }
      
      // Fallback 3: Elemento 0 do debug (genérico)
      if (!currentPrice) {
        const fallback3 = document.querySelector('.a-price.aok-align-center');
        if (fallback3) {
          const priceText = fallback3.textContent.trim();
          if (priceText.includes('R$') && priceText.match(/\d+,\d+/)) {
            console.log(`[AMAZON] ✅ Fallback 3 encontrado: "${priceText}"`);
            currentPrice = extractPrice(priceText);
          }
        }
      }
      
      // Fallback 4: Buscar em TODOS os elementos de preço
      if (!currentPrice) {
        const allPriceElements = document.querySelectorAll('.a-price');
        for (const element of allPriceElements) {
          const text = element.textContent.trim();
          if (text.includes('R$') && text.match(/\d+,\d+/) && text.includes('284')) {
            console.log(`[AMAZON] ✅ Fallback 4 encontrado: "${text}"`);
            currentPrice = extractPrice(text);
            break;
          }
        }
      }
      
      // PREÇO ORIGINAL (riscado) - melhorado
      let originalPrice = '';
      
      // Procurar por preços riscados
      const originalPriceSelectors = [
        '.a-text-price .a-offscreen',
        '.a-price.a-text-price .a-offscreen',
        'span[style*="text-decoration: line-through"]',
        's .a-price-whole',
        's',
        'del'
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const priceText = element.textContent.trim();
          if (priceText.includes('R$')) {
            const extractedPrice = extractPrice(priceText);
            // Só considerar como original se for MAIOR que o atual
            if (extractedPrice && parseInt(extractedPrice) > parseInt(currentPrice || 0)) {
              originalPrice = extractedPrice;
              console.log(`[AMAZON] ✅ Preço original encontrado: ${originalPrice}`);
              break;
            }
          }
        }
      }
      
      // Se não encontrou preço original, procurar por padrões "De R$ X"
      if (!originalPrice) {
        const bodyText = document.body.textContent;
        const deRegexMatch = bodyText.match(/De\s*R\$\s*(\d+)/);
        if (deRegexMatch) {
          const dePrice = deRegexMatch[1];
          if (parseInt(dePrice) > parseInt(currentPrice || 0)) {
            originalPrice = dePrice;
            console.log(`[AMAZON] ✅ Preço original via regex: ${originalPrice}`);
          }
        }
      }
      
      // Imagem do produto
      const productImage = document.querySelector('#landingImage')?.src || 
                          document.querySelector('#imgBlkFront')?.src ||
                          document.querySelector('.a-dynamic-image')?.src ||
                          '';
      
      const result = {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage,
        vendor: 'Amazon'
      };
      
      console.log('[AMAZON] ✅ Resultado final:', result);
      return result;
    });
    
    // Adicionar URL do produto
    productData.productUrl = url;
    
    console.log('Dados finais da Amazon:', JSON.stringify(productData, null, 2));
    return productData;
    
  } catch (error) {
    console.error('Erro no scraper Amazon:', error);
    throw new Error('Falha ao extrair dados do produto na Amazon');
  } finally {
    await browser.close();
  }
};
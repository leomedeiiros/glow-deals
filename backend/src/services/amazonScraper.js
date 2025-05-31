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
    
    // Extrair dados com seletores específicos
    const productData = await page.evaluate(() => {
      // Função para limpar preço (só números inteiros)
      const formatPrice = (price) => {
        if (!price) return '';
        return price.replace(/[^\d]/g, '').slice(0, -2) || price.replace(/[^\d]/g, '');
      };
      
      // Nome do produto
      const productTitle = document.querySelector('#productTitle')?.textContent.trim();
      
      // PREÇO ATUAL - usando o seletor específico que você passou
      let currentPrice = '';
      
      // Seu seletor específico primeiro
      const specificSelector = '#apex_desktop_newAccordionRow > div:nth-child(1) > div:nth-child(3) > div:nth-child(3)';
      const specificElement = document.querySelector(specificSelector);
      
      if (specificElement && specificElement.textContent) {
        const priceText = specificElement.textContent.trim();
        console.log(`Texto do seletor específico: "${priceText}"`);
        
        // Extrair o preço principal (R$ 37,97)
        const priceMatch = priceText.match(/R\$\s*(\d+),\d+/);
        if (priceMatch) {
          currentPrice = priceMatch[1];
          console.log(`Preço extraído: ${currentPrice}`);
        }
      }
      
      // Fallback se não encontrou
      if (!currentPrice) {
        const fallbackSelectors = [
          '.a-price.priceToPay .a-offscreen',
          '.a-price .a-offscreen',
          '#priceblock_ourprice',
          '#priceblock_dealprice'
        ];
        
        for (const selector of fallbackSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const priceText = element.textContent.trim();
            if (priceText.includes('R$')) {
              const priceMatch = priceText.match(/R\$\s*(\d+)/);
              if (priceMatch) {
                currentPrice = priceMatch[1];
                console.log(`Preço fallback: ${currentPrice}`);
                break;
              }
            }
          }
        }
      }
      
      // PREÇO ORIGINAL (riscado) - mais conservador
      let originalPrice = '';
      
      const originalSelectors = [
        '.a-text-price .a-offscreen',
        '.a-price.a-text-price .a-offscreen'
      ];
      
      for (const selector of originalSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const priceText = element.textContent.trim();
          if (priceText.includes('R$')) {
            const priceMatch = priceText.match(/R\$\s*(\d+)/);
            if (priceMatch) {
              const price = priceMatch[1];
              // Só considerar como original se for MAIOR que o atual
              if (parseInt(price) > parseInt(currentPrice)) {
                originalPrice = price;
                console.log(`Preço original: ${originalPrice}`);
                break;
              }
            }
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
      
      console.log('Resultado Amazon:', result);
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
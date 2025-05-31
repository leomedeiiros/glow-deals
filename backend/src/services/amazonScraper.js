// backend/src/services/amazonScraper.js
const puppeteer = require('puppeteer');

exports.scrapeProductData = async (url) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    ignoreDefaultArgs: ['--disable-extensions']
  });
  
  try {
    const page = await browser.newPage();
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // Extrair dados do produto
    const productData = await page.evaluate(() => {
      // Função para limpar preço
      const cleanPrice = (price) => {
        if (!price) return '';
        // Remove "R$" e espaços, mantém apenas números, vírgulas e pontos
        return price.replace(/R\$\s*/g, '').replace(/[^\d,\.]/g, '').trim();
      };
      
      // Função para formatar preço (remover centavos)
      const formatPrice = (price) => {
        if (!price) return '';
        let cleanedPrice = cleanPrice(price);
        
        // Se tem vírgula (formato brasileiro), pegar só a parte antes da vírgula
        if (cleanedPrice.includes(',')) {
          return cleanedPrice.split(',')[0];
        }
        
        // Se tem ponto (formato americano), pegar só a parte antes do ponto
        if (cleanedPrice.includes('.')) {
          return cleanedPrice.split('.')[0];
        }
        
        return cleanedPrice;
      };
      
      // Nome do produto
      const productTitle = document.querySelector('#productTitle')?.textContent.trim();
      
      // Preço atual - múltiplos seletores para maior compatibilidade
      let currentPrice = '';
      
      const currentPriceSelectors = [
        // Novos seletores mais específicos
        'span.reinventPricePriceToPayMargin:nth-child(2) > span:nth-child(2)',
        '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
        '.a-price.priceToPay .a-offscreen',
        
        // Seletores tradicionais
        '.a-price .a-offscreen',
        '.priceToPay .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        
        // Seletores alternativos
        'span.a-price-whole',
        '.a-price-whole',
        '.a-size-medium.a-color-price.priceBlockBuyingPriceString',
        'span[data-a-size="xl"] .a-offscreen',
        'span[data-a-size="large"] .a-offscreen',
        
        // Seletores mais genéricos (backup)
        '[class*="price"] .a-offscreen',
        '[class*="Price"] .a-offscreen'
      ];
      
      for (const selector of currentPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const priceText = element.textContent.trim();
          if (priceText.includes('R$') || /\d+[,\.]\d+/.test(priceText)) {
            currentPrice = formatPrice(priceText);
            console.log(`Preço encontrado com seletor ${selector}: ${priceText} -> ${currentPrice}`);
            break;
          }
        }
      }
      
      // Se ainda não encontrou, tentar buscar no HTML por padrões de preço
      if (!currentPrice) {
        const allText = document.body.innerText;
        const priceMatches = allText.match(/R\$\s*(\d+[,\.]\d+)/g);
        if (priceMatches && priceMatches.length > 0) {
          // Pegar o primeiro preço encontrado que pareça ser o principal
          for (const match of priceMatches) {
            const price = formatPrice(match);
            if (price && parseInt(price) > 0) {
              currentPrice = price;
              console.log(`Preço extraído do texto: ${match} -> ${currentPrice}`);
              break;
            }
          }
        }
      }
      
      // Preço original (riscado) - múltiplos seletores
      let originalPrice = '';
      
      const originalPriceSelectors = [
        // Seletores para preço riscado/original
        '.a-text-price .a-offscreen',
        '.a-price.a-text-price span.a-offscreen',
        '.a-price.a-text-price .a-offscreen',
        'span.a-price.a-text-price .a-offscreen',
        
        // Seletores alternativos
        '.a-text-strike .a-offscreen',
        'span[data-a-strike="true"] .a-offscreen',
        '.a-price-was .a-offscreen',
        '.a-size-small.a-color-secondary .a-offscreen',
        
        // Backup genérico
        '[class*="was"] .a-offscreen',
        '[class*="strike"] .a-offscreen'
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const priceText = element.textContent.trim();
          if (priceText.includes('R$') || /\d+[,\.]\d+/.test(priceText)) {
            originalPrice = formatPrice(priceText);
            console.log(`Preço original encontrado com seletor ${selector}: ${priceText} -> ${originalPrice}`);
            break;
          }
        }
      }
      
      // Se encontrou o mesmo preço para ambos, limpar o original
      if (originalPrice && currentPrice && originalPrice === currentPrice) {
        originalPrice = '';
      }
      
      // Imagem do produto
      const productImage = document.querySelector('#landingImage')?.src || 
                          document.querySelector('#imgBlkFront')?.src ||
                          document.querySelector('#main-image')?.src ||
                          document.querySelector('img[data-a-image-name="landingImage"]')?.src;
      
      return {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: 'Amazon'
      };
    });
    
    // Log para debug
    console.log('Dados extraídos da Amazon:', JSON.stringify(productData, null, 2));
    
    // Adicionar URL do produto
    productData.productUrl = url;
    
    return productData;
  } catch (error) {
    console.error('Erro ao fazer scraping na Amazon:', error);
    throw new Error('Falha ao extrair dados do produto na Amazon');
  } finally {
    await browser.close();
  }
};
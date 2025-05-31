// backend/src/services/amazonScraper.js
const puppeteer = require('puppeteer');

// Função auxiliar para aguardar
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Configurar viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log(`Navegando para URL da Amazon: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
    
    // Aguardar carregamento adicional
    await wait(3000);
    
    // Rolar a página para garantir carregamento
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    
    await wait(2000);
    
    // Extrair dados do produto com melhor detecção
    const productData = await page.evaluate(() => {
      console.log('Iniciando extração de dados na página da Amazon...');
      
      // Função para limpar e formatar preço
      const cleanAndFormatPrice = (priceText) => {
        if (!priceText) return '';
        console.log(`Limpando preço: "${priceText}"`);
        
        // Remove "R$", espaços extras e caracteres especiais, mantém números, vírgulas e pontos
        let cleaned = priceText.replace(/R\$\s*/g, '').replace(/[^\d,\.]/g, '').trim();
        
        // Se tem vírgula (formato brasileiro 37,97), pegar só a parte inteira
        if (cleaned.includes(',')) {
          const parts = cleaned.split(',');
          cleaned = parts[0];
        }
        
        // Se tem ponto (formato americano ou separador de milhares), tratar adequadamente
        if (cleaned.includes('.')) {
          // Se tem apenas um ponto e dois dígitos depois, é decimal (ex: 37.97)
          if (cleaned.match(/^\d+\.\d{2}$/)) {
            cleaned = cleaned.split('.')[0];
          }
          // Se tem múltiplos pontos ou formato de milhares (1.234.567), remover pontos
          else if (cleaned.match(/\d{1,3}(\.\d{3})+/)) {
            cleaned = cleaned.replace(/\./g, '');
          }
        }
        
        console.log(`Preço limpo: "${cleaned}"`);
        return cleaned;
      };
      
      // Função para validar se um preço faz sentido
      const isValidPrice = (price) => {
        if (!price) return false;
        const numPrice = parseInt(price);
        return !isNaN(numPrice) && numPrice > 0 && numPrice < 100000; // Entre R$ 1 e R$ 100.000
      };
      
      // Nome do produto
      const productTitle = document.querySelector('#productTitle')?.textContent.trim();
      console.log(`Título encontrado: "${productTitle}"`);
      
      // Lista de seletores para preço atual (do mais específico ao mais genérico)
      const currentPriceSelectors = [
        // Seletores específicos para o novo layout
        'span.reinventPricePriceToPayMargin span.a-price-whole',
        'span.reinventPricePriceToPayMargin .a-offscreen',
        '.a-price.priceToPay .a-offscreen',
        '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
        
        // Seletores tradicionais
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        
        // Seletores alternativos
        'span.a-price-whole',
        '.a-price-whole',
        '.a-size-medium.a-color-price.priceBlockBuyingPriceString',
        
        // Seletores por atributos de dados
        '[data-a-size="xl"] .a-offscreen',
        '[data-a-size="large"] .a-offscreen',
        
        // Seletores genéricos
        '[class*="price"] .a-offscreen:first-child',
        'span[class*="price-"] .a-offscreen'
      ];
      
      let currentPrice = '';
      let foundPrices = [];
      
      // Testar todos os seletores e coletar os preços encontrados
      for (const selector of currentPriceSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element && element.textContent) {
              const priceText = element.textContent.trim();
              const cleanedPrice = cleanAndFormatPrice(priceText);
              
              if (isValidPrice(cleanedPrice)) {
                foundPrices.push({
                  selector: selector,
                  originalText: priceText,
                  cleanedPrice: cleanedPrice,
                  value: parseInt(cleanedPrice)
                });
                console.log(`Preço encontrado com ${selector}: "${priceText}" -> "${cleanedPrice}"`);
              }
            }
          }
        } catch (e) {
          console.log(`Erro com seletor ${selector}:`, e);
        }
      }
      
      // Se encontrou preços, escolher o mais provável (geralmente o maior entre os válidos)
      if (foundPrices.length > 0) {
        // Ordenar por valor (maior primeiro) e pegar o primeiro que faça sentido
        foundPrices.sort((a, b) => b.value - a.value);
        currentPrice = foundPrices[0].cleanedPrice;
        console.log(`Preço escolhido: ${currentPrice} de ${foundPrices.length} opções`);
        console.log('Todos os preços encontrados:', foundPrices);
      }
      
      // Se ainda não encontrou, fazer busca manual no texto da página
      if (!currentPrice) {
        console.log('Fazendo busca manual por preços na página...');
        const pageText = document.body.innerText;
        const priceMatches = pageText.match(/R\$\s*(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/g);
        
        if (priceMatches && priceMatches.length > 0) {
          console.log('Preços encontrados no texto:', priceMatches);
          
          const validPrices = [];
          for (const match of priceMatches) {
            const cleaned = cleanAndFormatPrice(match);
            if (isValidPrice(cleaned)) {
              validPrices.push({
                original: match,
                cleaned: cleaned,
                value: parseInt(cleaned)
              });
            }
          }
          
          if (validPrices.length > 0) {
            // Filtrar preços que fazem sentido para o produto (entre R$ 10 e R$ 500 para suplementos)
            const sensiblePrices = validPrices.filter(p => p.value >= 10 && p.value <= 500);
            
            if (sensiblePrices.length > 0) {
              // Pegar o preço mais comum ou o primeiro válido
              sensiblePrices.sort((a, b) => b.value - a.value);
              currentPrice = sensiblePrices[0].cleaned;
              console.log(`Preço extraído do texto: ${currentPrice}`);
            }
          }
        }
      }
      
      // Preço original (riscado) - seletores específicos
      let originalPrice = '';
      const originalPriceSelectors = [
        '.a-text-price .a-offscreen',
        '.a-price.a-text-price .a-offscreen',
        'span.a-price.a-text-price .a-offscreen',
        '.a-text-strike .a-offscreen',
        'span[data-a-strike="true"] .a-offscreen',
        '.a-price-was .a-offscreen'
      ];
      
      for (const selector of originalPriceSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const priceText = element.textContent.trim();
            const cleanedPrice = cleanAndFormatPrice(priceText);
            
            if (isValidPrice(cleanedPrice) && cleanedPrice !== currentPrice) {
              originalPrice = cleanedPrice;
              console.log(`Preço original encontrado: ${originalPrice}`);
              break;
            }
          }
        } catch (e) {
          console.log(`Erro com seletor original ${selector}:`, e);
        }
      }
      
      // Imagem do produto
      const imageSelectors = [
        '#landingImage',
        '#imgBlkFront', 
        '#main-image',
        'img[data-a-image-name="landingImage"]',
        '.a-dynamic-image',
        'img[data-old-hires]'
      ];
      
      let productImage = '';
      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element && element.src) {
          productImage = element.src;
          break;
        }
      }
      
      const result = {
        name: productTitle || 'Nome do produto não encontrado',
        currentPrice: currentPrice || 'Preço não disponível',
        originalPrice: originalPrice || null,
        imageUrl: productImage || '',
        vendor: 'Amazon'
      };
      
      console.log('Resultado final da extração:', result);
      return result;
    });
    
    // Log detalhado para debug
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
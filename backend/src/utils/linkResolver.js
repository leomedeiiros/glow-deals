// backend/src/utils/linkResolver.js
const puppeteer = require('puppeteer');

// Função auxiliar para substituir waitForTimeout
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.resolveUrl = async (shortenedUrl) => {
  // Verificar se é um link do Mercado Livre no formato sec
  if (shortenedUrl.includes('mercadolivre.com/sec/') || shortenedUrl.includes('mercadolibre.com/sec/')) {
    console.log(`Link do Mercado Livre detectado: ${shortenedUrl}`);
    return shortenedUrl; // Mantém o link original para links de afiliado do Mercado Livre
  }
  
  // Verificar se é link de afiliado da Awin (Centauro/Nike)
  if (shortenedUrl.includes('tidd.ly/3Ey3rLE') || shortenedUrl.includes('tidd.ly/4cvXuvd')) {
    console.log(`Link de afiliado Awin detectado: ${shortenedUrl}`);
    return shortenedUrl; // Mantém o link original para links de afiliado da Awin
  }
  
  // Verificar se é link de afiliado da Rakuten (Netshoes)
  if (shortenedUrl.includes('tiny.cc/ebah001')) {
    console.log(`Link de afiliado Rakuten detectado: ${shortenedUrl}`);
    return shortenedUrl; // Mantém o link original para links de afiliado da Rakuten
  }
  
  // Verificar se é link da Shopee
  if (shortenedUrl.includes('shopee.com.br')) {
    console.log(`Link da Shopee detectado: ${shortenedUrl}`);
    return shortenedUrl; // Mantém o link original para links da Shopee
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    // Remover a referência ao executável externo
    ignoreDefaultArgs: ['--disable-extensions'],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    console.log(`Resolvendo URL: ${shortenedUrl}`);
    const page = await browser.newPage();
    
    // Definir user agent para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Desativar navegação para recursos não necessários
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'stylesheet', 'font', 'script'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Capturar redirecionamentos
    let allRedirects = [];
    page.on('response', response => {
      if (response.status() >= 300 && response.status() <= 399) {
        const location = response.headers()['location'];
        if (location) {
          allRedirects.push(location);
          console.log(`Redirecionamento detectado: ${location}`);
        }
      }
    });
    
    // Configurar timeout para 90 segundos
    await page.goto(shortenedUrl, { 
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    // Usar função wait em vez de waitForTimeout
    await wait(3000);
    
    const resolvedUrl = page.url();
    console.log(`URL resolvida: ${resolvedUrl}`);
    
    // CORREÇÃO: Para links da Nike, tentar forçar redirecionamento para .com.br
    if (resolvedUrl.includes('nike.com') && !resolvedUrl.includes('nike.com.br')) {
      console.log(`Detectado link Nike internacional, tentando versão brasileira...`);
      
      // Extrair o path do produto
      const productMatch = resolvedUrl.match(/nike\.com(\/[^?]+)/);
      if (productMatch && productMatch[1]) {
        const productPath = productMatch[1];
        
        // Tentar construir URL brasileira
        let brazilianUrl = `https://www.nike.com.br${productPath}`;
        
        // Se tem parâmetros na URL original, preservar alguns importantes
        const urlParams = new URL(resolvedUrl);
        if (urlParams.searchParams.get('cor')) {
          brazilianUrl += `?cor=${urlParams.searchParams.get('cor')}`;
        }
        
        console.log(`Tentando URL brasileira: ${brazilianUrl}`);
        
        // Verificar se a URL brasileira funciona
        try {
          const testPage = await browser.newPage();
          await testPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
          
          const response = await testPage.goto(brazilianUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          if (response.status() === 200) {
            const pageContent = await testPage.evaluate(() => {
              return {
                title: document.title,
                hasError: document.body.textContent.includes('Page not found') || 
                         document.body.textContent.includes('Error') ||
                         document.title.includes('Page not found'),
                bodyLength: document.body.innerHTML.length
              };
            });
            
            if (!pageContent.hasError && pageContent.bodyLength > 5000) {
              console.log(`✅ URL brasileira válida encontrada: ${brazilianUrl}`);
              await testPage.close();
              return brazilianUrl;
            }
          }
          
          await testPage.close();
        } catch (error) {
          console.log(`❌ Erro ao testar URL brasileira: ${error.message}`);
        }
      }
    }
    
    // Para links da Amazon, manter o formato original
    if (resolvedUrl.includes('amazon.com') || resolvedUrl.includes('amazon.com.br')) {
      return resolvedUrl;
    }
    
    // Para links do Mercado Livre, verificar formato especial
    if (resolvedUrl.includes('mercadolivre.com.br') || resolvedUrl.includes('mercadolibre.com')) {
      // Verificar se o link é um link de produto
      const isProductPage = await page.evaluate(() => {
        return document.querySelector('.ui-pdp-title') !== null || 
               document.querySelector('h1[class*="ui-pdp-title"]') !== null;
      });
      
      if (isProductPage) {
        // Tentar extrair ID do produto para formar link de afiliado
        const productId = await page.evaluate(() => {
          // Tentar extrair do link canônico
          const canonicalLink = document.querySelector('link[rel="canonical"]')?.href || '';
          if (canonicalLink) {
            const matches = canonicalLink.match(/(?:MLA|MLB)-(\d+)/);
            if (matches && matches[1]) {
              return matches[1];
            }
          }
          
          // Tentar extrair do meta tag
          const metaItemId = document.querySelector('meta[name="twitter:app:url:iphone"]')?.content;
          if (metaItemId) {
            const matches = metaItemId.match(/item_id=(\d+)/);
            if (matches && matches[1]) {
              return matches[1];
            }
          }
          
          // Tentar extrair da URL
          const currentUrl = window.location.href;
          const urlMatches = currentUrl.match(/(?:MLA|MLB)-(\d+)/);
          if (urlMatches && urlMatches[1]) {
            return urlMatches[1];
          }
          
          return null;
        });
        
        if (productId) {
          console.log(`ID do produto extraído: ${productId}`);
          // Retornar um link de afiliado formatado corretamente
          // Substitua "1c8aViK" pelo código correto do seu programa de afiliados ou use um código aleatório
          const affiliateCode = shortenedUrl.includes('/sec/') ? 
            shortenedUrl.split('/sec/')[1] : 
            '1c8aViK'; // Código de exemplo, substitua pelo seu
          
          return `https://mercadolivre.com/sec/${affiliateCode}`;
        }
      }
    }
    
    // Para links da Centauro
    if (resolvedUrl.includes('centauro.com.br')) {
      return resolvedUrl;
    }
    
    // Para links da Netshoes
    if (resolvedUrl.includes('netshoes.com.br')) {
      return resolvedUrl;
    }
    
    // Para links da Nike - sempre retornar o que foi resolvido
    if (resolvedUrl.includes('nike.com.br') || resolvedUrl.includes('nike.com/br') || resolvedUrl.includes('nike.com')) {
      return resolvedUrl;
    }
    
    // Para links da Shopee
    if (resolvedUrl.includes('shopee.com.br')) {
      return resolvedUrl;
    }
    
    return resolvedUrl;
  } catch (error) {
    console.error('Erro ao resolver URL:', error);
    console.error(error.stack);
    // Se der erro, retorna a URL original
    return shortenedUrl;
  } finally {
    await browser.close();
  }
};
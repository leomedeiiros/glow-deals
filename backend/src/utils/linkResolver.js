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
    
    // CORREÇÃO: Para links da Nike, SEMPRE forçar redirecionamento para .com.br SEM VALIDAÇÃO
    if (resolvedUrl.includes('nike.com')) {
      console.log(`Detectado link Nike, convertendo para versão brasileira...`);
      
      // Extrair o path do produto
      let productPath = '';
      
      // Tentar extrair path de diferentes formatos de URL da Nike
      const pathPatterns = [
        /nike\.com\/(.+)/,  // Padrão geral
        /nike\.com\/([^?]+)/, // Sem parâmetros
      ];
      
      for (const pattern of pathPatterns) {
        const match = resolvedUrl.match(pattern);
        if (match && match[1]) {
          productPath = match[1];
          break;
        }
      }
      
      if (productPath) {
        // Limpar parâmetros desnecessários mas manter importantes
        const urlObj = new URL(resolvedUrl);
        const importantParams = ['cor', 'color', 'size'];
        let cleanPath = productPath.split('?')[0]; // Remove todos os parâmetros
        
        // Verificar se há parâmetros importantes para preservar
        let preservedParams = '';
        for (const param of importantParams) {
          const value = urlObj.searchParams.get(param);
          if (value) {
            preservedParams += preservedParams ? `&${param}=${value}` : `?${param}=${value}`;
          }
        }
        
        // Construir URL brasileira
        const brazilianUrl = `https://www.nike.com.br/${cleanPath}${preservedParams}`;
        
        console.log(`✅ URL brasileira construída: ${brazilianUrl}`);
        console.log(`🚀 FORÇANDO uso da URL brasileira (Nike bloqueia bots na validação)`);
        
        // RETORNAR DIRETO SEM VALIDAÇÃO - A NIKE BLOQUEIA BOTS
        return brazilianUrl;
      }
      
      // Se chegou aqui, não conseguiu extrair path
      console.log(`⚠️ Não foi possível extrair path da URL Nike: ${resolvedUrl}`);
      return resolvedUrl;
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
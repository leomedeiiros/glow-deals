// backend/src/controllers/scrapeController.js
const amazonScraper = require('../services/amazonScraper');
const mercadoLivreScraper = require('../services/mercadoLivreScraper');
const centauroScraper = require('../services/centauroScraper');
const netshoesScraper = require('../services/netshoesScraper');
const nikeScraper = require('../services/nikeScraper');
const shopeeScraper = require('../services/shopeeScraper');
const linkResolver = require('../utils/linkResolver');
const whatsappService = require('../services/whatsappService');
const geminiService = require('../services/geminiService');

exports.scrapeProduct = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    console.log(`Iniciando scraping para URL: ${url}`);
    
    // Verificar se é link de afiliado do Mercado Livre
    const isMercadoLivreAffiliate = url.includes('mercadolivre.com/sec/') || url.includes('mercadolibre.com/sec/');
    
    // Verificar se é link da Awin (Centauro/Nike)
    const isAwinAffiliate = url.includes('tidd.ly/');
    
    // Verificar se é link da Rakuten (Netshoes)
    const isRakutenAffiliate = url.includes('tiny.cc/');
    
    // Verificar se é link de afiliado da Shopee
    const isShopeeAffiliate = url.includes('shopee.com.br') || url.includes('s.shopee.com.br');
    
    // Verificar se os links de afiliados podem ser passados diretamente para os scrapers específicos
    if (isMercadoLivreAffiliate) {
      console.log('Link de afiliado do Mercado Livre detectado. Usando scraper direto.');
      const productData = await mercadoLivreScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      return res.json(productData);
    }
    
    if (isAwinAffiliate && url.includes('3Ey3rLE')) {
      console.log('Link de afiliado da Centauro detectado. Usando scraper direto.');
      const productData = await centauroScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      return res.json(productData);
    }
    
    if (isAwinAffiliate && url.includes('4cvXuvd')) {
      console.log('Link de afiliado da Nike detectado. Usando scraper direto.');
      const productData = await nikeScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      return res.json(productData);
    }
    
    if (isRakutenAffiliate && url.includes('ebah001')) {
      console.log('Link de afiliado da Netshoes detectado. Usando scraper direto.');
      const productData = await netshoesScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      return res.json(productData);
    }
    
    if (isShopeeAffiliate) {
      console.log('Link da Shopee detectado. Usando scraper direto.');
      
      // Para Shopee, sempre retornamos os dados mesmo que sejam limitados
      const productData = await shopeeScraper.scrapeProductData(url);
      productData.productUrl = url;
      console.log('Dados do produto extraídos com sucesso:', productData);
      
      // Se é um placeholder, indicamos na resposta mas não tratamos como erro
      if (productData.isPlaceholder) {
        console.log('Dados limitados da Shopee - usando fallback');
      }
      
      return res.json(productData);
    }
    
    // Para outros links, resolver URL e determinar qual scraper usar
    const resolvedUrl = await linkResolver.resolveUrl(url);
    console.log(`URL resolvida: ${resolvedUrl}`);
    
    let productData;
    
    if (resolvedUrl.includes('amazon.com.br') || resolvedUrl.includes('amazon.com')) {
      console.log('Usando Amazon Scraper');
      productData = await amazonScraper.scrapeProductData(resolvedUrl);
    } else if (
      resolvedUrl.includes('mercadolivre.com.br') || 
      resolvedUrl.includes('mercadolibre.com')
    ) {
      console.log('Usando Mercado Livre Scraper');
      productData = await mercadoLivreScraper.scrapeProductData(resolvedUrl);
    } else if (
      resolvedUrl.includes('centauro.com.br')
    ) {
      console.log('Usando Centauro Scraper');
      productData = await centauroScraper.scrapeProductData(resolvedUrl);
    } else if (
      resolvedUrl.includes('netshoes.com.br')
    ) {
      console.log('Usando Netshoes Scraper');
      productData = await netshoesScraper.scrapeProductData(resolvedUrl);
    } else if (
      resolvedUrl.includes('nike.com.br') || 
      resolvedUrl.includes('nike.com/br') ||
      resolvedUrl.includes('nike.com/tenis') ||
      resolvedUrl.includes('nike.com') // CORREÇÃO: Incluir qualquer domínio Nike
    ) {
      console.log('Usando Nike Scraper');
      productData = await nikeScraper.scrapeProductData(resolvedUrl);
    } else if (
      resolvedUrl.includes('shopee.com.br')
    ) {
      console.log('Usando Shopee Scraper');
      productData = await shopeeScraper.scrapeProductData(resolvedUrl);
      
      // Para Shopee, mesmo com dados limitados, continuamos
      if (productData.isPlaceholder) {
        console.log('Dados limitados da Shopee - usando fallback');
      }
    } else {
      return res.status(400).json({ error: 'URL não suportada. Apenas Amazon, Mercado Livre, Centauro, Netshoes, Nike e Shopee são suportados.' });
    }
    
    productData.productUrl = url;

    if (!productData.name || productData.name === 'Nome do produto não encontrado') {
      console.warn('Alerta: Nome do produto não foi extraído corretamente');
    }
    
    if (!productData.currentPrice || productData.currentPrice === 'Preço não disponível') {
      console.warn('Alerta: Preço atual não foi extraído corretamente');
    }
    
    console.log('Dados do produto extraídos com sucesso:', productData);
    res.json(productData);
  } catch (error) {
    console.error('Erro ao fazer scraping:', error);
    res.status(500).json({ error: 'Falha ao obter dados do produto', details: error.message });
  }
};

exports.sendWhatsApp = async (req, res) => {
  try {
    const { message, chatName } = req.body;
    
    if (!message || !chatName) {
      return res.status(400).json({ error: 'Mensagem ou nome do chat não fornecidos' });
    }
    
    await whatsappService.sendMessage(message, chatName);
    res.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Falha ao enviar mensagem', details: error.message });
  }
};

exports.generateAITitle = async (req, res) => {
  try {
    const { apiKey, productData } = req.body;
    
    if (!apiKey || !productData) {
      return res.status(400).json({ 
        error: 'Chave de API e dados do produto são obrigatórios' 
      });
    }
    
    console.log(`Iniciando geração de título para produto: "${productData.name}"`);
    
    const result = await geminiService.generateTitle(apiKey, productData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Erro ao gerar título com IA:', error);
    res.status(500).json({ 
      error: 'Falha ao gerar título com IA', 
      details: error.message 
    });
  }
};

exports.generateAIImage = async (req, res) => {
  try {
    const { prompt, apiKey, productData } = req.body;
    
    if (!prompt || !apiKey || !productData) {
      return res.status(400).json({ 
        error: 'Prompt, chave de API e dados do produto são obrigatórios' 
      });
    }
    
    console.log(`Iniciando geração de imagem com prompt: "${prompt}"`);
    
    const result = await geminiService.generateImage(prompt, apiKey, productData);
    
    if (result.success) {
      // Transformar URL relativa em URL completa
      const baseUrl = req.protocol + '://' + req.get('host');
      result.imageUrl = baseUrl + result.imageUrl;
      
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Erro ao gerar imagem com IA:', error);
    res.status(500).json({ 
      error: 'Falha ao gerar imagem com IA', 
      details: error.message 
    });
  }
};
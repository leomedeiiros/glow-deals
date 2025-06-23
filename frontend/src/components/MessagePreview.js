// frontend/src/components/MessagePreview.js
import React, { useEffect } from 'react';

const MessagePreview = ({ 
  productData, 
  couponCode, 
  storeType, 
  vendorName,
  discountPercentage,
  discountValue,
  setFinalMessage
}) => {
  // Função para formatar o preço (preservando os milhares)
  const formatPrice = (price) => {
    if (!price) return '';
    
    // Limpar a string para manter apenas números, vírgulas e pontos
    let cleanPrice = String(price).replace(/[^\d,\.]/g, '');
    
    // Formato brasileiro: 1.299,90
    if (cleanPrice.includes(',')) {
      return cleanPrice.split(',')[0];
    }
    
    // Formato americano ou apenas com ponto decimal: 1,299.90 ou 1299.90
    if (cleanPrice.includes('.')) {
      return cleanPrice.split('.')[0];
    }
    
    return cleanPrice;
  };
  
  // Função para converter string de preço para número para cálculos
  const priceToNumber = (priceStr) => {
    if (!priceStr) return 0;
    
    // Converter para string se não for
    const priceString = String(priceStr);
    
    // Formato brasileiro: 1.299,90 (ponto como separador de milhar, vírgula como decimal)
    if (priceString.includes(',')) {
      return parseFloat(priceString.replace(/\./g, '').replace(',', '.'));
    }
    
    // Formato americano: 1,299.90 (vírgula como separador de milhar, ponto como decimal)
    if (priceString.includes('.')) {
      return parseFloat(priceString.replace(/,/g, ''));
    }
    
    // Apenas números
    return parseFloat(priceString);
  };
  
  // Função para calcular preço com desconto percentual
  const calculatePercentageDiscount = (currentPrice) => {
    if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número para cálculos
    const priceNum = priceToNumber(currentPrice);
    
    if (isNaN(priceNum)) {
      return currentPrice;
    }
    
    // Calcular o preço com desconto
    const discountRate = parseFloat(discountPercentage) / 100;
    const discountedPrice = priceNum * (1 - discountRate);
    
    // Arredondar para baixo e converter para string
    return Math.floor(discountedPrice).toString();
  };
  
  // Função para calcular preço com desconto em valor fixo (R$)
  const calculateValueDiscount = (currentPrice) => {
    if (!discountValue || discountValue <= 0 || !currentPrice) {
      return currentPrice;
    }
    
    // Converter o preço para número para cálculos
    const priceNum = priceToNumber(currentPrice);
    
    if (isNaN(priceNum)) {
      return currentPrice;
    }
    
    // Calcular o preço com desconto em valor fixo
    const discount = parseFloat(discountValue);
    const discountedPrice = priceNum - discount;
    
    // Garantir que o preço não fique negativo
    if (discountedPrice <= 0) {
      return "1"; // Preço mínimo de R$ 1
    }
    
    // Arredondar para baixo e converter para string
    return Math.floor(discountedPrice).toString();
  };
  
  // Função para tratar o nome do vendedor
  const cleanVendorName = (vendorName) => {
    if (!vendorName) return '';
    
    // Caso específico: Se o nome contém "oficialadidas", extrair apenas "adidas"
    if (vendorName.includes('oficialadidas')) {
      return 'adidas';
    }
    
    // Remover prefixos e sufixos comuns que podem aparecer nos nomes das lojas
    let cleanName = vendorName
      .replace(/^Vendido\s+por/i, '')
      .replace(/^Loja\s+oficial\s+/i, '')
      .replace(/^Loja\s+/i, '')
      .replace(/^oficial\s*/i, '')
      .replace(/\s*oficial$/i, '')
      .replace(/\s*oficial\s*/i, ' ')
      .trim();
    
    return cleanName;
  };
  
  // Função para verificar se há um desconto real
  const hasRealDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice) return false;
    
    // Converter preços para números para comparar
    const originalValue = priceToNumber(originalPrice);
    const currentValue = priceToNumber(currentPrice);
    
    // Verificar se o preço original é significativamente maior que o atual
    // (diferença mínima de 5% para considerar como desconto real)
    return !isNaN(originalValue) && !isNaN(currentValue) && 
           originalValue > currentValue && 
           (originalValue - currentValue) / originalValue > 0.05;
  };
  
  // CORREÇÃO: Função fixa para sempre retornar o mesmo valor para cada tipo de loja
  const getStoreTypeText = () => {
    // Se não tiver dados do produto, retornar vazio
    if (!productData) return '';
    
    // NOVA LÓGICA: Detectar se vem dos sites originais (Nike, Centauro, Netshoes)
    const isFromOriginalNike = productData.platform === 'nike' || 
                              (productData.vendor && productData.vendor.toLowerCase().includes('nike'));
    const isFromOriginalCentauro = productData.platform === 'centauro' || 
                                  (productData.vendor && productData.vendor.toLowerCase().includes('centauro'));
    const isFromOriginalNetshoes = productData.platform === 'netshoes' || 
                                  (productData.vendor && productData.vendor.toLowerCase().includes('netshoes'));
    const isFromOriginalShopee = productData.platform === 'shopee' || 
                                (productData.vendor && productData.vendor.toLowerCase().includes('shopee'));
    
    // PRIORIDADE: Se vem dos sites originais, usar "Site oficial"
    if (isFromOriginalNike) {
      return 'Site oficial Nike';
    }
    
    if (isFromOriginalCentauro) {
      return 'Site oficial Centauro';
    }
    
    if (isFromOriginalNetshoes) {
      return 'Site oficial Netshoes';
    }
    
    // Valores fixos para outros tipos de loja (comportamento original mantido)
    if (storeType === 'amazon') {
      return 'Vendido e entregue pela Amazon';
    }
    
    if (storeType === 'loja_oficial') {
      // Para produtos que não vêm dos sites originais, usar a lógica antiga
      if (isFromOriginalShopee) {
        return 'Loja oficial na Shopee';
      }
      
      if (productData.vendor && productData.vendor !== 'Mercado Livre') {
        // Limpar nome do vendedor e garantir bom espaçamento
        const cleanName = cleanVendorName(productData.vendor);
        return `Loja oficial ${cleanName} no Mercado Livre`;
      }
      
      return 'Loja oficial no Mercado Livre';
    }
    
    if (storeType === 'loja_validada') {
      if (isFromOriginalShopee) {
        return 'Loja validada na Shopee';
      }
      return 'Loja validada no Mercado Livre';
    }
    
    if (storeType === 'catalogo') {
      if (vendorName && vendorName.trim() !== '') {
        return `⚠️ No anúncio, localize o campo 'Outras opções de compra' e selecione o vendedor '${vendorName}' (loja oficial)`;
      } else {
        return `⚠️ No anúncio, localize o campo 'Outras opções de compra' e selecione o vendedor 'Informe o nome do vendedor' (loja oficial)`;
      }
    }
    
    return '';
  };
  
  // Verificar se é Amazon para determinar como mostrar preço
  const isAmazon = storeType === 'amazon' || 
                  (productData && productData.vendor === 'Amazon') ||
                  (productData && productData.platform && 
                   productData.platform.toLowerCase().includes('amazon'));
  
  // Função para gerar a mensagem final
  const generateMessage = () => {
    if (!productData) return '';
    
    // Utilize displayPrice e displayOriginalPrice se disponíveis, senão use os normais
    const { name, productUrl } = productData;
    
    // Use os campos de exibição se disponíveis, senão utilize os campos padrão
    const rawCurrentPrice = productData.currentPrice;
    const rawOriginalPrice = productData.originalPrice;
    
    // Usar os campos de exibição formatados se estiverem disponíveis
    const processedCurrentPrice = productData.displayPrice || formatPrice(rawCurrentPrice);
    const processedOriginalPrice = productData.displayOriginalPrice || formatPrice(rawOriginalPrice);
    
    console.log("Preços para mensagem:", {
      rawCurrent: rawCurrentPrice,
      rawOriginal: rawOriginalPrice,
      processed: processedCurrentPrice,
      processedOriginal: processedOriginalPrice
    });
    
    // IMPORTANTE: Sempre obter o texto do tipo de loja da função getStoreTypeText
    // Não gerar o texto aqui para garantir consistência
    const storeTypeText = getStoreTypeText();
    
    let priceText = '';
    
    // Para cálculos de desconto, usar os preços originais com decimais
    // mas para exibição, usar os preços formatados sem centavos
    let finalPrice = processedCurrentPrice;
    let calculatedPrice;
    
    if (discountPercentage) {
      calculatedPrice = calculatePercentageDiscount(rawCurrentPrice);
      // Se o preço calculado for muito diferente, usar o preço formatado
      if (calculatedPrice === "1" || calculatedPrice === "2" || calculatedPrice === "3") {
        console.log("Ajuste para desconto percentual aplicado");
        finalPrice = processedCurrentPrice;
      } else {
        finalPrice = calculatedPrice;
      }
    } else if (discountValue) {
      calculatedPrice = calculateValueDiscount(rawCurrentPrice);
      // Se o preço calculado for muito diferente, usar o preço formatado
      if (calculatedPrice === "1" || calculatedPrice === "2" || calculatedPrice === "3") {
        console.log("Ajuste para desconto em valor aplicado");
        finalPrice = processedCurrentPrice;
      } else {
        finalPrice = calculatedPrice;
      }
    }
    
    // Para Amazon, mostrar apenas o preço atual (sem o original)
    if (isAmazon) {
      priceText = `✅  Por *R$ ${finalPrice}*`;
    } else {
      // Para todas as outras lojas (Mercado Livre, Nike, Centauro, Shopee, etc),
      // SEMPRE mostrar o formato De/Por quando há um preço original
      if (processedOriginalPrice && hasRealDiscount(rawOriginalPrice, finalPrice)) {
        priceText = `✅  ~De R$ ${processedOriginalPrice}~ por *R$ ${finalPrice}*`;
      } else {
        // Caso não tenha desconto, mostrar apenas o preço atual
        priceText = `✅  Por *R$ ${finalPrice}*`;
      }
    }
    
    let message = `➡️ *${name}*`;
    if (storeTypeText) {
      message += `\n_${storeTypeText}_`;
    }
    
    message += `\n\n${priceText}`;
    
    // Adicionar cupom se fornecido
    if (couponCode) {
      message += `\n🎟️ Use o cupom: *${couponCode}*`;
    }
    
    // Adicionar link do produto
    message += `\n🛒 ${productUrl}`;
    
    message += `\n\n☑️ Link do grupo: https://linktr.ee/glowdeals`;
    
    return message;
  };
  
  // Gerar a mensagem sempre que os dados mudarem
  useEffect(() => {
    if (productData) {
      const message = generateMessage();
      setFinalMessage(message);
    }
  }, [productData, couponCode, storeType, vendorName, discountPercentage, discountValue]);
  
  // Retornar a mensagem
  return generateMessage();
};

export default MessagePreview;
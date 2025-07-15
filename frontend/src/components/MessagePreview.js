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
 // Manter toda a lógica existente igual
 const formatPrice = (price) => {
   if (!price) return '';
   
   let cleanPrice = String(price).replace(/[^\d,\.]/g, '');
   
   if (cleanPrice.includes(',')) {
     return cleanPrice.split(',')[0];
   }
   
   if (cleanPrice.includes('.')) {
     return cleanPrice.split('.')[0];
   }
   
   return cleanPrice;
 };
 
 const priceToNumber = (priceStr) => {
   if (!priceStr) return 0;
   
   const priceString = String(priceStr);
   
   if (priceString.includes(',')) {
     return parseFloat(priceString.replace(/\./g, '').replace(',', '.'));
   }
   
   if (priceString.includes('.')) {
     return parseFloat(priceString.replace(/,/g, ''));
   }
   
   return parseFloat(priceString);
 };
 
 const calculatePercentageDiscount = (currentPrice) => {
   if (!discountPercentage || discountPercentage <= 0 || !currentPrice) {
     return currentPrice;
   }
   
   const priceNum = priceToNumber(currentPrice);
   
   if (isNaN(priceNum)) {
     return currentPrice;
   }
   
   const discountRate = parseFloat(discountPercentage) / 100;
   const discountedPrice = priceNum * (1 - discountRate);
   
   return Math.floor(discountedPrice).toString();
 };
 
 const calculateValueDiscount = (currentPrice) => {
   if (!discountValue || discountValue <= 0 || !currentPrice) {
     return currentPrice;
   }
   
   const priceNum = priceToNumber(currentPrice);
   
   if (isNaN(priceNum)) {
     return currentPrice;
   }
   
   const discount = parseFloat(discountValue);
   const discountedPrice = priceNum - discount;
   
   if (discountedPrice <= 0) {
     return "1";
   }
   
   return Math.floor(discountedPrice).toString();
 };
 
 const cleanVendorName = (vendorName) => {
   if (!vendorName) return '';
   
   if (vendorName.includes('oficialadidas')) {
     return 'adidas';
   }
   
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
 
 const hasRealDiscount = (originalPrice, currentPrice) => {
   if (!originalPrice || !currentPrice) return false;
   
   const originalValue = priceToNumber(originalPrice);
   const currentValue = priceToNumber(currentPrice);
   
   return !isNaN(originalValue) && !isNaN(currentValue) && 
          originalValue > currentValue && 
          (originalValue - currentValue) / originalValue > 0.05;
 };
 
 const getStoreTypeText = () => {
   if (!productData) return '';
   
   const isMercadoLivre = 
     (productData.productUrl && (productData.productUrl.includes('mercadolivre') || productData.productUrl.includes('mercadolibre'))) ||
     (productData.platform && typeof productData.platform === 'string' && 
      (productData.platform.toLowerCase().includes('mercadolivre') || 
       productData.platform.toLowerCase().includes('mercadolibre'))) ||
     (productData.vendor && productData.vendor.toLowerCase().includes('mercado livre'));
   
   const isAmazon = 
     (productData.productUrl && (productData.productUrl.includes('amazon.com') || productData.productUrl.includes('amazon.com.br'))) ||
     (productData.platform && typeof productData.platform === 'string' && 
      productData.platform.toLowerCase().includes('amazon')) ||
     (productData.vendor && productData.vendor.toLowerCase().includes('amazon'));
   
   const isShopee = 
     (productData.productUrl && productData.productUrl.includes('shopee.com.br')) ||
     (productData.platform && typeof productData.platform === 'string' && 
      productData.platform.toLowerCase().includes('shopee')) ||
     (productData.vendor && productData.vendor.toLowerCase().includes('shopee'));
   
   const isFromOriginalNike = !isMercadoLivre && !isAmazon && !isShopee && (
     productData.platform === 'nike' || 
     (productData.productUrl && (productData.productUrl.includes('nike.com.br') || productData.productUrl.includes('nike.com/br'))) ||
     (productData.vendor && productData.vendor.toLowerCase().includes('nike'))
   );
   
   const isFromOriginalCentauro = !isMercadoLivre && !isAmazon && !isShopee && (
     productData.platform === 'centauro' || 
     (productData.productUrl && productData.productUrl.includes('centauro.com.br')) ||
     (productData.vendor && productData.vendor.toLowerCase().includes('centauro'))
   );
   
   const isFromOriginalNetshoes = !isMercadoLivre && !isAmazon && !isShopee && (
     productData.platform === 'netshoes' || 
     (productData.productUrl && productData.productUrl.includes('netshoes.com.br')) ||
     (productData.vendor && productData.vendor.toLowerCase().includes('netshoes'))
   );
   
   if (isFromOriginalNike) {
     return 'Site oficial Nike';
   }
   
   if (isFromOriginalCentauro) {
     return 'Site oficial Centauro';
   }
   
   if (isFromOriginalNetshoes) {
     return 'Site oficial Netshoes';
   }
   
   if (storeType === 'amazon') {
     return 'Vendido e entregue pela Amazon';
   }
   
   if (storeType === 'loja_oficial') {
     if (isShopee) {
       return 'Loja oficial na Shopee';
     }
     
     if (isMercadoLivre) {
       if (productData.vendor && productData.vendor !== 'Mercado Livre') {
         const cleanName = cleanVendorName(productData.vendor);
         return `Loja oficial ${cleanName} no Mercado Livre`;
       }
       return 'Loja oficial no Mercado Livre';
     }
     
     return 'Loja oficial no Mercado Livre';
   }
   
   if (storeType === 'loja_validada') {
     if (isShopee) {
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
 
 const isAmazon = storeType === 'amazon' || 
                 (productData && productData.vendor === 'Amazon') ||
                 (productData && productData.platform && 
                  productData.platform.toLowerCase().includes('amazon'));
 
 const generateMessage = () => {
   if (!productData) return '';
   
   const { name, productUrl } = productData;
   
   const rawCurrentPrice = productData.currentPrice;
   const rawOriginalPrice = productData.originalPrice;
   
   const processedCurrentPrice = productData.displayPrice || formatPrice(rawCurrentPrice);
   const processedOriginalPrice = productData.displayOriginalPrice || formatPrice(rawOriginalPrice);
   
   console.log("Preços para mensagem:", {
     rawCurrent: rawCurrentPrice,
     rawOriginal: rawOriginalPrice,
     processed: processedCurrentPrice,
     processedOriginal: processedOriginalPrice
   });
   
   const storeTypeText = getStoreTypeText();
   
   let priceText = '';
   
   let finalPrice = processedCurrentPrice;
   let calculatedPrice;
   
   if (discountPercentage) {
     calculatedPrice = calculatePercentageDiscount(rawCurrentPrice);
     if (calculatedPrice === "1" || calculatedPrice === "2" || calculatedPrice === "3") {
       console.log("Ajuste para desconto percentual aplicado");
       finalPrice = processedCurrentPrice;
     } else {
       finalPrice = calculatedPrice;
     }
   } else if (discountValue) {
     calculatedPrice = calculateValueDiscount(rawCurrentPrice);
     if (calculatedPrice === "1" || calculatedPrice === "2" || calculatedPrice === "3") {
       console.log("Ajuste para desconto em valor aplicado");
       finalPrice = processedCurrentPrice;
     } else {
       finalPrice = calculatedPrice;
     }
   }
   
   if (isAmazon) {
     priceText = `✅  Por *R$ ${finalPrice}*`;
   } else {
     if (processedOriginalPrice && hasRealDiscount(rawOriginalPrice, finalPrice)) {
       priceText = `✅  ~De R$ ${processedOriginalPrice}~ por *R$ ${finalPrice}*`;
     } else {
       priceText = `✅  Por *R$ ${finalPrice}*`;
     }
   }
   
   let message = `➡️ *${name}*`;
   if (storeTypeText) {
     message += `\n_${storeTypeText}_`;
   }
   
   message += `\n\n${priceText}`;
   
   if (couponCode) {
     message += `\n🎟️ Use o cupom: *${couponCode}*`;
   }
   
   message += `\n🛒 ${productUrl}`;
   
   message += `\n\n☑️ Link do grupo: https://linktr.ee/glowdeals`;
   
   return message;
 };
 
 useEffect(() => {
   if (productData) {
     const message = generateMessage();
     setFinalMessage(message);
   } else {
     // CORREÇÃO 4: Limpar mensagem quando não há produto
     setFinalMessage('');
   }
 }, [productData, couponCode, storeType, vendorName, discountPercentage, discountValue]);
 
 return generateMessage();
};

export default MessagePreview;
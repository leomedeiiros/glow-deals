// frontend/src/App.js
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import MessagePreview from './components/MessagePreview';
import { API_BASE_URL } from './config';
import { scrapeProduct, uploadImage } from './services/api';

function App() {
  // Estados existentes mantidos
  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Erro ao carregar ${key} do localStorage:`, error);
      return defaultValue;
    }
  };

  const saveToLocalStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Erro ao salvar ${key} no localStorage:`, error);
    }
  };

  // Estados principais
  const [recentLinks, setRecentLinks] = useState(loadFromLocalStorage('recentLinks', []));
  const [recentCoupons, setRecentCoupons] = useState(loadFromLocalStorage('recentCoupons', []));
  const [recentDiscounts, setRecentDiscounts] = useState(loadFromLocalStorage('recentDiscounts', []));
  const [recentDiscountValues, setRecentDiscountValues] = useState(loadFromLocalStorage('recentDiscountValues', []));
  
  // Estados de processamento em lote
  const [batchLinks, setBatchLinks] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState([]);
  const [batchSectionOpen, setBatchSectionOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  
  // API Gemini para títulos
  const geminiApiKey = 'AIzaSyAZQbdDzDs3shmUTLpB3v3kfE_CE6R8SLo';
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [aiImageSectionOpen, setAiImageSectionOpen] = useState(false);

  // Estados principais do formulário
  const [url, setUrl] = useState('');
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [storeType, setStoreType] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [finalMessage, setFinalMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Estados para imagem
  const [customImage, setCustomImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  
  // Estados das seções colapsáveis
  const [infoSectionOpen, setInfoSectionOpen] = useState(true);
  const [storeSectionOpen, setStoreSectionOpen] = useState(true);
  const [imageSectionOpen, setImageSectionOpen] = useState(false);
  
  const messagePreviewRef = useRef(null);
  const mainCardRef = useRef(null);

  // Efeitos para salvar no localStorage
  useEffect(() => {
    saveToLocalStorage('recentLinks', recentLinks);
  }, [recentLinks]);

  useEffect(() => {
    saveToLocalStorage('recentCoupons', recentCoupons);
  }, [recentCoupons]);

  useEffect(() => {
    saveToLocalStorage('recentDiscounts', recentDiscounts);
  }, [recentDiscounts]);

  useEffect(() => {
    saveToLocalStorage('recentDiscountValues', recentDiscountValues);
  }, [recentDiscountValues]);
  
  // Função para adicionar ao histórico
  const addToHistory = (value, setter, currentArray, maxItems = 10) => {
    if (!value || value.trim() === '') return;
    
    const newArray = currentArray.filter(item => item !== value);
    newArray.unshift(value);
    
    if (newArray.length > maxItems) {
      newArray.pop();
    }
    
    setter(newArray);
  };

  // Função para processar dados do produto
  const handleProductDataReceived = (data, url) => {
    if (data) {
      console.log("Dados originais do produto:", {
        currentPrice: data.currentPrice,
        originalPrice: data.originalPrice
      });
      
      if (data.currentPrice) {
        data.displayPrice = data.currentPrice;
        
        if (typeof data.displayPrice === 'string' && data.displayPrice.includes(',')) {
          data.displayPrice = data.displayPrice.split(',')[0];
          console.log("Preço de exibição corrigido para:", data.displayPrice);
        }
      }
      
      if (data.originalPrice) {
        data.displayOriginalPrice = data.originalPrice;
        
        if (typeof data.displayOriginalPrice === 'string' && data.displayOriginalPrice.includes(',')) {
          data.displayOriginalPrice = data.displayOriginalPrice.split(',')[0];
          console.log("Preço original de exibição corrigido para:", data.displayOriginalPrice);
        }
      }
    }
    
    setProductData(data);
    
    if (url) {
      addToHistory(url, setRecentLinks, recentLinks);
    }
    
    // Detectar tipo de loja
    const isMercadoLivre = 
      (url && (url.includes('mercadolivre') || url.includes('mercadolibre'))) ||
      (data.vendor && data.vendor.toLowerCase().includes('mercado livre')) ||
      (data.platform && typeof data.platform === 'string' && 
      (data.platform.toLowerCase().includes('mercadolivre') || 
       data.platform.toLowerCase().includes('mercadolibre')));
       
    const isAmazon = 
      (url && (url.includes('amazon.com') || url.includes('amazon.com.br'))) ||
      (data.vendor && data.vendor.toLowerCase().includes('amazon')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('amazon'));

    const isCentauro = 
      (url && url.includes('centauro.com.br')) ||
      (data.vendor && data.vendor.toLowerCase().includes('centauro')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('centauro'));

    const isNetshoes = 
      (url && url.includes('netshoes.com.br')) ||
      (data.vendor && data.vendor.toLowerCase().includes('netshoes')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('netshoes'));

    const isNike = 
      (url && (url.includes('nike.com.br') || url.includes('nike.com/br'))) ||
      (data.vendor && data.vendor.toLowerCase().includes('nike')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('nike'));

    const isShopee = 
      (url && url.includes('shopee.com.br')) ||
      (data.vendor && data.vendor.toLowerCase().includes('shopee')) ||
      (data.platform && typeof data.platform === 'string' && 
       data.platform.toLowerCase().includes('shopee'));
      
    // Definir tipo de loja padrão
    if (isAmazon) {
      setStoreType('amazon');
    } else if (isMercadoLivre) {
      setStoreType('loja_oficial');
    } else if (isShopee) {
      setStoreType('loja_validada');
    } else if (isCentauro || isNetshoes || isNike) {
      setStoreType('loja_oficial');
    } else {
      setStoreType('loja_validada');
    }
    
    setIsEditing(false);

    setTimeout(() => {
      if (mainCardRef.current) {
        const previewSection = mainCardRef.current.querySelector('.preview-section');
        if (previewSection) {
          previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 300);
  };
  
  // Função para alternar seções
  const toggleSection = (section, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    switch(section) {
      case 'info':
        setInfoSectionOpen(!infoSectionOpen);
        break;
      case 'store':
        setStoreSectionOpen(!storeSectionOpen);
        break;
      case 'image':
        setImageSectionOpen(!imageSectionOpen);
        break;
      case 'batch':
        setBatchSectionOpen(!batchSectionOpen);
        break;
      case 'aiImage':
        setAiImageSectionOpen(!aiImageSectionOpen);
        break;
      default:
        break;
    }
  };

  // Handlers para cupom e desconto
  const handleCouponChange = (value) => {
    setCouponCode(value);
    if (value) {
      addToHistory(value, setRecentCoupons, recentCoupons);
    }
  };
  
  const handleDiscountChange = (value) => {
    setDiscountPercentage(value);
    if (value) {
      setDiscountValue('');
      addToHistory(value, setRecentDiscounts, recentDiscounts);
    }
  };
  
  const handleDiscountValueChange = (value) => {
    setDiscountValue(value);
    if (value) {
      setDiscountPercentage('');
      addToHistory(value, setRecentDiscountValues, recentDiscountValues);
    }
  };
  
  // Upload de imagem
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem não pode ser maior que 5MB');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Apenas imagens nos formatos JPG, JPEG, PNG e GIF são permitidas');
      return;
    }
    
    setImageFile(file);
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      setUploadingImage(true);
      setError('');
      
      const response = await uploadImage(file);
      
      if (response.success) {
        setCustomImage(response.imageUrl);
      } else {
        setError('Erro ao fazer upload da imagem');
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      setError(
        error.response?.data?.error ||
        'Falha ao fazer upload da imagem. Tente novamente.'
      );
    } finally {
      setUploadingImage(false);
    }
  };
  
  // Geração de título com IA
  const handleGenerateTitle = async () => {
    if (!productData) {
      setError('Você precisa extrair os dados de um produto primeiro.');
      return;
    }
    
    try {
      setGeneratingTitle(true);
      setError('');
      
      const enhancedPrompt = `Você é um especialista em criar títulos curtos, criativos e humorísticos para anúncios de produtos no WhatsApp.
Crie um título totalmente em LETRAS MAIÚSCULAS, com no máximo 50 caracteres, que seja chamativo, divertido e que possa ter duplo sentido ou brincar com memes, gírias e trocadilhos.
O produto é: ${productData.name}.
Use o estilo destes exemplos para se inspirar:
- "ÚNICO VEÍCULO QUE CONSIGO COMPRAR" (bicicleta)
- "NEO QLED DA SAMSUNG TEM QUALIDADE ABSURDA" (TV)
- "O ÚNICO TIGRINHO QUE VALE INVESTIR" (cuecas da Puma)
Regras importantes:
- O título deve provocar curiosidade ou dar vontade de clicar
- Pode usar expressões populares, memes e referências do mundo gamer ou tech.
- Responda APENAS com o título, sem nenhum texto adicional.`;
      
      const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        contents: [{ parts: [{ text: enhancedPrompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 50
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey
        }
      });
      
      if (response.data && 
          response.data.candidates && 
          response.data.candidates[0] && 
          response.data.candidates[0].content &&
          response.data.candidates[0].content.parts) {
        
        const generatedText = response.data.candidates[0].content.parts[0].text;
        console.log("Título gerado:", generatedText);
        
        const cleanTitle = generatedText.replace(/^["'\s]+|["'\s]+$/g, '');
        
        setGeneratedTitle(cleanTitle);
        
        if (messagePreviewRef.current && finalMessage) {
          let updatedMessage = finalMessage;
          if (updatedMessage.startsWith('_') && updatedMessage.includes('_\n')) {
            updatedMessage = updatedMessage.replace(/^_[^_\n]*_/, `_${cleanTitle}_`);
          } else if (updatedMessage.startsWith('*') && updatedMessage.includes('*\n')) {
            updatedMessage = `_${cleanTitle}_\n\n` + updatedMessage.substring(updatedMessage.indexOf('\n\n') + 2);
          } else {
            updatedMessage = `_${cleanTitle}_\n\n` + updatedMessage;
          }
          setFinalMessage(updatedMessage);
          messagePreviewRef.current.innerHTML = updatedMessage;
        }
        
      } else {
        setError('Não foi possível gerar um título. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao gerar título com IA:', error);
      setError(
        error.response?.data?.error?.message || 
        'Falha ao gerar título. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setGeneratingTitle(false);
    }
  };
  
  // Remover imagem
  const removeCustomImage = () => {
    setCustomImage('');
    setImageFile(null);
  };
  
  // Modo de edição
  const enableEditing = () => {
    if (!isEditing && messagePreviewRef.current) {
      setIsEditing(true);
      messagePreviewRef.current.setAttribute('contenteditable', 'true');
      messagePreviewRef.current.focus();
    }
  };
  
  const disableEditing = () => {
    if (isEditing && messagePreviewRef.current) {
      setIsEditing(false);
      messagePreviewRef.current.setAttribute('contenteditable', 'false');
      setFinalMessage(messagePreviewRef.current.innerText);
    }
  };
  
  // Processamento em lote
  const processBatchLinks = async () => {
    if (!batchLinks.trim()) {
      setError('Insira pelo menos um link para processamento em lote');
      return;
    }
    
    const links = batchLinks.split('\n').filter(link => link.trim());
    
    if (links.length === 0) {
      setError('Nenhum link válido encontrado');
      return;
    }
    
    setBatchProcessing(true);
    setBatchResults([]);
    setBatchProgress(0);
    setError('');
    
    const results = [];
    for (let i = 0; i < links.length; i++) {
      const link = links[i].trim();
      if (!link) continue;
      
      try {
        const response = await axios.post(`${API_BASE_URL}/api/scrape`, { url: link });
        
        if (response.data) {
          const productMessage = await generateMessageForProduct(response.data, link);
          
          results.push({
            url: link,
            success: true,
            data: response.data,
            message: productMessage
          });
        }
      } catch (error) {
        console.error('Erro ao processar link em lote:', error);
        results.push({
          url: link,
          success: false,
          error: error.response?.data?.error || 'Falha ao extrair dados'
        });
      }
      
      setBatchProgress(Math.floor(((i + 1) / links.length) * 100));
    }
    
    setBatchResults(results);
    setBatchProcessing(false);
  };
  
  // Gerar mensagem para produto
  const generateMessageForProduct = async (productData, url) => {
    if (!productData) return '';
    
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
    
    let productStoreType = storeType;
    
    if (!productStoreType) {
      const isAmazon = url.includes('amazon.com') || url.includes('amazon.com.br');
      const isMercadoLivre = url.includes('mercadolivre') || url.includes('mercadolibre');
      const isShopee = url.includes('shopee.com.br');
      
      if (isAmazon) {
        productStoreType = 'amazon';
      } else if (isMercadoLivre) {
        productStoreType = 'loja_oficial';
      } else if (isShopee) {
        productStoreType = 'loja_validada';
      } else {
        productStoreType = 'loja_validada';
      }
    }
    
    const getStoreTypeText = (storeType, productData) => {
      if (!productData) return '';
      
      const isNike = productData.platform === 'nike' || (productData.vendor && productData.vendor.toLowerCase().includes('nike'));
      const isCentauro = productData.platform === 'centauro' || (productData.vendor && productData.vendor.toLowerCase().includes('centauro'));
      const isNetshoes = productData.platform === 'netshoes' || (productData.vendor && productData.vendor.toLowerCase().includes('netshoes'));
      const isShopee = productData.platform === 'shopee' || (productData.vendor && productData.vendor.toLowerCase().includes('shopee'));
      
      if (storeType === 'amazon') {
        return 'Vendido e entregue pela Amazon';
      }
      
      if (storeType === 'loja_oficial') {
        if (isNike) {
          return 'Loja oficial Nike no Mercado Livre';
        }
        if (isCentauro) {
          return 'Loja oficial Centauro no Mercado Livre';
        }
        if (isNetshoes) {
          return 'Loja oficial Netshoes no Mercado Livre';
        }
        if (isShopee) {
          return 'Loja oficial na Shopee';
        }
        
        if (productData.vendor && productData.vendor !== 'Mercado Livre') {
          const cleanName = productData.vendor
            .replace(/^Vendido\s+por/i, '')
            .replace(/^Loja\s+oficial\s+/i, '')
            .replace(/^Loja\s+/i, '')
            .replace(/^oficial\s*/i, '')
            .replace(/\s*oficial$/i, '')
            .replace(/\s*oficial\s*/i, ' ')
            .trim();
          
          return `Loja oficial ${cleanName} no Mercado Livre`;
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
    
    const isAmazon = productStoreType === 'amazon' || 
                    (productData.vendor === 'Amazon') ||
                    (productData.platform && 
                     productData.platform.toLowerCase().includes('amazon'));
    
    const rawCurrentPrice = productData.currentPrice;
    const rawOriginalPrice = productData.originalPrice;
    const processedCurrentPrice = productData.displayPrice || formatPrice(rawCurrentPrice);
    const processedOriginalPrice = productData.displayOriginalPrice || formatPrice(rawOriginalPrice);
    
    const storeTypeText = getStoreTypeText(productStoreType, productData);
    
    const hasRealDiscount = (originalPrice, currentPrice) => {
      if (!originalPrice || !currentPrice) return false;
      
      const originalValue = parseFloat(String(originalPrice).replace(/\./g, '').replace(',', '.'));
      const currentValue = parseFloat(String(currentPrice).replace(/\./g, '').replace(',', '.'));
      
      return !isNaN(originalValue) && !isNaN(currentValue) && 
             originalValue > currentValue && 
             (originalValue - currentValue) / originalValue > 0.05;
    };
    
    let finalPrice = processedCurrentPrice;
    
    let priceText = '';
    
    if (isAmazon) {
      priceText = `✅  Por *R$ ${finalPrice}*`;
    } else {
      if (processedOriginalPrice && hasRealDiscount(rawOriginalPrice, finalPrice)) {
        priceText = `✅  ~De R$ ${processedOriginalPrice}~ por *R$ ${finalPrice}*`;
      } else {
        priceText = `✅  Por *R$ ${finalPrice}*`;
      }
    }
    
    let message = `➡️ *${productData.name}*`;
    
    if (storeTypeText) {
      message += `\n_${storeTypeText}_`;
    }
    
    message += `\n\n${priceText}`;
    
    if (couponCode) {
      message += `\n🎟️ Use o cupom: *${couponCode}*`;
    }
    
    message += `\n🛒 ${productData.productUrl || url}`;
    
    message += `\n\n☑️ Link do grupo: https://linktr.ee/techdealsbr`;
    
    return message;
  };
  
  // Copiar mensagens em lote
  const copyAllBatchMessages = () => {
    if (batchResults.length === 0) {
      setError('Não há mensagens em lote para copiar');
      return;
    }
    
    const allMessages = batchResults
      .filter(result => result.success)
      .map(result => result.message)
      .join('\n\n---\n\n');
    
    if (!allMessages) {
      setError('Nenhuma mensagem válida para copiar');
      return;
    }
    
    navigator.clipboard.writeText(allMessages)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 3000);
      })
      .catch((err) => {
        console.error('Erro ao copiar: ', err);
        setError('Falha ao copiar para a área de transferência');
      });
  };
  
  // Renderizar input com clear
  const renderInputWithClear = (value, setValue, placeholder, type = 'text', listId = null, historyItems = []) => {
    return (
      <div className="input-clear-wrapper">
        <input 
          type={type}
          className="form-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          list={listId}
        />
        {listId && historyItems.length > 0 && (
          <datalist id={listId}>
            {historyItems.map((item, index) => (
              <option key={index} value={item} />
            ))}
          </datalist>
        )}
        {value && (
          <button 
            className="clear-input-btn" 
            onClick={() => setValue('')}
            type="button"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
    );
  };
  
  // Compartilhar WhatsApp
  const shareWhatsApp = async () => {
    if (!finalMessage) {
      setError('Nenhuma mensagem para compartilhar.');
      return;
    }
    
    if (isEditing) {
      disableEditing();
    }

    const messageToShare = messagePreviewRef.current ? messagePreviewRef.current.innerText : finalMessage;
   
   if (navigator.share) {
     try {
       if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
         await navigator.share({
           text: messageToShare,
           files: [imageFile]
         });
       } else {
         await navigator.share({
           text: messageToShare
         });
       }
       return;
     } catch (err) {
       console.warn('Compartilhamento falhou:', err);
     }
   }
   
   const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
   
   if (isMobile) {
     const encodedMessage = encodeURIComponent(messageToShare);
     window.location.href = `whatsapp://send?text=${encodedMessage}`;
     
     setTimeout(() => {
       if (document.hasFocus()) {
         window.location.href = `https://api.whatsapp.com/send?text=${encodedMessage}`;
       }
     }, 1000);
   } else {
     window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(messageToShare)}`, '_blank');
   }
 };
   
   // Copiar mensagem
   const copyMessage = () => {
     if (isEditing) {
       disableEditing();
     }

     const messageToShare = messagePreviewRef.current ? messagePreviewRef.current.innerText : finalMessage;
     
     if (!messageToShare) {
       setError('Nenhuma mensagem para copiar.');
       return;
     }
     
     navigator.clipboard.writeText(messageToShare)
       .then(() => {
         setCopySuccess(true);
         setTimeout(() => {
           setCopySuccess(false);
         }, 3000);
       })
       .catch((err) => {
         console.error('Erro ao copiar: ', err);
         setError('Falha ao copiar para a área de transferência');
       });
   };

   // Extrair dados
   const handleExtract = async () => {
     if (!url) {
       setError('Por favor, insira um link de afiliado.');
       return;
     }
     
     try {
       setLoading(true);
       setError('');
       
       const response = await axios.post(`${API_BASE_URL}/api/scrape`, { 
         url: url 
       });
       
       handleProductDataReceived(response.data, url);
     } catch (error) {
       console.error('Erro ao obter dados do produto:', error);
       setError(
         error.response?.data?.error ||
         'Falha ao obter dados do produto. Verifique o link e tente novamente.'
       );
     } finally {
       setLoading(false);
     }
   };
   
   return (
     <div className="app-container">
       {/* Main Content */}
       <main className="main-content" ref={mainCardRef}>
         <div className="main-header">
           <div className="logo-main">DG</div>
           <h1 className="main-title">Deals Generator</h1>
           <p className="main-subtitle">⚡ Seu gerador de copy para afiliados: mensagens prontas em segundos!</p>
         </div>

         {/* Seção Informações da Promoção */}
         <div className="form-section">
           <div className={`section-header ${!infoSectionOpen ? 'collapsed' : ''}`} onClick={() => toggleSection('info')}>
             <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
             </svg>
             <span className="section-title">Informações da Promoção</span>
             <svg className="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
             </svg>
           </div>
           
           <div className={`section-content ${!infoSectionOpen ? 'collapsed' : ''}`}>
             <div className="form-group">
               <label className="form-label">Link de Afiliado</label>
               <div className="input-clear-wrapper">
                 <input
                   type="url"
                   className="form-input"
                   value={url}
                   onChange={(e) => setUrl(e.target.value)}
                   placeholder="https://mercadolivre.com/sec/ZXorKJ3"
                   list="url-history"
                 />
                 {recentLinks && recentLinks.length > 0 && (
                   <datalist id="url-history">
                     {recentLinks.map((link, index) => (
                       <option key={index} value={link} />
                     ))}
                   </datalist>
                 )}
                 {url && (
                   <button 
                     className="clear-input-btn" 
                     onClick={() => setUrl('')}
                     type="button"
                   >
                     <i className="fas fa-times"></i>
                   </button>
                 )}
               </div>
             </div>

             <div className="form-group">
               <label className="form-label">Cupom de Desconto <span className="feature-tag">OPCIONAL</span></label>
               {renderInputWithClear(
                 couponCode, 
                 handleCouponChange, 
                 "Insira um cupom de desconto", 
                 "text", 
                 "coupon-history", 
                 recentCoupons
               )}
             </div>

             <div className="discount-grid">
               <div className="form-group">
                 <label className="form-label">% Desconto</label>
                 {renderInputWithClear(
                   discountPercentage, 
                   handleDiscountChange, 
                   "Ex: 20 (sem o símbolo %)", 
                   "number", 
                   "discount-history", 
                   recentDiscounts
                 )}
               </div>
               <div className="form-group">
                 <label className="form-label">$ Desconto em R$</label>
                 {renderInputWithClear(
                   discountValue, 
                   handleDiscountValueChange, 
                   "Ex: 50", 
                   "number", 
                   "discount-value-history", 
                   recentDiscountValues
                 )}
               </div>
             </div>
           </div>
         </div>

         {/* Seção Tipo de Loja */}
         <div className="form-section">
           <div className={`section-header ${!storeSectionOpen ? 'collapsed' : ''}`} onClick={() => toggleSection('store')}>
             <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6"></path>
             </svg>
             <span className="section-title">Tipo de Loja</span>
             <svg className="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
             </svg>
           </div>

           <div className={`section-content ${!storeSectionOpen ? 'collapsed' : ''}`}>
             <div className="store-types">
               <div 
                 className={`store-type ${storeType === 'amazon' ? 'active' : ''}`}
                 onClick={() => setStoreType('amazon')}
               >
                 <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2L2 7v10c0 5.55 3.84 10 9 11 5.16-1 9-5.45 9-11V7l-10-5z"/>
                 </svg>
                 Amazon
               </div>
               <div 
                 className={`store-type ${storeType === 'loja_oficial' ? 'active' : ''}`}
                 onClick={() => setStoreType('loja_oficial')}
               >
                 <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                 </svg>
                 Loja Oficial
               </div>
               <div 
                 className={`store-type ${storeType === 'catalogo' ? 'active' : ''}`}
                 onClick={() => setStoreType('catalogo')}
               >
                 <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                 </svg>
                 Catálogo
               </div>
               <div 
                 className={`store-type ${storeType === 'loja_validada' ? 'active' : ''}`}
                 onClick={() => setStoreType('loja_validada')}
               >
                 <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v12z"/>
                 </svg>
                 Loja Validada
               </div>
               <div 
                 className={`store-type ${storeType === '' ? 'active' : ''}`}
                 onClick={() => setStoreType('')}
               >
                 <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                 </svg>
                 Nenhum
               </div>
             </div>
             
             {storeType === 'catalogo' && (
               <div className="form-group" style={{ marginTop: '16px' }}>
                 <label className="form-label">Nome do Vendedor:</label>
                 {renderInputWithClear(vendorName, setVendorName, "Insira o nome do vendedor")}
               </div>
             )}
           </div>
         </div>

         {/* Seção Imagem Alternativa */}
         <div className="form-section">
           <div className={`section-header ${!imageSectionOpen ? 'collapsed' : ''}`} onClick={() => toggleSection('image')}>
             <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span className="section-title">Imagem Alternativa</span>
            <span className="feature-tag">OPCIONAL</span>
            <svg className="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        </div>
        
        <div className={`section-content ${!imageSectionOpen ? 'collapsed' : ''}`}>
            <div className="form-group">
                <label className="form-label">Upload de Imagem</label>
                <p className="form-description">
                    Carregue uma imagem personalizada para sua promoção. Se não for fornecida, será usada a imagem do produto.
                </p>
                
                <div className="upload-zone" onClick={() => document.getElementById('image-upload').click()}>
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <p style={{color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.25rem'}}>Clique para carregar ou arraste uma imagem</p>
                    <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>PNG, JPG até 5MB</span>
                </div>
                
                <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/gif,image/jpg" 
                    onChange={handleImageUpload}
                    id="image-upload"
                    style={{display: 'none'}}
                    disabled={uploadingImage}
                />
                
                {uploadingImage && (
                    <div style={{display: 'flex', alignItems: 'center', marginTop: '12px', fontSize: '12px'}}>
                        <div className="loading"></div>
                        <span>Enviando imagem...</span>
                    </div>
                )}
                
                {customImage && (
                    <div className="custom-image-preview">
                        <img src={customImage} alt="Imagem personalizada" className="uploaded-image" />
                        <button onClick={removeCustomImage} className="btn-secondary" style={{background: '#EF4444', fontSize: '12px', padding: '8px 12px'}}>
                            <i className="fas fa-trash-alt"></i> Remover
                        </button>
                    </div>
                )}
                
                <div className="info-alert">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Em dispositivos móveis compatíveis, a imagem será anexada junto com a mensagem.
                </div>
            </div>
        </div>
    </div>

    {/* Seção Geração de Título (IA) */}
    <div className="form-section">
        <div className={`section-header ${!aiImageSectionOpen ? 'collapsed' : ''}`} onClick={() => toggleSection('aiImage')}>
            <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            <span className="section-title">Geração de Título (IA)</span>
            <span className="feature-tag">OPCIONAL</span>
            <svg className="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        </div>
        
        <div className={`section-content ${!aiImageSectionOpen ? 'collapsed' : ''}`}>
            <div className="form-group">
                <label className="form-label">Geração Automática de Título</label>
                <p className="form-description">
                    Clique no botão abaixo para gerar automaticamente um título criativo e divertido para seu produto usando IA.
                </p>
                
                <button 
                    className="btn-secondary"
                    onClick={handleGenerateTitle}
                    disabled={generatingTitle || !productData}
                >
                    {generatingTitle ? (
                        <>
                            <div className="loading"></div>
                            Gerando...
                        </>
                    ) : (
                        <>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            Gerar Título Criativo
                        </>
                    )}
                </button>
                
                {generatedTitle && (
                    <div style={{ 
                        marginTop: '15px', 
                        padding: '12px 16px', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        borderRadius: '8px',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                        <p style={{ 
                            fontWeight: '600', 
                            marginBottom: '6px', 
                            color: 'var(--text-secondary)',
                            fontSize: '13px'
                        }}>Título gerado:</p>
                        <p style={{ 
                            fontFamily: 'JetBrains Mono, monospace', 
                            fontStyle: 'italic',
                            fontSize: '14px',
                            fontWeight: '600',
                            background: 'rgba(0,0,0,0.1)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            color: 'var(--text-primary)'
                        }}>{generatedTitle}</p>
                    </div>
                )}
                
                <div className="info-alert">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    O título será adicionado automaticamente no início da sua mensagem. Você pode editar manualmente depois se quiser.
                </div>
            </div>
        </div>
    </div>

    {/* Seção Gerar Mensagens em Lote */}
    <div className="form-section">
        <div className={`section-header ${!batchSectionOpen ? 'collapsed' : ''}`} onClick={() => toggleSection('batch')}>
            <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            <span className="section-title">Gerar Mensagens em Lote</span>
            <span className="feature-tag">OPCIONAL</span>
            <svg className="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        </div>
        
        <div className={`section-content ${!batchSectionOpen ? 'collapsed' : ''}`}>
            <div className="form-group">
                <label className="form-label">Links para Processamento</label>
                <p className="form-description">
                    Cole vários links para processar de uma vez (um por linha).
                </p>
                
                <textarea 
                    className="form-textarea" 
                    value={batchLinks}
                    onChange={(e) => setBatchLinks(e.target.value)}
                    placeholder={`Cole um link por linha
Exemplo:
https://amzn.to/3Zjf9kK
https://mercadolivre.com/sec/2x3yN5P`}
                    disabled={batchProcessing}
                />
                
                <button 
                    className="btn-tertiary"
                    onClick={processBatchLinks}
                    disabled={batchProcessing}
                >
                    {batchProcessing ? (
                        <>
                            <div className="loading"></div>
                            Processando... {batchProgress}%
                        </>
                    ) : (
                        <>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Processar Links em Lote
                        </>
                    )}
                </button>
                
                {batchResults.length > 0 && (
                    <div className="batch-results" style={{ marginTop: "20px" }}>
                        <div className="batch-results-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Resultados ({batchResults.filter(r => r.success).length}/{batchResults.length})</h3>
                            <button 
                                className="btn-secondary" 
                                style={{fontSize: '12px', padding: '8px 12px'}}
                                onClick={copyAllBatchMessages}
                                disabled={batchResults.filter(r => r.success).length === 0}
                            >
                                <i className="fas fa-copy"></i> Copiar Todas
                            </button>
                        </div>
                        
                        <div className="batch-results-list" style={{ 
                            maxHeight: "300px", 
                            overflowY: "auto", 
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "8px",
                            background: "rgba(26, 26, 26, 0.6)"
                        }}>
                            {batchResults.map((result, index) => (
                                <div 
                                    key={index} 
                                    className="batch-result-item" 
                                    style={{ 
                                        padding: "12px", 
                                        borderBottom: index < batchResults.length - 1 ? "1px solid var(--border-subtle)" : "none",
                                        background: result.success ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)"
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <div style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%", fontSize: '12px' }}>
                                            {result.url}
                                        </div>
                                        <div>
                                            {result.success ? (
                                                <span style={{ color: "var(--accent-success)", fontSize: '11px', fontWeight: '500' }}>
                                                    <i className="fas fa-check-circle"></i> Sucesso
                                                </span>
                                            ) : (
                                                <span style={{ color: "#EF4444", fontSize: '11px', fontWeight: '500' }}>
                                                    <i className="fas fa-exclamation-circle"></i> Falha
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {result.success ? (
                                        <>
                                            <div style={{ fontSize: "12px", marginBottom: "8px", color: 'var(--text-secondary)' }}>
                                                {result.data.name}
                                            </div>
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                <button 
                                                    className="btn-secondary"
                                                    style={{fontSize: '10px', padding: '4px 8px'}}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(result.message);
                                                    }}
                                                >
                                                    <i className="fas fa-copy"></i> Copiar
                                                </button>
                                                <button 
                                                    className="btn-secondary"
                                                    style={{fontSize: '10px', padding: '4px 8px'}}
                                                    onClick={() => {
                                                        handleProductDataReceived(result.data, result.url);
                                                    }}
                                                >
                                                    <i className="fas fa-edit"></i> Editar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ color: "#EF4444", fontSize: "12px" }}>
                                            {result.error}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>

    {/* Botão Extrair Dados */}
    <button
        className="btn-primary"
        onClick={handleExtract}
        disabled={loading}
    >
        {loading ? (
            <>
                <div className="loading"></div>
                EXTRAINDO DADOS...
            </>
        ) : (
            <>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                EXTRAIR DADOS
            </>
        )}
    </button>
    
    {error && <div className="error-message">{error}</div>}
</main>

{/* Preview Panel */}
{productData && (
    <aside className="preview-panel">
        <div className="preview-header">
            <h3 className="preview-title">Preview da Mensagem</h3>
        </div>

        <div className="phone-mockup">
            <div className="phone-screen">
                <div className="whatsapp-header">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
                    </svg>
                    WhatsApp Business
                </div>
                <div 
                    ref={messagePreviewRef}
                    className={`message-bubble ${isEditing ? 'editing' : ''}`}
                    onClick={enableEditing}
                    onBlur={disableEditing}
                    contentEditable={isEditing}
                    suppressContentEditableWarning={true}
                >
                    <MessagePreview 
                        productData={productData}
                        couponCode={couponCode}
                        storeType={storeType}
                        vendorName={vendorName}
                        discountPercentage={discountPercentage}
                        discountValue={discountValue}
                        setFinalMessage={setFinalMessage}
                    />
                </div>
            </div>
        </div>

        {(customImage || (productData && productData.imageUrl)) && (
            <div className="preview-image-container" style={{textAlign: 'center', marginBottom: '1.5rem'}}>
                <img 
                    src={customImage || productData.imageUrl} 
                    alt={productData.name || 'Imagem da promoção'} 
                    style={{maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', objectFit: 'contain'}}
                />
            </div>
        )}

        {/* REMOVIDO: product-card */}

        <div className="action-grid">
            <button 
                className={`action-btn copy-action ${copySuccess ? 'success-animation' : ''}`}
                onClick={copyMessage}
            >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                {copySuccess ? 'COPIADO!' : 'COPIAR'}
            </button>
            <button 
                className="action-btn whatsapp-action"
                onClick={shareWhatsApp}
            >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
                </svg>
                WHATSAPP
            </button>
        </div>
    </aside>
)}
</div>
);
}

export default App;
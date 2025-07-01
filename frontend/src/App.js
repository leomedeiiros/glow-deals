// frontend/src/App.js
// No topo do arquivo App.js
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import LinkForm from './components/LinkForm';
import MessagePreview from './components/MessagePreview';
import { API_BASE_URL } from './config';  // Importando do lugar correto
import { scrapeProduct, uploadImage, sendWhatsAppMessage, generateTitle } from './services/api';  // Importando generateTitle atualizado

function App() {
 // Carregar dados salvos do localStorage
 const loadFromLocalStorage = (key, defaultValue) => {
   try {
     const item = localStorage.getItem(key);
     return item ? JSON.parse(item) : defaultValue;
   } catch (error) {
     console.warn(`Erro ao carregar ${key} do localStorage:`, error);
     return defaultValue;
   }
 };

 // Função para salvar no localStorage
 const saveToLocalStorage = (key, value) => {
   try {
     localStorage.setItem(key, JSON.stringify(value));
   } catch (error) {
     console.warn(`Erro ao salvar ${key} no localStorage:`, error);
   }
 };

 // Histórico de links usados
 const [recentLinks, setRecentLinks] = useState(loadFromLocalStorage('recentLinks', []));
 const [recentCoupons, setRecentCoupons] = useState(loadFromLocalStorage('recentCoupons', []));
 const [recentDiscounts, setRecentDiscounts] = useState(loadFromLocalStorage('recentDiscounts', []));
 const [recentDiscountValues, setRecentDiscountValues] = useState(loadFromLocalStorage('recentDiscountValues', []));
 
 // NOVO: Processamento em massa
 const [batchLinks, setBatchLinks] = useState('');
 const [batchProcessing, setBatchProcessing] = useState(false);
 const [batchResults, setBatchResults] = useState([]);
 const [batchSectionOpen, setBatchSectionOpen] = useState(false);
 const [batchProgress, setBatchProgress] = useState(0);
 
 // NOVO: API Gemini e títulos divertidos
 // Token fixo para API Gemini - não precisa mais de estado ou input do usuário
 const geminiApiKey = 'AIzaSyAZQbdDzDs3shmUTLpB3v3kfE_CE6R8SLo';
 const [generatedTitle, setGeneratedTitle] = useState('');
 const [generatingTitle, setGeneratingTitle] = useState(false);
 const [aiImageSectionOpen, setAiImageSectionOpen] = useState(false);

 const [url, setUrl] = useState('');
 const [productData, setProductData] = useState(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [couponCode, setCouponCode] = useState('');
 const [storeType, setStoreType] = useState('');
 const [vendorName, setVendorName] = useState('');
 const [discountPercentage, setDiscountPercentage] = useState('');
 const [discountValue, setDiscountValue] = useState(''); // Novo estado para desconto em R$
 const [finalMessage, setFinalMessage] = useState('');
 const [isEditing, setIsEditing] = useState(false);
 const [copySuccess, setCopySuccess] = useState(false);
 
 // Estado para a imagem personalizada
 const [customImage, setCustomImage] = useState('');
 const [uploadingImage, setUploadingImage] = useState(false);
 const [imageFile, setImageFile] = useState(null); // Para armazenar o objeto File da imagem

 // Estados para controlar quais seções estão abertas
const [infoSectionOpen, setInfoSectionOpen] = useState(true);
const [storeSectionOpen, setStoreSectionOpen] = useState(true); // Agora inicia expandido
const [imageSectionOpen, setImageSectionOpen] = useState(false);

// Referência para a prévia da mensagem editável
const messagePreviewRef = useRef(null);
const mainCardRef = useRef(null);

// Salvar histórico quando valores mudam
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

// Função para adicionar ao histórico sem duplicar
const addToHistory = (value, setter, currentArray, maxItems = 10) => {
  if (!value || value.trim() === '') return;
  
  // Remover duplicata se existir
  const newArray = currentArray.filter(item => item !== value);
  
  // Adicionar novo valor no início
  newArray.unshift(value);
  
  // Limitar tamanho
  if (newArray.length > maxItems) {
    newArray.pop();
  }
  
  // Atualizar estado
  setter(newArray);
};

// Converte preço para formato numérico para cálculos (preserva para funções de desconto)
const priceToNumber = (priceStr) => {
  if (!priceStr) return 0;
  
  // Converter para string se não for
  const priceString = String(priceStr);
  
  // Formato brasileiro (1.299,90) -> 1299.90
  if (priceString.includes(',')) {
    return parseFloat(priceString.replace(/\./g, '').replace(',', '.'));
  }
  
  // Formato americano ou já numérico
  return parseFloat(priceString);
};

// SOLUÇÃO PARA PREÇOS ACIMA DE 999 QUE PRESERVA FUNCIONALIDADE DE DESCONTOS
const handleProductDataReceived = (data, url) => {
  if (data) {
    console.log("Dados originais do produto:", {
      currentPrice: data.currentPrice,
      originalPrice: data.originalPrice
    });
    
    // Criar cópias dos preços originais para uso nos cálculos de desconto
    // Isso garante que o desconto seja calculado corretamente
    if (data.currentPrice) {
      data.displayPrice = data.currentPrice;
      
      // Verificar se precisamos remover centavos mantendo o formato de milhar
      if (typeof data.displayPrice === 'string' && data.displayPrice.includes(',')) {
        data.displayPrice = data.displayPrice.split(',')[0];
        console.log("Preço de exibição corrigido para:", data.displayPrice);
      }
    }
    
    if (data.originalPrice) {
      data.displayOriginalPrice = data.originalPrice;
      
      // Verificar se precisamos remover centavos mantendo o formato de milhar
      if (typeof data.displayOriginalPrice === 'string' && data.displayOriginalPrice.includes(',')) {
        data.displayOriginalPrice = data.displayOriginalPrice.split(',')[0];
        console.log("Preço original de exibição corrigido para:", data.displayOriginalPrice);
      }
    }
  }
  
  setProductData(data);
  
  // Adicionar URL ao histórico 
  if (url) {
    addToHistory(url, setRecentLinks, recentLinks);
  }
  
  // Verificar se o link é do Mercado Livre para definir corretamente o tipo de loja
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
    
  // DEFINIR TIPO DE LOJA PADRÃO
  if (isAmazon) {
    setStoreType('amazon');
  } else if (isMercadoLivre) {
    // Para o Mercado Livre, definir SEMPRE como "loja_oficial" por padrão
    setStoreType('loja_oficial');
  } else if (isShopee) {
    setStoreType('loja_validada');
  } else if (isCentauro || isNetshoes || isNike) {
    // Para lojas esportivas, definir como "loja_oficial" por padrão
    setStoreType('loja_oficial');
  } else {
    setStoreType('loja_validada');
  }
  
  // Resetar edição quando novos dados são carregados
  setIsEditing(false);

  // Rolar para a seção de preview após o carregamento
  setTimeout(() => {
    if (mainCardRef.current) {
      const previewSection = mainCardRef.current.querySelector('.preview-section');
      if (previewSection) {
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, 300);
};

const toggleSection = (section, e) => {
  // Prevenir propagação do evento para evitar que o clique chegue ao elemento pai
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
    case 'batch': // NOVO
      setBatchSectionOpen(!batchSectionOpen);
      break;
    case 'aiImage': // NOVO
      setAiImageSectionOpen(!aiImageSectionOpen);
      break;
    default:
      break;
  }
};
// Handler para cupom de desconto
const handleCouponChange = (value) => {
  setCouponCode(value);
  if (value) {
    addToHistory(value, setRecentCoupons, recentCoupons);
  }
};

// Handler para porcentagem de desconto
const handleDiscountChange = (value) => {
  setDiscountPercentage(value);
  // Se preencheu porcentagem, limpa o valor de desconto em R$
  if (value) {
    setDiscountValue('');
    addToHistory(value, setRecentDiscounts, recentDiscounts);
  }
};

// Handler para valor de desconto em R$
const handleDiscountValueChange = (value) => {
  setDiscountValue(value);
  // Se preencheu valor em R$, limpa a porcentagem
  if (value) {
    setDiscountPercentage('');
    addToHistory(value, setRecentDiscountValues, recentDiscountValues);
  }
};

// Função para carregar imagem personalizada
const handleImageUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Verificar tamanho e tipo do arquivo
  if (file.size > 5 * 1024 * 1024) { // 5MB
    setError('A imagem não pode ser maior que 5MB');
    return;
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    setError('Apenas imagens nos formatos JPG, JPEG, PNG e GIF são permitidas');
    return;
  }
  
  // Guardar o objeto File para uso posterior com a Web Share API
  setImageFile(file);
  
  // Upload da imagem para o servidor
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

// NOVO: Handler para geração de título divertido com IA (SEM PROMPT DO USUÁRIO)
const handleGenerateTitle = async () => {
  if (!productData) {
    setError('Você precisa extrair os dados de um produto primeiro.');
    return;
  }
  
  try {
    setGeneratingTitle(true);
    setError('');
    
    // Chamar o backend que já tem o prompt fixo
    const response = await generateTitle(geminiApiKey, productData);
    
    if (response.success) {
      const cleanTitle = response.title;
      console.log("Título gerado:", cleanTitle);
      
      // Atualizar a mensagem final com o título
      setGeneratedTitle(cleanTitle);
      
      // Atualizar a mensagem editável com o novo título
      if (messagePreviewRef.current && finalMessage) {
        let updatedMessage = finalMessage;
        // Se já tiver um título em asteriscos ou itálico, substituir; caso contrário, adicionar no início
        if (updatedMessage.startsWith('_') && updatedMessage.includes('_\n')) {
          // Substituir o título existente
          updatedMessage = updatedMessage.replace(/^_[^_\n]*_/, `_${cleanTitle}_`);
        } else if (updatedMessage.startsWith('*') && updatedMessage.includes('*\n')) {
          // Substituir o título existente (em negrito)
          updatedMessage = `_${cleanTitle}_\n\n` + updatedMessage.substring(updatedMessage.indexOf('\n\n') + 2);
        } else {
          // Adicionar um novo título no início em itálico
          updatedMessage = `_${cleanTitle}_\n\n` + updatedMessage;
        }
        setFinalMessage(updatedMessage);
        messagePreviewRef.current.innerHTML = updatedMessage;
      }
      
    } else {
      setError(response.error || 'Não foi possível gerar um título. Tente novamente.');
    }
  } catch (error) {
    console.error('Erro ao gerar título com IA:', error);
    setError('Falha ao gerar título. Verifique sua conexão e tente novamente.');
  } finally {
    setGeneratingTitle(false);
  }
};

// Função para remover a imagem personalizada
const removeCustomImage = () => {
  setCustomImage('');
  setImageFile(null);
};

// Habilitar modo de edição para a mensagem
const enableEditing = () => {
  if (!isEditing && messagePreviewRef.current) {
    setIsEditing(true);
    messagePreviewRef.current.setAttribute('contenteditable', 'true');
    messagePreviewRef.current.focus();
  }
};

// Desabilitar modo de edição para a mensagem
const disableEditing = () => {
  if (isEditing && messagePreviewRef.current) {
    setIsEditing(false);
    messagePreviewRef.current.setAttribute('contenteditable', 'false');
    // Atualizar a mensagem final com o conteúdo editado
    setFinalMessage(messagePreviewRef.current.innerText);
  }
};

// NOVO: Processar links em lote
const processBatchLinks = async () => {
  if (!batchLinks.trim()) {
    setError('Insira pelo menos um link para processamento em lote');
    return;
  }
  
  // Extrair links do texto (um por linha)
  const links = batchLinks.split('\n').filter(link => link.trim());
  
  if (links.length === 0) {
    setError('Nenhum link válido encontrado');
    return;
  }
  
  setBatchProcessing(true);
  setBatchResults([]);
  setBatchProgress(0);
  setError('');
  
  // Processar cada link sequencialmente
  const results = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i].trim();
    if (!link) continue;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/scrape`, { url: link });
      
      if (response.data) {
        // Gerar mensagem para este produto
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
    
    // Atualizar progresso
    setBatchProgress(Math.floor(((i + 1) / links.length) * 100));
  }
  
  setBatchResults(results);
  setBatchProcessing(false);
};

// NOVO: Gerar mensagem para um produto (sem alterar estado)
const generateMessageForProduct = async (productData, url) => {
  if (!productData) return '';
  
  // Criar formatador para usar nas mensagens em lote
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
  
  // Determinar tipo de loja para este produto
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
  
  // Gerar texto de tipo de loja
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
        // Limpar nome do vendedor
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
  
  // Verificar se é Amazon
  const isAmazon = productStoreType === 'amazon' || 
                  (productData.vendor === 'Amazon') ||
                  (productData.platform && 
                   productData.platform.toLowerCase().includes('amazon'));
  
  // Preços formatados
  const rawCurrentPrice = productData.currentPrice;
  const rawOriginalPrice = productData.originalPrice;
  const processedCurrentPrice = productData.displayPrice || formatPrice(rawCurrentPrice);
  const processedOriginalPrice = productData.displayOriginalPrice || formatPrice(rawOriginalPrice);
  
  // Mensagem de loja
  const storeTypeText = getStoreTypeText(productStoreType, productData);
  
  // Verificar se há desconto real
  const hasRealDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice) return false;
    
    const originalValue = parseFloat(String(originalPrice).replace(/\./g, '').replace(',', '.'));
    const currentValue = parseFloat(String(currentPrice).replace(/\./g, '').replace(',', '.'));
    
    return !isNaN(originalValue) && !isNaN(currentValue) && 
           originalValue > currentValue && 
           (originalValue - currentValue) / originalValue > 0.05;
  };
  
  // Aplicar descontos se definidos
  let finalPrice = processedCurrentPrice;
  
  // Gerar mensagem de preço
  let priceText = '';
  
  // Para Amazon, mostrar apenas o preço atual
  if (isAmazon) {
    priceText = `✅  Por *R$ ${finalPrice}*`;
  } else {
    // Para outras lojas
    if (processedOriginalPrice && hasRealDiscount(rawOriginalPrice, finalPrice)) {
      priceText = `✅  ~De R$ ${processedOriginalPrice}~ por *R$ ${finalPrice}*`;
    } else {
      priceText = `✅  Por *R$ ${finalPrice}*`;
    }
  }
  
  // Montar mensagem completa
  let message = `➡️ *${productData.name}*`;
  
  if (storeTypeText) {
    message += `\n_${storeTypeText}_`;
  }
  
  message += `\n\n${priceText}`;
  
  // Adicionar cupom se fornecido
  if (couponCode) {
    message += `\n🎟️ Use o cupom: *${couponCode}*`;
  }
  
  // Adicionar link do produto
  message += `\n🛒 ${productData.productUrl || url}`;
  
  message += `\n\n☑️ Link do grupo: https://linktr.ee/glowdeals`;
  
  return message;
};

// NOVO: Copiar todas as mensagens em lote
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

// Função para renderizar um campo de texto com botão de limpar e datalist
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

// Compartilhar mensagem e imagem no WhatsApp usando Web Share API
const shareWhatsApp = async () => {
if (!finalMessage) {
  setError('Nenhuma mensagem para compartilhar.');
  return;
}

// Se estamos em modo de edição, desabilite primeiro para garantir que o conteúdo foi salvo
if (isEditing) {
  disableEditing();
}

// Obter a mensagem atual (possivelmente editada)
const messageToShare = messagePreviewRef.current ? messagePreviewRef.current.innerText : finalMessage;

// Tentar usar Web Share API se estiver disponível (para texto ou para arquivos)
if (navigator.share) {
  try {
    // Se tiver imagem, tenta compartilhar com ela
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      await navigator.share({
        text: messageToShare,
        files: [imageFile]
      });
    } else {
      // Caso contrário, compartilha apenas o texto
      await navigator.share({
        text: messageToShare
      });
    }
    return; // Se compartilhou com sucesso, encerra a função
  } catch (err) {
    console.warn('Compartilhamento falhou:', err);
  // Continua para o fallback abaixo
  }
}

// Fallback para métodos tradicionais se Web Share API não estiver disponível ou falhar
// Verificar se é dispositivo móvel
const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

if (isMobile) {
  // Em dispositivos móveis, tentar abrir diretamente o app
  const encodedMessage = encodeURIComponent(messageToShare);
  window.location.href = `whatsapp://send?text=${encodedMessage}`;
  
  // Como fallback, se após 1 segundo o usuário ainda estiver na página,
  // redirecionar para o wa.me que funciona melhor em iOS
  setTimeout(() => {
    if (document.hasFocus()) {
      window.location.href = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    }
  }, 1000);
} else {
  // Em desktop, abrir o WhatsApp Web
  window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(messageToShare)}`, '_blank');
}
};

// Copiar mensagem para o clipboard
const copyMessage = () => {
  // Se estamos em modo de edição, desabilite primeiro para garantir que o conteúdo foi salvo
  if (isEditing) {
    disableEditing();
  }

  // Obter a mensagem atual (possivelmente editada)
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

// Função para extrair dados do produto
const handleExtract = async () => {
  const inputEl = document.querySelector('input[type="url"]');
  if (!inputEl || !inputEl.value) {
    setError('Por favor, insira um link de afiliado.');
    return;
  }
  
  try {
    setLoading(true);
    setError('');
    
    // URL correta do backend no Render
    const response = await axios.post(`${API_BASE_URL}/api/scrape`, { 
      url: inputEl.value 
    });
    
    // Passar os dados do produto e a URL usada para processamento
    handleProductDataReceived(response.data, inputEl.value);
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
  <div className="container">
    <header className="app-header">
      <h1 className="app-title">GeraPromo</h1>
      <span className="app-version">Versão 2.7</span>
    </header>
    
    <div className="main-card" ref={mainCardRef}>
      <div className="card-header">
        <h2 className="card-title">Gerador de Mensagens Promocionais</h2>
        <p className="card-subtitle">Crie mensagens atrativas para compartilhar promoções no WhatsApp</p>
      </div>
      
      {/* Seção de Informações da Promoção */}
      <div className="section-header" onClick={() => toggleSection('info')}>
        <div className="section-title">
          <i className="fas fa-link"></i>
          Informações da Promoção
        </div>
        <div className="chevron-container" onClick={(e) => toggleSection('info', e)}>
          <i className={`fas fa-chevron-down chevron-icon ${infoSectionOpen ? 'open' : ''}`}></i>
        </div>
      </div>
      
      {infoSectionOpen && (
        <div className="section-content">
          <div className="form-group">
            <label className="form-label">Link da promoção</label>
            <div className="input-clear-wrapper">
              <input
                type="url"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link da Amazon ou Mercado Livre"
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
            <label className="form-label">Cupom de desconto <span className="optional-tag">Opcional</span></label>
            {renderInputWithClear(
              couponCode, 
              handleCouponChange, 
              "Insira um cupom de desconto", 
              "text", 
              "coupon-history", 
              recentCoupons
            )}
          </div>
          
          <div className="discount-fields-grid">
            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-percent"></i> Desconto % <span className="optional-tag">Opcional</span>
              </label>
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
              <label className="form-label">
                <i className="fas fa-dollar-sign"></i> Desconto em R$ <span className="optional-tag">Opcional</span>
              </label>
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
          
          {(discountPercentage && discountValue) && (
            <div className="discount-warning">
              <i className="fas fa-exclamation-triangle"></i> Atenção: Use apenas um tipo de desconto por vez.
            </div>
          )}
        </div>
      )}
      
      {/* Seção de Tipo de Loja */}
      <div className="section-header" onClick={() => toggleSection('store')}>
        <div className="section-title">
          <i className="fas fa-store"></i>
          Tipo de Loja
        </div>
        <div className="chevron-container" onClick={(e) => toggleSection('store', e)}>
          <i className={`fas fa-chevron-down chevron-icon ${storeSectionOpen ? 'open' : ''}`}></i>
        </div>
      </div>

      {storeSectionOpen && (
        <div className="section-content">
          <div className="store-type-group">
            <button 
              type="button"
              className={`store-type-btn ${storeType === 'amazon' ? 'active' : ''}`}
              onClick={() => {
                setStoreType('amazon');
                console.log("Botão Amazon clicado, storeType =", 'amazon');
              }}
            >
              <i className="fab fa-amazon"></i> Amazon
            </button>
            <button 
              type="button"
              className={`store-type-btn ${storeType === 'loja_oficial' ? 'active' : ''}`}
              onClick={() => {
                setStoreType('loja_oficial');
                console.log("Botão Loja Oficial clicado, storeType =", 'loja_oficial');
              }}
            >
              <i className="fas fa-check-circle"></i> Loja Oficial
            </button>
            <button 
              type="button"
              className={`store-type-btn ${storeType === 'catalogo' ? 'active' : ''}`}
              onClick={() => {
                setStoreType('catalogo');
                console.log("Botão Catálogo clicado, storeType =", 'catalogo');
              }}
            >
              <i className="fas fa-list"></i> Catálogo
            </button>
            <button 
              type="button"
              className={`store-type-btn ${storeType === 'loja_validada' ? 'active' : ''}`}
              onClick={() => {
                setStoreType('loja_validada');
                console.log("Botão Loja validada clicado, storeType =", 'loja_validada');
              }}
            >
              <i className="fas fa-shield-alt"></i> Loja validada
            </button>
            <button 
              type="button"
              className={`store-type-btn ${storeType === '' ? 'active' : ''}`}
              onClick={() => {
                setStoreType('');
                console.log("Botão Nenhum clicado, storeType =", '');
              }}
            >
              <i className="fas fa-times"></i> Nenhum
            </button>
          </div>
          
          {storeType === 'catalogo' && (
            <div className="form-group" style={{ marginTop: '10px' }}>
              <label className="form-label">Nome do Vendedor:</label>
              {renderInputWithClear(vendorName, setVendorName, "Insira o nome do vendedor")}
            </div>
          )}
        </div>
      )}
      
      {/* Nova Seção: Imagem Personalizada */}
      <div className="section-header" onClick={() => toggleSection('image')}>
        <div className="section-title">
          <i className="fas fa-image"></i>
          Imagem Personalizada
          <span className="optional-tag">Opcional</span>
        </div>
        <div className="chevron-container" onClick={(e) => toggleSection('image', e)}>
          <i className={`fas fa-chevron-down chevron-icon ${imageSectionOpen ? 'open' : ''}`}></i>
        </div>
      </div>
      
      {imageSectionOpen && (
        <div className="section-content">
          <div className="form-group">
            <label className="form-label">Upload de imagem</label>
            <p className="form-description">
              Carregue uma imagem personalizada para sua promoção. 
              Se não for fornecida, será usada a imagem do produto.
            </p>
            <div className="web-share-info">
              <p className="web-share-info-text">
                <i className="fas fa-info-circle"></i> Em dispositivos móveis compatíveis, a imagem será anexada junto com a mensagem.
              </p>
            </div>
            
            <div className="file-upload-container">
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/gif,image/jpg" 
                onChange={handleImageUpload}
                id="image-upload"
                className="file-input"
                disabled={uploadingImage}
              />
            </div>
            
            {uploadingImage && (
              <div className="upload-status">
                <div className="loading"></div>
                <span>Enviando imagem...</span>
              </div>
            )}
            
            {customImage && (
              <div className="custom-image-preview">
                <img src={customImage} alt="Imagem personalizada" className="uploaded-image" />
                <button onClick={removeCustomImage} className="btn-sm btn-danger">
                  <i className="fas fa-trash-alt"></i> Remover
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Nova Seção: Criar Título Divertido - SEM CAMPO DE PROMPT */}
      <div className="section-header" onClick={() => toggleSection('aiImage')}>
        <div className="section-title">
          <i className="fas fa-robot"></i>
          Criar Título Com IA
          <span className="optional-tag">Novo</span>
        </div>
        <div className="chevron-container" onClick={(e) => toggleSection('aiImage', e)}>
          <i className={`fas fa-chevron-down chevron-icon ${aiImageSectionOpen ? 'open' : ''}`}></i>
        </div>
      </div>
      
      {aiImageSectionOpen && (
        <div className="section-content">
          <div className="form-group">
            <p className="form-description">
              Gere um título criativo e divertido no estilo Glow Deals para sua promoção. 
              A IA criará frases chamativas que combinam com o produto selecionado.
            </p>
          </div>
          
          <button 
            className="btn"
            style={{ 
              width: '100%',
              backgroundColor: 'var(--accent-color)',
              position: 'relative'
            }}
            onClick={handleGenerateTitle}
            disabled={generatingTitle || !productData}
          >
            {generatingTitle ? (
              <>
                <div className="loading"></div>
                Gerando título...
              </>
            ) : (
              <>
                <i className="fas fa-lightbulb"></i>
                Gerar Título Criativo
              </>
            )}
          </button>
          
          {generatedTitle && (
            <div style={{ 
              marginTop: '15px', 
              padding: '10px', 
              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--accent-color)'
            }}>
              <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Título gerado:</p>
              <p style={{ 
                fontFamily: 'monospace', 
                fontStyle: 'italic',
                fontSize: '1.1rem',
                backgroundColor: 'rgba(0,0,0,0.05)',
                padding: '8px',
                borderRadius: '4px'
              }}>{generatedTitle}</p>
            </div>
          )}
          
          <div className="web-share-info" style={{ marginTop: '15px' }}>
            <p className="web-share-info-text">
              <i className="fas fa-lightbulb"></i> Dica: O título será adicionado automaticamente à sua mensagem. Você também pode editar a mensagem manualmente se preferir.
            </p>
          </div>
        </div>
      )}

      {/* NOVA SEÇÃO: Processamento em Lote */}
      <div className="section-header" onClick={() => toggleSection('batch')}>
        <div className="section-title">
          <i className="fas fa-tasks"></i>
          Gerar Mensagens em Lote
          <span className="optional-tag">Novo</span>
        </div>
        <div className="chevron-container" onClick={(e) => toggleSection('batch', e)}>
          <i className={`fas fa-chevron-down chevron-icon ${batchSectionOpen ? 'open' : ''}`}></i>
        </div>
      </div>
      
      {batchSectionOpen && (
        <div className="section-content">
          <div className="form-group">
            <label className="form-label">Links para Processamento</label>
            <p className="form-description">
              Cole vários links para processar de uma vez (um por linha).
            </p>
            
            <textarea 
              className="form-input" 
              style={{ minHeight: "120px" }}
              value={batchLinks}
              onChange={(e) => setBatchLinks(e.target.value)}
              placeholder="Cole um Link por linha&#10;Exemplo:&#10;https://amzn.to/3Zjf9kk&#10;https://mercadolivre.com/sec/2x3yNSP"
              disabled={batchProcessing}
            />
            
            <button 
              className="btn"
              style={{ marginTop: "10px", width: "100%" }}
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
                  <i className="fas fa-play"></i> Processar Links em Lote
                </>
              )}
            </button>
            
            {batchResults.length > 0 && (
              <div className="batch-results" style={{ marginTop: "20px" }}>
                <div className="batch-results-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <h3 style={{ margin: 0 }}>Resultados ({batchResults.filter(r => r.success).length}/{batchResults.length})</h3>
                  <button 
                    className="btn-sm" 
                    onClick={copyAllBatchMessages}
                    disabled={batchResults.filter(r => r.success).length === 0}
                  >
                    <i className="fas fa-copy"></i> Copiar Todas
                  </button>
                </div>
                
                <div className="batch-results-list" style={{ 
                  maxHeight: "300px", 
                  overflowY: "auto", 
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                  backgroundColor: "var(--input-bg)"
                }}>
                  {batchResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="batch-result-item" 
                      style={{ 
                        padding: "10px", 
                        borderBottom: index < batchResults.length - 1 ? "1px solid var(--border-color)" : "none",
                        backgroundColor: result.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                        <div style={{ fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                          {result.url}
                        </div>
                        <div>
                          {result.success ? (
                            <span style={{ color: "var(--success-color)" }}>
                              <i className="fas fa-check-circle"></i> Sucesso
                            </span>
                          ) : (
                            <span style={{ color: "var(--error-color)" }}>
                              <i className="fas fa-exclamation-circle"></i> Falha
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {result.success ? (
                        <>
                          <div style={{ fontSize: "0.9rem", marginBottom: "5px" }}>
                            {result.data.name}
                          </div>
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button 
                              className="btn-sm"
                              onClick={() => {
                                navigator.clipboard.writeText(result.message);
                              }}
                            >
                              <i className="fas fa-copy"></i> Copiar
                            </button>
                            <button 
                              className="btn-sm"
                              onClick={() => {
                                handleProductDataReceived(result.data, result.url);
                              }}
                            >
                              <i className="fas fa-edit"></i> Editar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: "var(--error-color)", fontSize: "0.9rem" }}>
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
      )}

      {/* Botão Extrair Dados - Com destaque especial para garantir visibilidade */}
      <div style={{ 
        padding: '24px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'rgba(88, 101, 242, 0.1)'
      }}>
        <button
          className="btn extract-btn"
          onClick={handleExtract}
          disabled={loading}
          style={{
            background: loading ? '#3e4adf' : 'linear-gradient(90deg, #5865f2, #3e4adf)',
            padding: '18px',
            fontSize: '1.15rem',
            fontWeight: 'bold',
            boxShadow: '0 6px 15px rgba(88, 101, 242, 0.5)',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            border: 'none',
            color: 'white',
            borderRadius: '12px',
            cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          {loading ? (
            <>
              <div className="loading"></div>
              Extraindo dados...
            </>
          ) : (
            <>
              <i className="fas fa-search"></i>
              Extrair Dados
            </>
          )}
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>
      
      {loading ? (
        <div className="section-content" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="loading"></div>
            <span>Carregando informações do produto...</span>
          </div>
        </div>
      ) : productData ? (
        <div className="preview-section">
          <p className="preview-label">Prévia da mensagem</p>
          
          {/* Imagem da Prévia */}
          {(customImage || (productData && productData.imageUrl)) && (
            <div className="preview-image-container">
              <img 
                src={customImage || productData.imageUrl} 
                alt={productData.name || 'Imagem da promoção'} 
                className="preview-image"
              />
            </div>
          )}
          
          {/* Mensagem editável */}
          <div 
            ref={messagePreviewRef}
            className={`message-preview ${isEditing ? 'editing' : ''}`}
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
          
          {/* Texto de instrução para editar */}
          <div className="edit-instructions">
            <i className="fas fa-edit"></i> Clique na mensagem para editar
          </div>
          
          <div className="actions-row">
            <button 
              id="copyButton"
              className={`copy-btn ${copySuccess ? 'success-animation' : ''}`}
              onClick={copyMessage}
            >
              <i className={`${copySuccess ? 'fas fa-check' : 'fas fa-copy'}`}></i>
              {copySuccess ? 'Copiado!' : 'Copiar Mensagem'}
            </button>
            
            <button 
              className="share-btn"
              onClick={shareWhatsApp}
            >
              <i className="fab fa-whatsapp"></i>
              Compartilhar no WhatsApp
            </button>
          </div>
        </div>
      ) : null}
    </div>
    
    <div className="watermark" style={{ textAlign: 'center', margin: '20px 0', color: 'var(--text-secondary)' }}>
      GeraPromo &copy; 2025 - Todos os direitos reservados
    </div>
  </div>
);
}

export default App;
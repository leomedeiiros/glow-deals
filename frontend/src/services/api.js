// frontend/src/services/api.js
import axios from 'axios';

import { API_BASE_URL } from '../config';

export const scrapeProduct = async (url) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/scrape`, { url });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const uploadImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const sendWhatsAppMessage = async (message, chatName) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/send-whatsapp`, { message, chatName });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Nova função para geração de título divertido (com prompt fixo no backend)
export const generateTitle = async (apiKey, productData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/generate-ai-title`, {
      apiKey,
      productData
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao gerar título com IA:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Falha ao gerar título.'
    };
  }
};
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

// Nova função para geração de título divertido (substitui a anterior de imagem)
export const generateTitle = async (prompt, apiKey, productData) => {
  try {
    // Criar um prompt mais específico baseado no produto
    const fullPrompt = `Crie um título divertido, criativo e curto (máximo 50 caracteres) para um anúncio de produto no WhatsApp. 
    O produto é: ${productData.name}. 
    O título deve ser algo que chame atenção e seja humorístico, similar a estes exemplos: 
    "UNICO VEICULO QUE CONSIGO COMPRAR" para uma bicicleta,
    "NEO QLED DA SAMSUNG TEM QUALIDADE ABSURDA" para uma TV,
    "O UNICO TIGRINHO QUE VIRA INVESTIR" para cuecas da Puma.
    Use LETRAS MAIÚSCULAS para todo o título.
    Responda APENAS com o título, sem nenhum texto adicional.
    ${prompt ? `Considerações adicionais: ${prompt}` : ''}`;
    
    // Chamada direta para a API Gemini
    const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 50
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      }
    });
    
    // Processar e retornar a resposta
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts) {
      
      const generatedText = response.data.candidates[0].content.parts[0].text;
      // Limpar e formatar o título (remover aspas, ajustar espaços)
      const cleanTitle = generatedText.replace(/^["'\s]+|["'\s]+$/g, '');
      
      return {
        success: true,
        title: cleanTitle
      };
    } else {
      return {
        success: false,
        error: 'Não foi possível gerar um título.'
      };
    }
  } catch (error) {
    console.error('Erro ao gerar título com IA:', error);
    return {
      success: false,
      error: error.response?.data?.error?.message || 'Falha ao gerar título.'
    };
  }
};
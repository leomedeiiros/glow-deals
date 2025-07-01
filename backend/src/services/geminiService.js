// backend/src/services/geminiService.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Função para gerar nome de arquivo único
const generateUniqueFilename = () => {
 return crypto.randomBytes(16).toString('hex') + '.jpg';
};

// Função para gerar título com IA 
exports.generateTitle = async (apiKey, productData) => {
 try {
   console.log('Gerando título com API Gemini para o produto:', productData.name);
   
   // PROMPT FIXO NO CÓDIGO
   const fixedPrompt = `Gere uma frase curta, criativa e no estilo de meme, começando com um emoji chamativo, como aquelas que usamos no WhatsApp para chamar atenção antes de anunciar um produto.
* A frase deve gerar curiosidade, humor ou sensação de urgência.
* Evite frases comuns ou genéricas.
* Use o mesmo estilo que Glow Deals aplica: direto, popular, com emoção ou engraçado, parecendo algo que um amigo mandaria no grupo dizendo "olha isso aqui".
* Não mencione o nome do produto.
* A frase deve refletir o benefício, uso, público ou apelo emocional do produto em questão.
Crie apenas **uma frase** nesse estilo. Não explique nada. Apenas retorne a frase pronta para ser colada no WhatsApp.
**Exemplos de frases do estilo que quero:**
* 🔥 Quem tem bom gosto já clicou
* 🧼 Esse aqui vai sumir do estoque igual sabão no banho
* 🎯 O favorito de quem entende do assunto
* 💥 Acabou a desculpa, agora dá pra levar
* 😍 Eu juro que esse foi o mais top que já vi
* 🧠 Quem sabe, sabe… esse aqui é diferenciado
* 🚨 Piscou, acabou!
* 🛒 Se demorar, vai ficar sem
* 🤐 Quem comprou não conta pra ninguém
* 🤑 Essa oferta parece mentira
* 🤯 Esse aqui virou lenda no grupo
* 👀 Olha esse aqui e tenta não surtar
* 🙌 Finalmente achei o que eu queria
* 🔥 Cheiroso desse jeito devia ser proibido
* 🧦 Adeus gaveta bagunçada, olá paz interior
* 🛠️ Nunca mais vai sofrer pra furar cinto
* 👟 Quem experimenta, não quer mais outro
* 💆 Esse aqui relaxa até pensamento
* 🎧 Solta o play e esquece o mundo
* 🧔 Agora é barba de respeito ou nada
**Importante:** adapte a frase para combinar com o tipo de produto: ${productData.name}.`;
   
   // URL da API Gemini para texto
   const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
   
   // Preparar payload para a API Gemini
   const payload = {
     contents: [
       {
         parts: [
           { text: fixedPrompt }
         ]
       }
     ],
     generationConfig: {
       temperature: 0.9,
       topP: 0.8,
       topK: 32,
       maxOutputTokens: 50
     }
   };
   
   console.log('Enviando requisição para API Gemini...');
   
   // Fazer requisição para a API
   const response = await axios.post(apiUrl, payload, {
     headers: {
       'Content-Type': 'application/json'
     }
   });
   
   console.log('Resposta recebida da API Gemini');
   
   // Verificar se a resposta contém texto
   if (response.data && 
       response.data.candidates && 
       response.data.candidates[0] && 
       response.data.candidates[0].content && 
       response.data.candidates[0].content.parts) {
     
     const parts = response.data.candidates[0].content.parts;
     
     // Extrair texto da resposta
     const textPart = parts.find(part => part.text);
     if (textPart && textPart.text) {
       const titleText = textPart.text.trim();
       console.log('Título gerado:', titleText);
       
       return {
         success: true,
         title: titleText
       };
     }
   }
   
   console.error('Falha ao extrair título da resposta da API Gemini');
   console.error('Resposta recebida:', JSON.stringify(response.data, null, 2));
   
   return {
     success: false,
     error: 'Não foi possível gerar um título com a API.'
   };
   
 } catch (error) {
   console.error('Erro ao gerar título com API Gemini:', error);
   
   // Formatar mensagem de erro
   let errorMessage = 'Falha ao gerar título com IA.';
   
   if (error.response) {
     // O servidor respondeu com um código de status fora do intervalo 2xx
     console.error('Erro na resposta:', error.response.data);
     
     // Verificar se há mensagem de erro específica da API
     if (error.response.data && error.response.data.error) {
       errorMessage = `Erro da API Gemini: ${error.response.data.error.message || 'Erro desconhecido'}`;
     }
   } else if (error.request) {
     // A requisição foi feita mas não recebeu resposta
     errorMessage = 'Sem resposta do servidor. Verifique sua conexão.';
   }
   
   return {
     success: false,
     error: errorMessage
   };
 }
};

// Manter a função original para geração de imagem (caso precise no futuro)
exports.generateImage = async (prompt, apiKey, productData) => {
 try {
   console.log('Gerando imagem com API Imagen para o produto:', productData.name);
   
   // Construir um prompt otimizado para geração de imagens
   let enhancedPrompt = `Create a photorealistic product image of ${productData.name}. `;
   
   // Adicionar detalhes do prompt original se fornecido
   if (prompt) {
     enhancedPrompt += prompt;
   }
   
   // Adicionar instruções específicas para imagens de alta qualidade
   enhancedPrompt += ` The image should be high-quality, professional product photography, with studio lighting, on a light blue-white gradient background, with sharp focus on the product. No text or watermarks. Show the product from a slightly angled view to highlight its features. Make sure to show the product clearly and prominently in the center of the frame.`;
   
   // URL da API Imagen - específica para geração de imagens
   const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@latest:generateContent?key=${apiKey}`;
   
   // Preparar payload específico para a API Imagen
   const payload = {
     contents: [
       {
         parts: [
           { text: enhancedPrompt }
         ]
       }
     ],
     generationConfig: {
       temperature: 0.4,
       topP: 0.8,
       topK: 32,
       sampleCount: 1
     }
   };
   
   console.log('Enviando requisição para API Imagen...');
   
   // Fazer requisição para a API
   const response = await axios.post(apiUrl, payload, {
     headers: {
       'Content-Type': 'application/json'
     }
   });
   
   console.log('Resposta recebida da API Imagen');
   
   // Verificar se a resposta contém dados de imagem
   if (response.data && 
       response.data.candidates && 
       response.data.candidates[0] && 
       response.data.candidates[0].content && 
       response.data.candidates[0].content.parts) {
     
     const parts = response.data.candidates[0].content.parts;
     
     // Imprimir os tipos de partes recebidas para diagnóstico
     console.log('Partes da resposta:', parts.map(part => {
       return Object.keys(part).join(', ');
     }));
     
     // Procurar parte que contém imagem
     const imagePart = parts.find(part => part.inlineData && part.inlineData.data);
     
     if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
       // Extrair dados da imagem (base64)
       const imageData = imagePart.inlineData.data;
       
       // Decodificar base64 para buffer de imagem
       const imageBuffer = Buffer.from(imageData, 'base64');
       
       // Definir caminho para salvar a imagem
       const uploadDir = path.join(__dirname, '../../uploads');
       
       // Verificar se diretório existe, se não, criar
       if (!fs.existsSync(uploadDir)) {
         fs.mkdirSync(uploadDir, { recursive: true });
       }
       
       // Gerar nome de arquivo único
       const filename = generateUniqueFilename();
       const imagePath = path.join(uploadDir, filename);
       
       // Salvar imagem no servidor
       fs.writeFileSync(imagePath, imageBuffer);
       
       console.log(`Imagem gerada e salva como: ${filename}`);
       
       // Retornar URL da imagem gerada
       return {
         success: true,
         imageUrl: `/uploads/${filename}`
       };
     } else {
       // Verificar se a resposta contém texto
       const textPart = parts.find(part => part.text);
       if (textPart && textPart.text) {
         const textResponse = textPart.text;
         console.log('Resposta de texto recebida da API Imagen:', textResponse);
         
         return {
           success: false,
           error: `A API Imagen retornou texto em vez de uma imagem: "${textResponse.substring(0, 150)}..."`,
           fullText: textResponse
         };
       }
     }
   }
   
   console.error('Falha ao extrair imagem da resposta da API Imagen');
   console.error('Resposta recebida:', JSON.stringify(response.data, null, 2));
   
   // Se a API Imagen falhou, uma última opção é usar uma imagem de placeholder
   return {
     success: false,
     error: 'Não foi possível gerar uma imagem com a API. Por favor, tente novamente mais tarde ou use uma imagem personalizada.',
     suggestion: 'Recomendamos fazer upload de uma imagem personalizada como alternativa.'
   };
   
 } catch (error) {
   console.error('Erro ao gerar imagem com API Imagen:', error);
   
   // Formatar mensagem de erro para ser mais útil
   let errorMessage = 'Falha ao gerar imagem com IA.';
   
   if (error.response) {
     // O servidor respondeu com um código de status fora do intervalo 2xx
     console.error('Erro na resposta:', error.response.data);
     
     // Verificar se há mensagem de erro específica da API
     if (error.response.data && error.response.data.error) {
       errorMessage = `Erro da API Imagen: ${error.response.data.error.message || 'Erro desconhecido'}`;
     }
   } else if (error.request) {
     // A requisição foi feita mas não recebeu resposta
     errorMessage = 'Sem resposta do servidor. Verifique sua conexão.';
   }
   
   return {
     success: false,
     error: errorMessage,
     suggestion: 'Recomendamos fazer upload de uma imagem personalizada como alternativa.'
   };
 }
};
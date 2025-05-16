const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar o multer para upload de imagens
const uploadDir = path.join(__dirname, '../uploads');

// Criar diretório de uploads se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'img-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: function(req, file, cb) {
    // Verificar tipos permitidos
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens são permitidas (jpg, jpeg, png, gif)'));
  }
});

// Rota para extrair informações do produto
router.post('/scrape', scrapeController.scrapeProduct);

// Rota para enviar mensagem pelo WhatsApp
router.post('/send-whatsapp', scrapeController.sendWhatsApp);

// Rota para upload de imagem
router.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada' });
    }
    
    // Criar URL da imagem
    const baseUrl = req.protocol + '://' + req.get('host');
    const imageUrl = baseUrl + '/uploads/' + req.file.filename;
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: 'Imagem carregada com sucesso'
    });
  } catch (error) {
    console.error('Erro no upload de imagem:', error);
    res.status(500).json({ error: 'Falha ao processar upload de imagem', details: error.message });
  }
});

// Rota para geração de imagem com IA
router.post('/generate-ai-image', scrapeController.generateAIImage);

module.exports = router;
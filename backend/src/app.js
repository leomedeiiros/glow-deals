require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração do CORS para permitir requisições do Vercel e localhost
app.use(cors({
  origin: ['https:///guerra-dealsfit.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para processar formulários

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas API
app.use('/api', apiRoutes);

// Rota raiz para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.send('API GeraPromo está funcionando!');
});

// Handler de erros global
app.use((err, req, res, next) => {
  console.error('Erro global:', err);
  res.status(500).json({ 
    error: 'Ocorreu um erro no servidor', 
    details: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
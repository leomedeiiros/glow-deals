# Etapa 1: Build do frontend
FROM node:18 AS build-frontend

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# Etapa 2: Backend + Chromium + frontend build
FROM node:18

# Instalar dependências necessárias para o Chromium (Puppeteer)
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  libgbm1 \
  xdg-utils \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Criar diretório para uploads e dar permissões
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

WORKDIR /app

# Instala dependências do backend
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm install

# Copia código-fonte do backend
COPY backend /app/backend

# Copia build do frontend para a pasta 'public' do backend
COPY --from=build-frontend /app/frontend/build /app/backend/public

# Define variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=10000

# Expõe a porta usada pelo backend
EXPOSE 10000

# Inicia o backend (Express serve também o frontend)
CMD ["node", "backend/src/app.js"
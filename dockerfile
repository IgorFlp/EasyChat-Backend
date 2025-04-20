# Imagem base
FROM node:18

# Diretório de trabalho
WORKDIR /app

# Copia os arquivos
COPY package*.json ./
RUN npm install
COPY . .

# Porta exposta
EXPOSE 3000

# Comando para rodar
CMD ["node", "api/server.js"]
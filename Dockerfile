FROM node:20-alpine

WORKDIR /app

# Зависимости фронта
COPY package.json package-lock.json* ./
RUN npm install

# Зависимости мок-сервера
COPY mock-server/package.json mock-server/package-lock.json* ./mock-server/
RUN cd mock-server && npm install

# Исходники
COPY . .

EXPOSE 5173 3001

# Запуск фронта и мок-сервера одновременно
CMD node mock-server/server.js & npx vite --host 0.0.0.0 && wait

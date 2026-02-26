FROM node:20-alpine

WORKDIR /app

# Зависимости фронта
COPY package.json package-lock.json* ./
RUN npm install

# Исходники
COPY . .

EXPOSE 5173

# Запуск dev-сервера
CMD ["npx", "vite", "--host", "0.0.0.0"]

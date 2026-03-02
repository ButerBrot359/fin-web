FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
RUN npm install vite

EXPOSE 4173

CMD ["npx", "vite", "preview", "--host", "0.0.0.0"]

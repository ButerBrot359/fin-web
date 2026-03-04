FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS mock-build

WORKDIR /mock-server

COPY mock-server/package.json mock-server/package-lock.json* ./
RUN npm ci

COPY mock-server/ .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
RUN npm install vite

COPY --from=mock-build /mock-server/dist ./mock-server/dist
COPY --from=mock-build /mock-server/configs ./mock-server/configs
COPY --from=mock-build /mock-server/package.json ./mock-server/
RUN cd mock-server && npm install --omit=dev

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 4173 3001

CMD ["./start.sh"]

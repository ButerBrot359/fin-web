FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_FORM_CONFIGS_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_FORM_CONFIGS_URL=$VITE_FORM_CONFIGS_URL

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS configs-build

WORKDIR /form-configs-server

ARG ANTHROPIC_API_KEY
ARG DOCUMENT_TYPES_API_BASE_URL
ENV PORT=3001
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV DOCUMENT_TYPES_API_BASE_URL=$DOCUMENT_TYPES_API_BASE_URL

COPY form-configs-server/package.json form-configs-server/package-lock.json* ./
RUN npm ci

COPY form-configs-server/ .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

ARG ANTHROPIC_API_KEY
ARG DOCUMENT_TYPES_API_BASE_URL
ENV PORT=3001
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV DOCUMENT_TYPES_API_BASE_URL=$DOCUMENT_TYPES_API_BASE_URL

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/vite.preview.config.ts ./
RUN npm install vite

COPY --from=configs-build /form-configs-server/dist ./form-configs-server/dist
COPY --from=configs-build /form-configs-server/configs ./form-configs-server/configs
COPY --from=configs-build /form-configs-server/package.json ./form-configs-server/
RUN cd form-configs-server && npm install --omit=dev

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 4173 3001

CMD ["./start.sh"]

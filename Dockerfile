FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_FORM_CONFIGS_URL
# Требовать вход (SCRUM-373). Значение ЗАПЕКАЕТСЯ В БАНДЛ: Vite подставляет
# import.meta.env.* на этапе `npm run build`, поэтому на работающем поде флаг не
# выставить — переключение требует пересборки образа, а не рестарта.
# Пусто или что угодно кроме 'true' — выключено (см. features/auth/lib/consts/auth-config.ts).
ARG VITE_AUTH_ENABLED
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_FORM_CONFIGS_URL=$VITE_FORM_CONFIGS_URL
ENV VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED

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
# vite нужен рантайму: start.sh поднимает `vite preview` поверх готового dist.
# Версию берём ИЗ package.json, а не `npm install vite` без пина. Беспиновый вариант
# тянет latest-мажор: в vite 8 rollup/esbuild заменены нативными rolldown+lightningcss,
# которые на alpine (musl) не встают — стадия падала с exit 1 без единой правки кода.
# Вторая причина: рантайм не должен расходиться мажором с тем, чем собран dist
# (build-стадия ставит vite по package-lock.json).
# --include=dev: vite лежит в devDependencies, и появись здесь ENV NODE_ENV=production,
# npm молча включил бы omit=dev и не поставил бы ничего (`up to date, audited 1 package`).
RUN npm install --no-save --include=dev "vite@$(node -p "require('./package.json').devDependencies.vite")"

COPY --from=configs-build /form-configs-server/dist ./form-configs-server/dist
COPY --from=configs-build /form-configs-server/configs ./form-configs-server/configs
COPY --from=configs-build /form-configs-server/package.json ./form-configs-server/
RUN cd form-configs-server && npm install --omit=dev

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 4173 3001

CMD ["./start.sh"]

# SPA servida por nginx. O base do Vite (/wpda/) é o caminho público, então o
# conteúdo vai para o mesmo caminho dentro do container.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# Remove o site padrão do nginx (inclui o "Welcome to nginx!" em index.html):
# sem isso, GET / responde 200 com uma página que não é a aplicação.
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Escreve /wpda/runtime-config.js a partir de WPDA_ALLOW_DESKTOP (rotasaude/wpda#2).
COPY docker/40-wpda-runtime-config.sh /docker-entrypoint.d/
COPY --from=build /app/dist /usr/share/nginx/html/wpda

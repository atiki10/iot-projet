# Étape 1 : Build du frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.* ./
COPY . .

RUN npm install
RUN npm run build

# Étape 2 : Serveur nginx pour héberger le build
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
# Copy custom nginx config that proxies /api to the backend and sets CSP
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

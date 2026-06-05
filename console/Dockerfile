FROM node:22-alpine AS base
# Install BASH to make our lives easier for entrypoint.sh...
RUN apk add --no-cache curl bash

WORKDIR /app

FROM base AS builder

COPY ./package-lock.json ./
COPY ./console/package.json ./

ENV CI true
ENV npm_config_ignore_scripts true

RUN npm install

COPY ./console ./
RUN \
  NODE_ENV=production \
  VITE_API_URL=APP_VITE_API_URL \
  npm run build

# Remove source files not needed in the final image
RUN rm -rf src test node_modules/.cache

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./console/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
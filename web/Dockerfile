# Frontend Vite + React, served by Caddy.
#
# Build context: web/
# Build:  ibmcloud cr build -t us.icr.io/tavi-hackathon/frontend:v1 \
#           --build-arg VITE_API_URL=https://tavi-backend.us-south.codeengine.appdomain.cloud ./web

FROM node:20-alpine AS build
WORKDIR /app

# pnpm via corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

# ---------- runtime ----------
FROM caddy:2-alpine
COPY --from=build /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80

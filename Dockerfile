# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# pnpm is bundled with Node 22 via corepack
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/cad-viewer/package.json           packages/cad-viewer/package.json
COPY packages/cad-simple-viewer/package.json    packages/cad-simple-viewer/package.json
COPY packages/cad-viewer-example/package.json   packages/cad-viewer-example/package.json
COPY packages/cad-simple-viewer-example/package.json packages/cad-simple-viewer-example/package.json
COPY packages/three-renderer/package.json       packages/three-renderer/package.json
COPY packages/svg-renderer/package.json         packages/svg-renderer/package.json
COPY packages/examples/package.json             packages/examples/package.json

RUN pnpm install --frozen-lockfile

# Copy all source files and build
COPY . .

# nx.json and tsconfig are needed for the build
RUN pnpm build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Copy the built full-featured viewer example
COPY --from=builder /app/packages/cad-viewer-example/dist /usr/share/nginx/html

# SPA fallback: route all requests to index.html
RUN printf 'server {\n\
  listen 80;\n\
  listen [::]:80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  # Cache static assets\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {\n\
    expires 30d;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

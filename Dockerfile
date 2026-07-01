# AnyConv — production image with all conversion engines bundled.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Conversion toolchain:
#  - ffmpeg                  audio & video
#  - libreoffice-*           documents, spreadsheets, presentations, PDF
#  - ghostscript             PDF rasterisation
#  - pandoc                  markup / e-books
#  - fonts-*                 legible output from LibreOffice/Ghostscript
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      ghostscript \
      pandoc \
      libreoffice-writer \
      libreoffice-calc \
      libreoffice-impress \
      fonts-liberation \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

ENV PORT=3000
ENV WORK_DIR=/tmp/anyconv
EXPOSE 3000

# Run as the non-root user that ships with the node image.
RUN mkdir -p /tmp/anyconv && chown -R node:node /tmp/anyconv
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+ (process.env.PORT||3000) +'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]

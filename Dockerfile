# Frontend build stage
FROM node:22-alpine AS web-builder

WORKDIR /app

# Build-time env (Vite embeds this into the bundle)
ARG GEMINI_API_KEY

COPY package.json ./
RUN npm install

COPY . .

# Ensure Vite can read GEMINI_API_KEY during `vite build`
# (.env.local is excluded by .dockerignore, so we generate .env.production here)
RUN if [ -n "$GEMINI_API_KEY" ]; then echo "GEMINI_API_KEY=$GEMINI_API_KEY" > .env.production; fi
RUN npm run build

# Runtime stage: single process (backend serves frontend)
FROM node:22-alpine

WORKDIR /app

# Install server deps
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# Copy server code
COPY server ./server

# Copy built frontend into server public dir
COPY --from=web-builder /app/dist ./server/public

ENV PORT=3001
ENV DATA_DIR=/data
EXPOSE 3001

CMD ["node", "server/index.js"]

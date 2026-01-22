# Frontend build stage
FROM node:22-alpine AS web-builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

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

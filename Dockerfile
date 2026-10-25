FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
ENV PORT=8080
CMD ["npx", "tsx", "src/server.ts"]


# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npm run build
RUN npx prisma generate

# Stage 2: Production
FROM node:18-alpine AS runner
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# Install system dependencies
RUN apk add --no-cache openssl

# Install prod dependencies
RUN npm install --only=production

# Copy built code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copy generated Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Copy uploads folder if needed for persistency handling (usually volume mapped)
RUN mkdir uploads

EXPOSE 5055
CMD ["node", "dist/index.js"]

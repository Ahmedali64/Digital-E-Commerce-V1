# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Args we added this build time var just cause the client get it cause he can not get it from the file acuse it is a run time var not a build time var
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Args
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads/products/covers /app/uploads/products/pdfs /app/logs && \
    chown -R nestjs:nodejs /app/uploads /app/logs

USER nestjs

EXPOSE 3000

CMD ["node", "dist/src/main"]

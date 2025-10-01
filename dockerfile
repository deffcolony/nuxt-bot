FROM node:22.17.0-alpine AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install build tools and dependencies
RUN apk add --no-cache python3 make g++ \
    && npm install

# Copy source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:22.17.0-alpine

# Set working directory
WORKDIR /app

# Copy only necessary files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Start the bot
CMD ["node", "dist/index.js"]
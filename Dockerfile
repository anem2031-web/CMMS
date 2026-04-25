FROM node:22-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all package files including patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN pnpm build

# Remove dev dependencies after build
RUN pnpm prune --prod

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]

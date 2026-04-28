FROM node:22-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.15.1

# Copy package files including patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install ALL dependencies (dev needed for esbuild server build)
RUN pnpm install --frozen-lockfile

# Copy source and pre-built frontend dist
COPY . .

# Build server from source using esbuild (--bundle inlines all imports including vite.ts)
# Using --bundle ensures vite.ts serveStatic logic is correctly inlined
RUN pnpm exec esbuild server/_core/index.ts --platform=node --bundle --format=esm --outdir=dist

# Remove dev dependencies after build
RUN pnpm prune --prod

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]

FROM node:22-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files including patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install ALL dependencies (dev needed for esbuild server build)
RUN pnpm install --frozen-lockfile

# Copy source and pre-built frontend dist
COPY . .

# Only rebuild the server (esbuild is fast, avoids Vite frontend cache issues)
RUN pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Remove dev dependencies after build
RUN pnpm prune --prod

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]

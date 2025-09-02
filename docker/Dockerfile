# Base Image with node
FROM node:20-alpine

# Working directory
WORKDIR /usr/src/app

# Copy config files and dependencies
COPY package*.json tsconfig.json tsconfig.node.json vite.config.ts ./
COPY nodemon.json ./

# Install dependencies (included dev dependencies)
RUN npm ci

# Copy all the source code
COPY . .

# Expose to port 3883
EXPOSE 3883

# Start: run updater once, then dev server.
# Alpine uses /bin/sh; chaining is via -lc.
CMD ["npm", "run" , "dev"]

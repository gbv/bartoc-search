# syntax=docker/dockerfile:1.6
#
# Multi-stage Docker build:
# - deps: install node_modules once (cached well)
# - build: compile Vite client + SSR bundle into dist/
# - runtime: ship a production container that already contains dist/
#            so the server does NOT rebuild on every container restart.


########################
# 1) deps (install)
########################
FROM node:20-alpine AS deps

# Patch Alpine base packages (security fixes) and install tzdata for correct timezone handling.
RUN apk update && apk upgrade --no-cache && apk add --no-cache tzdata

# All paths are relative to this working directory.
WORKDIR /usr/src/app

# Copy only package manifests first so Docker can cache "npm ci"
# as long as package-lock.json doesn't change.
COPY package*.json ./

# Install dependencies exactly as locked in package-lock.json.
# This is deterministic and faster/safer than "npm install".
RUN npm ci

########################
# 2) build (produce dist/)
########################
FROM node:20-alpine AS build

# tzdata is needed if build or tooling depends on timezone data.
RUN apk add --no-cache tzdata

WORKDIR /usr/src/app

ARG VIRTUAL_PATH=/
ENV VIRTUAL_PATH=${VIRTUAL_PATH}

# Reuse the already installed dependencies from the deps stage.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy the full repository source code (client + server + configs + etc).
COPY . .

# Build the application:
# - "build:client" -> dist/ (static assets + index.html)
# - "build:ssr"    -> dist/server/entry-server.js (SSR bundle)
RUN npm run build

########################
# 3) runtime (no rebuild at start)
########################
FROM node:20-alpine AS runtime

# Patch Alpine base packages and install tzdata in the final image as well.
RUN apk update && apk upgrade --no-cache && apk add --no-cache tzdata

WORKDIR /usr/src/app

# Force production mode by default inside the container.
# (The app reads this and disables Vite dev middleware, etc.)
ENV NODE_ENV=production

# Copy node_modules from deps stage.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy package manifests (useful for debugging and consistency).
COPY package*.json ./

# Copy prebuilt "dist/" from the build stage.
# This is the key: production container already contains built assets.
COPY --from=build /usr/src/app/dist ./dist

# Copy the server source (TypeScript) that will be executed via "tsx".
# This avoids a separate server compilation step.
COPY --from=build /usr/src/app/src/server ./src/server

# Copy runtime data/config shipped with the repo.
# If you mount /data or /config at runtime, those mounts will override these.
COPY --from=build /usr/src/app/data ./data
COPY --from=build /usr/src/app/config ./config

# Expose the HTTP port used by the app.
EXPOSE 3883

# ENTRYPOINT runs at container start, before CMD.
# Here we optionally install a crontab if a cron file is mounted at /config/cron.
ENTRYPOINT ["/bin/sh","-lc","set -e; \
  if [ -f /config/cron ]; then \
    echo 'Installing cron file from /config/cron'; \
    crontab /config/cron; \
    crond; \
  fi; \
  exec \"$@\"","--"]

# Default command: start production mode (no Vite dev server, uses dist/).
# docker-compose can override this for staging (e.g. "npm run start:staging").
CMD ["npm","run","start:prod"]

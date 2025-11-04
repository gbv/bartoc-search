# Base Image with node
FROM node:20-alpine

# Update and upgrade OS packages, then install tzdata so vulnerabilities from base packages are patched
RUN apk update && apk upgrade --no-cache && apk add --no-cache tzdata

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

# ENTRYPOINT runs once at container start; it can see mounted files like /config/cron
ENTRYPOINT ["/bin/sh","-lc","set -e; \
  # install and start cron if a crontab is mounted at /config/cron
  if [ -f /config/cron ]; then \
    echo 'Installing cron file from /config/cron'; \
    crontab /config/cron; \
    crond start; \
  fi; \
  exec \"$@\"","--"]

# Start: run updater once, then dev server.
# Alpine uses /bin/sh; chaining is via -lc.
CMD ["npm", "run" , "dev"]

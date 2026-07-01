FROM node:20-alpine
WORKDIR /app

# Only copy package.json (package-lock.json is in .gitignore and not in repo)
COPY package.json ./

# Use npm install (not npm ci) so it works without package-lock.json
RUN npm install --production

# Copy app source
COPY server.js ./
COPY public/ ./public/

# data.json will be auto-created by server.js on first run, no need to COPY it

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
CMD ["node", "server.js"]

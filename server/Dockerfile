FROM node:22-alpine
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY migrations ./migrations
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]

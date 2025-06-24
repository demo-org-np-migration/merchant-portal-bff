FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN addgroup -S merchant-portal-bff && adduser -S merchant-portal-bff -G merchant-portal-bff
USER merchant-portal-bff

EXPOSE 8080
CMD ["node", "dist/server.js"]

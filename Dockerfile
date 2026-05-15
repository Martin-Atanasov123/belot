FROM node:20-alpine AS build
WORKDIR /app

# Copy everything needed for workspace resolution. tsup bundles engine + shared
# into the server output, so the runtime image (stage 2) only needs the bundle.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

COPY packages/shared packages/shared
COPY packages/engine packages/engine
COPY packages/server packages/server

RUN cd packages/server && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/server/dist /app/dist
COPY --from=build /app/packages/server/package.json /app/package.json
RUN npm install --omit=dev --no-audit --no-fund
EXPOSE 3001
CMD ["node", "dist/index.js"]

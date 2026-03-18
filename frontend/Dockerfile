# ---- Base Node ----
FROM node:lts-slim AS build

ARG NETWORK_NAME=testnet

WORKDIR /app

COPY package*.json ./

RUN set -eux \
  && npm install

COPY . .
RUN set -eux \
&& npx wrangler deploy --env ${NETWORK_NAME} --dry-run --outdir /app/dist

FROM node:lts-slim AS runner

COPY --from=build /app/dist /app
COPY --from=build /app/wrangler.jsonc /app/wrangler.jsonc

RUN set -eux \
  && npm install -g wrangler@latest \
  && groupadd -g 1001 burnt \
  && useradd -u 1001 -g 1001 -m burnt \
  && chown -R burnt:burnt /app /home/burnt

WORKDIR /app
USER burnt

CMD [ "wrangler", "dev", "index.js",  "--assets", "/app", "--show-interactive-dev-session", "false", "--ip", "0.0.0.0", "--port", "3000" ]

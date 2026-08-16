FROM alpine:latest

ARG PB_VERSION=0.39.10

RUN apk add --no-cache \
    unzip \
    ca-certificates

# Descargar y descomprimir PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

# Copiar migraciones al contenedor
COPY pb_migrations/ /pb/pb_migrations/

EXPOSE 8080

# Iniciar PocketBase: permite CORS desde el frontend en Vercel
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--origins=https://mantentev2.vercel.app,https://fragrant-sandbar-3808.fly.dev"]

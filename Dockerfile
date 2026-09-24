FROM alpine:latest

ARG PB_VERSION=0.39.10

RUN apk add --no-cache \
    unzip \
    ca-certificates

# Descargar y descomprimir PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

# Copiar migraciones y hooks al contenedor
COPY pb_migrations/ /pb/pb_migrations/
COPY pb_hooks/ /pb/pb_hooks/

WORKDIR /pb

EXPOSE 8080

# Iniciar PocketBase con rutas absolutas para migraciones, hooks y datos
# IMPORTANTE: --hooksDir debe ser explícito en v0.39 — sin él no se cargan hooks
CMD ["/pb/pocketbase", "serve",
     "--http=0.0.0.0:8080",
     "--dir=/pb/pb_data",
     "--hooksDir=/pb/pb_hooks",
     "--migrationsDir=/pb/pb_migrations",
     "--origins=https://mantentev2.vercel.app,https://fragrant-sandbar-3808.fly.dev"]

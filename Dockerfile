FROM alpine:latest

ARG PB_VERSION=0.22.13

RUN apk add --no-cache \
    unzip \
    ca-certificates

# Descargar y descomprimir PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

# Copiar migraciones de esquema (se aplican automáticamente al iniciar PocketBase)
COPY pb_migrations/ /pb/pb_migrations/

EXPOSE 8080

# Iniciar PocketBase en el puerto 8080
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]

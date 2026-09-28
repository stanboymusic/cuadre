// Inyecta automáticamente el companyId al crear registros del módulo Estados
// PocketBase v0.39.10+

const colsCompanyId = [
  "ubicaciones", "stock_ubicacion", "envios", "envio_items",
  "envio_eventos", "movimientos_inventario", "rendiciones"
];

for (const col of colsCompanyId) {
  onRecordCreateRequest((e) => {
    if (e.auth && e.auth.getString("companyId")) {
      e.record.set("companyId", e.auth.getString("companyId"));
    }
    e.next();
  }, col);
}

// Bloquea que un usuario se cambie de empresa a sí mismo por la API
onRecordUpdateRequest((e) => {
  if (e.auth && e.record.collection().name === "users") {
    const original = e.record.originalCopy();
    if (original.getString("companyId") !== "" && 
        e.record.getString("companyId") !== original.getString("companyId") && 
        !e.auth.isSuperuser) {
      throw new BadRequestError("No puedes cambiar de empresa");
    }
  }
  e.next();
}, "users");

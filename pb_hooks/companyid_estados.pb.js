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

// pb_hooks/rendiciones_estado.pb.js
// Validación de backend para que una rendición no exceda el saldo pendiente
// PocketBase v0.39.10+

onRecordCreateRequest((e) => {
  const ubId = e.record.getString("ubicacion");
  if (!ubId) return e.next();
  
  const ub = e.app.findRecordById("ubicaciones", ubId);
  
  const companyId = e.auth ? e.auth.getString("companyId") : "";
  if (!companyId) throw new ForbiddenError("No autorizado");
  
  // Vendido total
  const tot = arrayOf(new DynamicModel({ vendido: 0.0 }));
  e.app.db().newQuery(
    "SELECT COALESCE(SUM(totalUsd), 0) AS vendido FROM sales WHERE ubicacion = {:u} AND companyId = {:c}"
  ).bind({ u: ubId, c: companyId }).all(tot);
  
  // Rendido total
  const rt = arrayOf(new DynamicModel({ rendido: 0.0 }));
  e.app.db().newQuery(
    "SELECT COALESCE(SUM(monto), 0) AS rendido FROM rendiciones WHERE ubicacion = {:u} AND companyId = {:c}"
  ).bind({ u: ubId, c: companyId }).all(rt);
  
  const comisionPct = ub.getFloat("comision_pct") || 0;
  const vendido = tot.length ? tot[0].vendido : 0;
  const rendido = rt.length ? rt[0].rendido : 0;
  const neto = vendido * (1 - comisionPct / 100);
  const saldo = neto - rendido;
  
  const monto = e.record.getFloat("monto");
  
  // Margen de 0.01 por errores de coma flotante
  if (monto > saldo + 0.01) {
    throw new BadRequestError("El monto a rendir (" + monto.toFixed(2) + ") excede el saldo pendiente (" + saldo.toFixed(2) + ")");
  }
  
  return e.next();
}, "rendiciones");

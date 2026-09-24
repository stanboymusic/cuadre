// cuenta_estado.pb.js — Estado de cuenta de un punto de venta en estado.
// GET /api/cuadre/estados/{id}/cuenta
// Devuelve: vendido total, comisión, neto, rendido, saldo por rendir y últimos movimientos.
//
// Campos reales: sales.totalUsd, sales.ubicacion, rendiciones.monto.
// ANULADA_SQL: dejar vacío si las ventas no tienen campo de anulación aún.
// Si en el futuro se agrega un campo "status" o similar, ajustar aquí.
const ANULADA_SQL = ""

routerAdd("GET", "/api/cuadre/estados/{id}/cuenta", (e) => {
  const id  = e.request.pathValue("id")
  const ub  = $app.findRecordById("ubicaciones", id)

  // Vendido total (sin filtro de período — para el saldo acumulado)
  const tot = arrayOf(new DynamicModel({ vendido: 0.0, n: 0 }))
  $app.db().newQuery(
    `SELECT COALESCE(SUM(totalUsd), 0) AS vendido, COUNT(*) AS n FROM sales WHERE ubicacion = {:u}${ANULADA_SQL}`
  ).bind({ u: id }).all(tot)

  // Total rendido
  const rt = arrayOf(new DynamicModel({ rendido: 0.0 }))
  $app.db().newQuery(
    "SELECT COALESCE(SUM(monto), 0) AS rendido FROM rendiciones WHERE ubicacion = {:u}"
  ).bind({ u: id }).all(rt)

  const comisionPct = ub.getFloat("comision_pct") || 0
  const vendido     = tot.length ? tot[0].vendido : 0
  const rendido     = rt.length  ? rt[0].rendido  : 0
  const neto        = vendido * (1 - comisionPct / 100)

  // Últimos movimientos (ventas + rendiciones, mezclados y ordenados por fecha desc)
  const movimientos = []
  for (const v of $app.findRecordsByFilter("sales", "ubicacion = {:u}", "-created", 50, 0, { u: id })) {
    movimientos.push({
      tipo:  "venta",
      fecha: v.getString("created"),
      monto: v.getFloat("totalUsd"),
      ref:   v.id,
    })
  }
  for (const r of $app.findRecordsByFilter("rendiciones", "ubicacion = {:u}", "-created", 50, 0, { u: id })) {
    movimientos.push({
      tipo:   "rendicion",
      fecha:  r.getString("created"),
      monto:  -r.getFloat("monto"),  // negativo = salida de la cuenta del estado
      ref:    r.id,
      metodo: r.getString("metodo"),
    })
  }
  movimientos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  return e.json(200, {
    ubicacion: {
      id,
      nombre:       ub.getString("nombre"),
      responsable:  ub.getString("responsable"),
      comision_pct: comisionPct,
    },
    vendido,
    comision_monto: vendido - neto,
    neto,
    rendido,
    saldo:         neto - rendido,
    ventas_count:  tot.length ? tot[0].n : 0,
    movimientos:   movimientos.slice(0, 60),
  })
}, $apis.requireAuth())

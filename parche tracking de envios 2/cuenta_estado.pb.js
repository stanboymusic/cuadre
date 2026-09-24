// Estado de cuenta de un estado: vendido, comisión, rendido, saldo por rendir y últimos movimientos.
// Campos reales: sales.totalUsd, sales.ubicacion. ADAPTAR ANULADA_SQL si las ventas se anulan con algún campo.
// Ej.: " AND (status IS NULL OR status != 'anulada')". Dejar vacío si no aplica.
const ANULADA_SQL = ""

routerAdd("GET", "/api/cuadre/estados/{id}/cuenta", (e) => {
  const inv = require(`${__hooks}/inventario_utils.js`)
  const id = e.request.pathValue("id")
  const ub = $app.findRecordById("ubicaciones", id)
  inv.exigirEmpresa(e, ub)

  const tot = arrayOf(new DynamicModel({ vendido: 0, n: 0 }))
  $app.db().newQuery(
    `SELECT COALESCE(SUM(totalUsd),0) AS vendido, COUNT(*) AS n FROM sales WHERE ubicacion = {:u} ${ANULADA_SQL}`
  ).bind({ u: id }).all(tot)

  const rt = arrayOf(new DynamicModel({ rendido: 0 }))
  $app.db().newQuery("SELECT COALESCE(SUM(monto),0) AS rendido FROM rendiciones WHERE ubicacion = {:u}").bind({ u: id }).all(rt)

  const comision = ub.getFloat("comision_pct")
  const vendido = tot[0].vendido, rendido = rt[0].rendido
  const neto = vendido * (1 - comision / 100)

  const mov = []
  for (const v of $app.findRecordsByFilter("sales", "ubicacion = {:u}", "-created", 50, 0, { u: id }))
    mov.push({ tipo: "venta", fecha: v.getString("created"), monto: v.getFloat("totalUsd"), ref: v.id })
  for (const r of $app.findRecordsByFilter("rendiciones", "ubicacion = {:u}", "-created", 50, 0, { u: id }))
    mov.push({ tipo: "rendicion", fecha: r.getString("created"), monto: -r.getFloat("monto"), ref: r.id, metodo: r.getString("metodo") })
  mov.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  return e.json(200, {
    ubicacion: { id, nombre: ub.getString("nombre"), responsable: ub.getString("responsable"), comision_pct: comision },
    vendido, comision_monto: vendido - neto, neto, rendido, saldo: neto - rendido, ventas_count: tot[0].n,
    movimientos: mov.slice(0, 60),
  })
}, $apis.requireAuth())

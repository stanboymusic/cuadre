// panel_estados.pb.js — Endpoint de agregados para el Panel de Estados.
// PocketBase v0.23+ (probado en v0.39.10)
//
// Correcciones vs. borrador:
//   - "ventas"        → "sales"
//   - "precio_base"   → "cost"
//   - "total"         → "totalUsd"
//
// GET /api/cuadre/estados/panel?desde=2026-09-01&hasta=2026-09-30
// Respuesta: { periodo, estados: [...] }
//
// NOTA DE RENDIMIENTO:
//   Este endpoint hace un loop de N estados × M productos. Con volumen alto,
//   reemplazar los bucles por consultas SQL agregadas con $app.db().newQuery(...).
//   Escrito así para claridad en las primeras fases.

routerAdd("GET", "/api/cuadre/estados/panel", (e) => {
  const desde = e.request.url.query().get("desde") || "1970-01-01"
  const hasta  = e.request.url.query().get("hasta") || "2999-12-31"

  // Solo estados activos
  const ubicaciones = $app.findRecordsByFilter(
    "ubicaciones", "tipo = 'estado' && activa = true", "nombre", 0, 0
  )

  const out = []

  for (const ub of ubicaciones) {
    // ── Stock ────────────────────────────────────────────────────────────────
    const stockRows = $app.findRecordsByFilter(
      "stock_ubicacion", "ubicacion = {:u}", "", 0, 0, { u: ub.id }
    )
    let unidades = 0, valorStock = 0, stockBajo = 0
    for (const s of stockRows) {
      const prod = $app.findRecordById("products", s.getString("producto"))
      const cant = s.getFloat("cantidad")
      unidades   += cant
      valorStock += cant * prod.getFloat("cost")  // "cost", no "precio_base"
      const min   = s.getFloat("stock_minimo")
      if (min > 0 && cant <= min) stockBajo++
    }

    // ── Ventas del período ────────────────────────────────────────────────────
    // El campo "ubicacion" se agrega a "sales" en la migración de este parche.
    // Ventas históricas sin ubicacion no aparecen aquí (quedan en Central).
    const ventasPeriodo = $app.findRecordsByFilter(
      "sales",
      "ubicacion = {:u} && created >= {:d} && created <= {:h}",
      "", 0, 0,
      { u: ub.id, d: desde, h: hasta + " 23:59:59" }
    )
    let vendidoPeriodo = 0
    for (const v of ventasPeriodo) {
      vendidoPeriodo += v.getFloat("totalUsd")  // "totalUsd", no "total"
    }

    // ── Saldo por rendir (todas las ventas, no solo el período) ──────────────
    const todasVentas = $app.findRecordsByFilter(
      "sales", "ubicacion = {:u}", "", 0, 0, { u: ub.id }
    )
    let vendidoTotal = 0
    for (const v of todasVentas) vendidoTotal += v.getFloat("totalUsd")

    const comision    = ub.getFloat("comision_pct") || 0
    const netoTotal   = vendidoTotal * (1 - comision / 100)

    const rendiciones = $app.findRecordsByFilter(
      "rendiciones", "ubicacion = {:u}", "", 0, 0, { u: ub.id }
    )
    let rendido = 0
    for (const r of rendiciones) rendido += r.getFloat("monto")

    // ── Envíos en tránsito ────────────────────────────────────────────────────
    const enTransito = $app.findRecordsByFilter(
      "envios", "destino = {:u} && estado = 'en_transito'", "", 0, 0, { u: ub.id }
    )

    // ── Alertas ───────────────────────────────────────────────────────────────
    const hoy         = new Date()
    let   hayRetraso  = false
    for (const env of enTransito) {
      const fe = env.getString("fecha_estimada")
      if (fe && new Date(fe) < hoy) { hayRetraso = true; break }
    }

    const incidencias = $app.findRecordsByFilter(
      "envios", "destino = {:u} && estado = 'recibido_parcial'", "", 0, 0, { u: ub.id }
    )

    out.push({
      id:               ub.id,
      nombre:           ub.getString("nombre"),
      estado_ve:        ub.getString("estado_ve"),
      ciudad:           ub.getString("ciudad"),
      responsable:      ub.getString("responsable"),
      comision_pct:     comision,
      unidades,
      valor_stock:      valorStock,
      stock_bajo:       stockBajo,
      vendido_periodo:  vendidoPeriodo,
      ventas_count:     ventasPeriodo.length,
      envios_en_transito: enTransito.length,
      saldo_por_rendir: netoTotal - rendido,
      alerta_retraso:   hayRetraso,
      alerta_incidencia: incidencias.length > 0,
    })
  }

  // Totales globales
  const totalStock   = out.reduce((a, x) => a + x.valor_stock, 0)
  const totalVendido = out.reduce((a, x) => a + x.vendido_periodo, 0)
  const totalSaldo   = out.reduce((a, x) => a + x.saldo_por_rendir, 0)

  return e.json(200, {
    periodo: { desde, hasta },
    totales: { valor_stock: totalStock, vendido_periodo: totalVendido, saldo_por_rendir: totalSaldo },
    estados: out,
  })
}, $apis.requireAuth())

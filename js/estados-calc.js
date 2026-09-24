// js/estados-calc.js — Cálculos puros del módulo Estados (sin DOM).
// Campos reales: products.stock / cost / name.

(function () {
  const hoyISO = () => {
    const d = new Date()
    // Restamos el offset para obtener la fecha local en formato YYYY-MM-DD HH:MM:SS
    const tzOffset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzOffset).toISOString().replace("T", " ").substring(0, 19)
  }

  // Valor a costo del stock que está en estados
  const valorEnEstados = (stockUb, products) => {
    const cost = {}
    products.forEach((p) => (cost[p.id] = p.cost || 0))
    return stockUb.reduce((a, s) => a + (s.cantidad || 0) * (cost[s.producto] || 0), 0)
  }

  // Valor a costo de lo que va en camino (envios en_transito). items = envio_items de esos envíos.
  const valorEnTransito = (envios, items) => {
    const ids = new Set(envios.filter((e) => e.estado === "en_transito").map((e) => e.id))
    return items.filter((i) => ids.has(i.envio)).reduce((a, i) => a + (i.cantidad_enviada || 0) * (i.costo_unitario || 0), 0)
  }

  // Inventario TOTAL a costo = Central + estados + en tránsito.
  // Usado por patrimonio.js
  const inventarioTotal = ({ products, stockUb, envios, envioItems }) =>
    products.reduce((a, p) => a + (p.stock || 0) * (p.cost || 0), 0) +
    valorEnEstados(stockUb, products) +
    valorEnTransito(envios, envioItems)

  const totalProducto = (p, stockUb, envios, envioItems) => {
    const enEstados = stockUb.filter((s) => s.producto === p.id).reduce((a, s) => a + (s.cantidad || 0), 0)
    const ids = new Set(envios.filter((e) => e.estado === "en_transito").map((e) => e.id))
    const enCamino = envioItems.filter((i) => ids.has(i.envio) && i.producto === p.id).reduce((a, i) => a + (i.cantidad_enviada || 0), 0)
    return { central: p.stock || 0, estados: enEstados, en_transito: enCamino, total: (p.stock || 0) + enEstados + enCamino }
  }

  const envioRetrasado = (envio) => envio.estado === "en_transito" && !!envio.fecha_estimada && envio.fecha_estimada < hoyISO()

  const saldoPorRendir = (vendido, comisionPct, rendido) => vendido * (1 - (comisionPct || 0) / 100) - rendido

  // Etiquetas y colores para los chips de estado del envío
  const ESTADO_ENVIO = {
    preparando:       { label: "Preparando",       color: "#8a8f98" },
    en_transito:      { label: "En tránsito",      color: "#d9a520" },
    recibido:         { label: "Recibido",         color: "#2e9e5b" },
    recibido_parcial: { label: "Recibido parcial", color: "#e07a2f" },
    cancelado:        { label: "Cancelado",        color: "#c0392b" },
  }

  window.EstadosCalc = { valorEnEstados, valorEnTransito, inventarioTotal, totalProducto, envioRetrasado, saldoPorRendir, ESTADO_ENVIO }
})()

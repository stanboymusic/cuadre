// js/estados-api.js — Capa de acceso del módulo Estados.
// Cargar ANTES de estados.js y estados-envios.js.
// "pb" = instancia global del SDK (pocketbase.umd.js v0.22), disponible desde store.js.
//
// Punto 2 (anti stock pisado): después de cada acción de servidor que cambie stock,
// llamar reloadKey('products') antes de permitir cualquier save('products').
// EstadosAPI.postAccion() hace esto automáticamente para las rutas de envíos.

(function () {
  const post = (path, body) => pb.send(path, { method: "POST", body: body != null ? body : {} })
  const get  = (path)       => pb.send(path, { method: "GET" })

  /** Mensaje de error legible para mostrar en un toast. */
  function msgError(err) {
    return (err && err.response && err.response.message) ||
           (err && err.data    && err.data.message)     ||
           (err && err.message)                         ||
           "Ocurrió un error inesperado"
  }

  /**
   * Ejecuta una llamada POST a una ruta de servidor y después recarga los datos
   * críticos para evitar el "stock pisado" (Punto 2).
   * Recarga: products (stock Central), y las colecciones propias del módulo
   * de estados via _estadosPtData (se invalida para forzar recarga en patrimonio).
   */
  async function postAccion(path, body) {
    const result = await post(path, body)
    // Invalidar la caché de patrimonio (Punto 3) para que el próximo render
    // recalcule con el stock real de Central + estados + en tránsito
    window._estadosPtData = null
    // Recargar products en DB.* (Punto 2: evitar stock pisado)
    if (typeof reloadKey === 'function') await reloadKey('products')
    return result
  }

  window.EstadosAPI = {
    msgError,

    // ── Envíos ─────────────────────────────────────────────────────────────────
    crearEnvio: (data) => pb.collection("envios").create(data),

    agregarItem: (envioId, productoId, cantidad) =>
      pb.collection("envio_items").create({
        envio:            envioId,
        producto:         productoId,
        cantidad_enviada: cantidad,
      }),

    quitarItem: (id) => pb.collection("envio_items").delete(id),

    // Estas tres acciones modifican products.stock → usan postAccion() para recargar
    despachar: (id)               => postAccion(`/api/cuadre/envios/${id}/despachar`),
    recibir:   (id, items, nota)  => postAccion(`/api/cuadre/envios/${id}/recibir`, { items, nota: nota || "" }),
    cancelar:  (id)               => postAccion(`/api/cuadre/envios/${id}/cancelar`),

    // Nota libre (no modifica stock, no recarga)
    nota: (id, nota) =>
      pb.collection("envio_eventos").create({ envio: id, estado: "nota", nota }),

    resolverIncidencia: (id, nota) =>
      post(`/api/cuadre/envios/${id}/resolver-incidencia`, { nota }),

    // ── Listados ───────────────────────────────────────────────────────────────
    listarEnvios: (filtro) =>
      pb.collection("envios").getFullList({
        sort:   "-created",
        filter: filtro || "",
        expand: "destino",
      }),

    detalleEnvio: async (id) => {
      const [envio, items, eventos] = await Promise.all([
        pb.collection("envios").getOne(id, { expand: "destino" }),
        pb.collection("envio_items").getFullList({
          filter: `envio="${id}"`,
          expand: "producto",
        }),
        pb.collection("envio_eventos").getFullList({
          filter: `envio="${id}"`,
          sort:   "created",
        }),
      ])
      return { envio, items, eventos }
    },

    // ── Inventario ─────────────────────────────────────────────────────────────
    // Las acciones de inventario también modifican stock → recargar
    ajustar:  async (b) => { const r = await postAccion("/api/cuadre/inventario/ajuste",     b); return r },
    devolver: async (b) => { const r = await postAccion("/api/cuadre/inventario/devolucion", b); return r },
    apertura: async (b) => { const r = await postAccion("/api/cuadre/inventario/apertura",   b); return r },

    // ── Panel / Cuenta ─────────────────────────────────────────────────────────
    panel:   (desde, hasta) => get(`/api/cuadre/estados/panel?desde=${desde || ""}&hasta=${hasta || ""}`),
    cuenta:  (ubicacionId)  => get(`/api/cuadre/estados/${ubicacionId}/cuenta`),
    rendir:  (data)         => pb.collection("rendiciones").create(data),
  }
})()

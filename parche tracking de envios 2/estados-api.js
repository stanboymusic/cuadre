// Capa de acceso del módulo Estados (frontend vanilla). Cargar con <script src="./js/estados-api.js?v=..."> ANTES de estados.js.
// ADAPTAR: "pb" = la instancia real del SDK (pocketbase.umd.js v0.22) y cómo se recarga DB.*.
(function () {
  const post = (path, body) => pb.send(path, { method: "POST", body: body || {} })
  const get = (path) => pb.send(path, { method: "GET" })

  // Mensaje legible para mostrar en un toast
  function msgError(err) {
    return (err && err.response && err.response.message) || (err && err.message) || "Ocurrió un error"
  }

  window.EstadosAPI = {
    msgError,

    // --- envíos ---
    crearEnvio: (data) => pb.collection("envios").create(data),
    agregarItem: (envio, producto, cantidad) =>
      pb.collection("envio_items").create({ envio, producto, cantidad_enviada: cantidad }),
    quitarItem: (id) => pb.collection("envio_items").delete(id),
    despachar: (id) => post(`/api/cuadre/envios/${id}/despachar`),
    recibir: (id, items, nota) => post(`/api/cuadre/envios/${id}/recibir`, { items, nota: nota || "" }),
    cancelar: (id) => post(`/api/cuadre/envios/${id}/cancelar`),
    nota: (id, nota) => pb.collection("envio_eventos").create({ envio: id, estado: "nota", nota }),
    resolverIncidencia: (id, nota) => post(`/api/cuadre/envios/${id}/resolver-incidencia`, { nota }),

    listarEnvios: (filtro) =>
      pb.collection("envios").getFullList({ sort: "-created", filter: filtro || "", expand: "destino" }),
    detalleEnvio: async (id) => {
      const [envio, items, eventos] = await Promise.all([
        pb.collection("envios").getOne(id, { expand: "destino" }),
        pb.collection("envio_items").getFullList({ filter: `envio="${id}"`, expand: "producto" }),
        pb.collection("envio_eventos").getFullList({ filter: `envio="${id}"`, sort: "created" }),
      ])
      return { envio, items, eventos }
    },

    // --- inventario ---
    ajustar: (b) => post("/api/cuadre/inventario/ajuste", b),        // { ubicacion, producto, tipo, cantidad, nota }
    devolver: (b) => post("/api/cuadre/inventario/devolucion", b),   // { ubicacion, items, nota }
    apertura: (b) => post("/api/cuadre/inventario/apertura", b),     // { items, nota }

    // --- panel / cuenta ---
    panel: (desde, hasta) => get(`/api/cuadre/estados/panel?desde=${desde || ""}&hasta=${hasta || ""}`),
    cuenta: (ubicacionId) => get(`/api/cuadre/estados/${ubicacionId}/cuenta`),
    rendir: (data) => pb.collection("rendiciones").create(data),
  }
})()

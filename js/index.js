import "./store.js";
import "./app.js";
import "./dashboard.js";
import "./ventas.js";
import "./productos.js";
import "./servicios.js";
import "./proveedores.js";
import "./compras.js";
import "./ajustes.js";
import "./clientes.js";
import "./egresos.js";
import "./cierre.js";
import "./reportes.js";
import "./historial.js";
import "./config.js";
import "./patrimonio.js";

// Boot the app after all modules are loaded
(async function init() {
  await loadDB();
  render();
})();

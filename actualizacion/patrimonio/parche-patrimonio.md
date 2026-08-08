# Parche: control de patrimonio neto/bruto

Instrucciones: busca cada bloque "BUSCAR" en tu `index.html` y reemplázalo
por el bloque "REEMPLAZAR POR". El último bloque es una función nueva que
se agrega, no reemplaza nada.

---

## 1. Migración de PocketBase (ejecutar primero)

Copia `pb_migrations/1785806302_added_initial_investment.js` (incluido
junto a este parche) a `pb_migrations` en tus DOS instancias (local y
fly.io) y reinicia PocketBase. Agrega el campo `initialInvestment` a la
colección `config`.

---

## 2. NAV — agregar la pestaña "Patrimonio"

BUSCAR:
```js
  {group:'Análisis', items:[
    {id:'reportes', label:'Reportes', ic:'▦'},
    {id:'historial', label:'Historial', ic:'☰'},
  ]},
```

REEMPLAZAR POR:
```js
  {group:'Análisis', items:[
    {id:'reportes', label:'Reportes', ic:'▦'},
    {id:'historial', label:'Historial', ic:'☰'},
    {id:'patrimonio', label:'Patrimonio', ic:'♦'},
  ]},
```

---

## 3. `render()` — registrar la nueva vista

BUSCAR:
```js
    egresos: renderEgresos, reportes: renderReportes, historial: renderHistorial, config: renderConfig
```

REEMPLAZAR POR:
```js
    egresos: renderEgresos, reportes: renderReportes, historial: renderHistorial, config: renderConfig,
    patrimonio: renderPatrimonio
```

---

## 4. `defaultConfig()` — campo de inversión inicial

BUSCAR:
```js
function defaultConfig(){
  return {
    businessName:'Mi Negocio', rif:'', address:'', phone:'',
    exchangeRate: 40, iva: 16,
    paymentMethods: ['Efectivo Bs.','Pago Móvil','Punto de Venta','Biopago','Zelle ($)','Binance ($)','PayPal ($)','Efectivo ($)','Crédito'],
    expenseTypes: ['Sueldos','Alquiler','Agua','Electricidad','Gas','Publicidad','Delivery','Otros egresos'],
    vendors: ['Vendedor 1']
  };
}
```

REEMPLAZAR POR:
```js
function defaultConfig(){
  return {
    businessName:'Mi Negocio', rif:'', address:'', phone:'',
    exchangeRate: 40, iva: 16, initialInvestment: 0,
    paymentMethods: ['Efectivo Bs.','Pago Móvil','Punto de Venta','Biopago','Zelle ($)','Binance ($)','PayPal ($)','Efectivo ($)','Crédito'],
    expenseTypes: ['Sueldos','Alquiler','Agua','Electricidad','Gas','Publicidad','Delivery','Otros egresos'],
    vendors: ['Vendedor 1']
  };
}
```

---

## 5. Función nueva: `renderPatrimonio` + `saveInvestment`

Agrégala después de `renderConfig` / antes del bloque `INIT` al final del
archivo (o en cualquier parte junto a las demás funciones `render...`).

```js
/* ============================================================
   PATRIMONIO NETO / BRUTO
   ============================================================ */
function renderPatrimonio(el){
  const inv = DB.config.initialInvestment || 0;

  const inventoryValue = DB.products.reduce((a,p)=>a + (p.cost||0)*(p.stock||0), 0);
  const receivables = DB.clients.reduce((a,c)=>a + Math.max(clientBalance(c.id),0), 0);

  // Solo cuenta como caja el dinero que realmente entró (se excluye
  // cualquier fila de pago marcada como "Crédito" por error).
  const salesCashIn = DB.sales.reduce((a,s)=>
    a + (s.payments||[]).filter(p=>p.method!=='Crédito').reduce((x,p)=>x+(p.amountUsd||0),0), 0);
  const abonosCashIn = DB.receivablePayments.reduce((a,p)=>a+(p.amount||0), 0);
  const purchasesCashOut = DB.purchases.reduce((a,p)=>a+(p.totalUsd||0), 0);
  const expensesCashOut = DB.expenses.reduce((a,e)=>a+(e.amountUsd||0), 0);

  const cash = inv + salesCashIn + abonosCashIn - purchasesCashOut - expensesCashOut;
  const patrimonioBruto = cash + inventoryValue + receivables;
  const patrimonioNeto = patrimonioBruto - inv;

  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">Inversión inicial</h3>
        <div class="field"><label>Capital aportado (USD)</label><input id="pt_inv" type="number" step="0.01" value="${inv}"></div>
        <button class="btn btn-primary" onclick="guardedRun(this, saveInvestment)">Guardar</button>
        <div class="hint" style="margin-top:8px;">Lo que aportaste tú (o los socios) para arrancar el negocio. Es la referencia para medir cuánto valor ha generado la operación desde entonces.</div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-top:0;font-size:15px;">¿Cómo se calcula?</h3>
        <div class="hint">
          <b>Patrimonio bruto</b> = caja acumulada + inventario a costo + cuentas por cobrar.<br><br>
          <b>Patrimonio neto</b> = patrimonio bruto − inversión inicial. Es lo que el negocio ha generado por sí mismo, además de lo que pusiste tú.
        </div>
      </div>
    </div>

    <div class="grid grid-4" style="margin-top:16px;">
      <div class="stat"><div class="lbl">Caja acumulada</div><div class="val amt">${money(cash,'USD')}</div><div class="sub">Inversión + cobros − compras − egresos</div></div>
      <div class="stat"><div class="lbl">Inventario (a costo)</div><div class="val amt">${money(inventoryValue,'USD')}</div><div class="sub">${DB.products.length} producto(s)</div></div>
      <div class="stat"><div class="lbl">Cuentas por cobrar</div><div class="val amt">${money(receivables,'USD')}</div><div class="sub">${DB.clients.filter(c=>clientBalance(c.id)>0).length} cliente(s) con saldo</div></div>
      <div class="stat ${patrimonioBruto<0?'neg':'pos'}"><div class="lbl">Patrimonio bruto</div><div class="val amt">${money(patrimonioBruto,'USD')}</div><div class="sub">Activos totales del negocio</div></div>
    </div>

    <div class="section-title"><h2>Patrimonio neto</h2></div>
    <div class="card card-pad">
      <div class="stat ${patrimonioNeto<0?'neg':'pos'}" style="border:none;padding:0;">
        <div class="lbl">Valor generado por la operación</div>
        <div class="val amt" style="font-size:28px;">${money(patrimonioNeto,'USD')}</div>
        <div class="sub">Patrimonio bruto (${money(patrimonioBruto,'USD')}) − inversión inicial (${money(inv,'USD')})</div>
      </div>
    </div>
  `;
}
async function saveInvestment(){
  DB.config.initialInvestment = Number(document.getElementById('pt_inv').value)||0;
  await save('config');
  toast('Inversión inicial guardada ✓');
  renderPatrimonio(document.getElementById('content'));
}
```

---

## Qué hace esto y por qué

- **Caja acumulada** no es un número guardado aparte — se calcula sobre
  la marcha con lo que ya registras: lo que aportaste + todo lo cobrado
  en ventas y abonos, menos lo pagado en compras y egresos. Si algún
  día agregas un módulo de banco/caja separado, este cálculo puede
  reemplazarse por el saldo real.
- El inventario se valora **a costo**, no a precio de venta — así no
  cuentas como patrimonio una ganancia que todavía no se ha vendido.
- **Patrimonio neto** es intencionalmente distinto de "utilidad neta"
  del Resumen (que es del día). Este es acumulado desde que arrancaste,
  y te dice si el negocio, en conjunto, vale más de lo que invertiste.
- Un patrimonio neto negativo no es necesariamente alarmante al
  principio — solo significa que el negocio todavía no ha generado más
  valor del que le metiste. Es normal en los primeros meses.

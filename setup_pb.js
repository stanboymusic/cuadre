// Setup script for PocketBase via direct HTTP (avoids SDK version mismatch)
const BASE = 'https://fragrant-sandbar-3808.fly.dev';

async function req(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  };
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.message || res.statusText), { body: json });
  return json;
}

(async () => {
  // Login as superuser (PocketBase v0.22+)
  let token;
  try {
    const auth = await req('POST', '/api/collections/_superusers/auth-with-password', {
      identity: 'adrcproducciones@gmail.com',
      password: '123456789!!'
    });
    token = auth.token;
    console.log('✓ Authenticated as superuser');
  } catch(e) {
    // Fallback: try old /api/admins endpoint (PocketBase < 0.22)
    try {
      const auth = await req('POST', '/api/admins/auth-with-password', {
        identity: 'adrcproducciones@gmail.com',
        password: '123456789!!'
      });
      token = auth.token;
      console.log('✓ Authenticated as admin (legacy)');
    } catch(e2) {
      console.error('Auth failed:', e.message, '|', e2.message);
      process.exit(1);
    }
  }

  const collections = [
    { name: 'config', schema: [
      { name: 'businessName', type: 'text' }, { name: 'rif', type: 'text' },
      { name: 'address', type: 'text' }, { name: 'phone', type: 'text' },
      { name: 'exchangeRate', type: 'number' }, { name: 'iva', type: 'number' },
      { name: 'paymentMethods', type: 'text' }, { name: 'expenseTypes', type: 'text' },
      { name: 'vendors', type: 'text' }
    ]},
    { name: 'products', schema: [
      { name: 'code', type: 'text' }, { name: 'name', type: 'text' },
      { name: 'cost', type: 'number' }, { name: 'priceMethod', type: 'text' },
      { name: 'priceValue', type: 'number' }, { name: 'price', type: 'number' },
      { name: 'stock', type: 'number' }, { name: 'minStock', type: 'number' },
      { name: 'location', type: 'text' }, { name: 'supplierId', type: 'text' }
    ]},
    { name: 'services', schema: [
      { name: 'name', type: 'text' }, { name: 'price', type: 'number' }
    ]},
    { name: 'clients', schema: [
      { name: 'name', type: 'text' }, { name: 'cedula', type: 'text' },
      { name: 'phone', type: 'text' }, { name: 'address', type: 'text' },
      { name: 'openingBalance', type: 'number' }
    ]},
    { name: 'suppliers', schema: [
      { name: 'name', type: 'text' }, { name: 'contact', type: 'text' },
      { name: 'phone', type: 'text' }
    ]},
    { name: 'sales', schema: [
      { name: 'ticketNo', type: 'number' }, { name: 'date', type: 'text' },
      { name: 'ts', type: 'number' }, { name: 'clientId', type: 'text' },
      { name: 'clientName', type: 'text' }, { name: 'vendor', type: 'text' },
      { name: 'items', type: 'text' }, { name: 'subtotalUsd', type: 'number' },
      { name: 'ivaUsd', type: 'number' }, { name: 'totalUsd', type: 'number' },
      { name: 'totalBs', type: 'number' }, { name: 'payments', type: 'text' },
      { name: 'changeUsd', type: 'number' }, { name: 'creditAmount', type: 'number' },
      { name: 'exchangeRate', type: 'number' }
    ]},
    { name: 'purchases', schema: [
      { name: 'purchaseNo', type: 'number' }, { name: 'date', type: 'text' },
      { name: 'ts', type: 'number' }, { name: 'supplierId', type: 'text' },
      { name: 'items', type: 'text' }, { name: 'totalUsd', type: 'number' }
    ]},
    { name: 'expenses', schema: [
      { name: 'type', type: 'text' }, { name: 'amountUsd', type: 'number' },
      { name: 'method', type: 'text' }, { name: 'note', type: 'text' },
      { name: 'date', type: 'text' }, { name: 'ts', type: 'number' }
    ]},
    { name: 'cashClosings', schema: [
      { name: 'date', type: 'text' }, { name: 'ts', type: 'number' },
      { name: 'opening', type: 'text' }, { name: 'real', type: 'text' },
      { name: 'diffUsd', type: 'number' }
    ]},
    { name: 'receivablePayments', schema: [
      { name: 'clientId', type: 'text' }, { name: 'amount', type: 'number' },
      { name: 'method', type: 'text' }, { name: 'date', type: 'text' },
      { name: 'ts', type: 'number' }
    ]},
    { name: 'inventoryAdjustments', schema: [
      { name: 'productId', type: 'text' }, { name: 'qty', type: 'number' },
      { name: 'reason', type: 'text' }, { name: 'date', type: 'text' },
      { name: 'ts', type: 'number' }
    ]}
  ];

  for (const coll of collections) {
    try {
      const body = {
        name: coll.name,
        type: 'base',
        schema: coll.schema,
        listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: ''
      };
      await req('POST', '/api/collections', body, token);
      console.log(`✓ Created collection: ${coll.name}`);
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log(`- Already exists: ${coll.name}`);
      } else {
        console.error(`✗ Failed ${coll.name}: ${err.message}`);
      }
    }
  }

  // Create initial config record
  try {
    const configs = await req('GET', '/api/collections/config/records?perPage=1', null, token);
    if (configs.totalItems === 0) {
      await req('POST', '/api/collections/config/records', {
        businessName: 'Mi Negocio', rif: '', address: '', phone: '',
        exchangeRate: 40, iva: 16,
        paymentMethods: ['Efectivo Bs.','Pago Móvil','Punto de Venta','Biopago','Zelle ($)','Binance ($)','PayPal ($)','Efectivo ($)','Crédito'],
        expenseTypes: ['Sueldos','Alquiler','Agua','Electricidad','Gas','Publicidad','Delivery','Otros egresos'],
        vendors: ['Vendedor 1']
      }, token);
      console.log('✓ Created initial config record');
    }
  } catch(e) {
    console.error('✗ Error creating initial config:', e.message);
  }

  console.log('\n✅ Setup completado!');
})();

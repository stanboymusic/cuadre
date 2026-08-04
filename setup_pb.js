const PocketBase = require('pocketbase/cjs');

(async () => {
  const pb = new PocketBase('http://127.0.0.1:8090');
  
  await pb.admins.authWithPassword('adrcproducciones@gmail.com', '12345678!');
  
  const collections = [
    {
      name: 'config',
      type: 'base',
      fields: [
        { name: 'businessName', type: 'text' },
        { name: 'rif', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'exchangeRate', type: 'number' },
        { name: 'iva', type: 'number' },
        { name: 'paymentMethods', type: 'json' },
        { name: 'expenseTypes', type: 'json' },
        { name: 'vendors', type: 'json' }
      ]
    },
    {
      name: 'products',
      type: 'base',
      fields: [
        { name: 'code', type: 'text' },
        { name: 'name', type: 'text' },
        { name: 'cost', type: 'number' },
        { name: 'priceMethod', type: 'text' },
        { name: 'priceValue', type: 'number' },
        { name: 'price', type: 'number' },
        { name: 'stock', type: 'number' },
        { name: 'minStock', type: 'number' },
        { name: 'location', type: 'text' },
        { name: 'supplierId', type: 'text' }
      ]
    },
    {
      name: 'services',
      type: 'base',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'price', type: 'number' }
      ]
    },
    {
      name: 'clients',
      type: 'base',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'cedula', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'openingBalance', type: 'number' }
      ]
    },
    {
      name: 'suppliers',
      type: 'base',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'contact', type: 'text' },
        { name: 'phone', type: 'text' }
      ]
    },
    {
      name: 'sales',
      type: 'base',
      fields: [
        { name: 'ticketNo', type: 'number' },
        { name: 'date', type: 'text' },
        { name: 'ts', type: 'number' },
        { name: 'clientId', type: 'text' },
        { name: 'clientName', type: 'text' },
        { name: 'vendor', type: 'text' },
        { name: 'items', type: 'json' },
        { name: 'subtotalUsd', type: 'number' },
        { name: 'ivaUsd', type: 'number' },
        { name: 'totalUsd', type: 'number' },
        { name: 'totalBs', type: 'number' },
        { name: 'payments', type: 'json' },
        { name: 'changeUsd', type: 'number' },
        { name: 'creditAmount', type: 'number' },
        { name: 'exchangeRate', type: 'number' }
      ]
    },
    {
      name: 'purchases',
      type: 'base',
      fields: [
        { name: 'purchaseNo', type: 'number' },
        { name: 'date', type: 'text' },
        { name: 'ts', type: 'number' },
        { name: 'supplierId', type: 'text' },
        { name: 'items', type: 'json' },
        { name: 'totalUsd', type: 'number' }
      ]
    },
    {
      name: 'expenses',
      type: 'base',
      fields: [
        { name: 'type', type: 'text' },
        { name: 'amountUsd', type: 'number' },
        { name: 'method', type: 'text' },
        { name: 'note', type: 'text' },
        { name: 'date', type: 'text' },
        { name: 'ts', type: 'number' }
      ]
    },
    {
      name: 'cashClosings',
      type: 'base',
      fields: [
        { name: 'date', type: 'text' },
        { name: 'ts', type: 'number' },
        { name: 'opening', type: 'json' },
        { name: 'real', type: 'json' },
        { name: 'diffUsd', type: 'number' }
      ]
    },
    {
      name: 'receivablePayments',
      type: 'base',
      fields: [
        { name: 'clientId', type: 'text' },
        { name: 'amount', type: 'number' },
        { name: 'method', type: 'text' },
        { name: 'date', type: 'text' },
        { name: 'ts', type: 'number' }
      ]
    },
    {
      name: 'inventoryAdjustments',
      type: 'base',
      fields: [
        { name: 'productId', type: 'text' },
        { name: 'qty', type: 'number' },
        { name: 'reason', type: 'text' },
        { name: 'date', type: 'text' },
        { name: 'ts', type: 'number' }
      ]
    }
  ];

  for (const coll of collections) {
    try {
      await pb.collections.create(coll);
      console.log(`Created collection: ${coll.name}`);
      
      // Update rules to allow public access for simplicity
      const created = await pb.collections.getOne(coll.name);
      await pb.collections.update(created.id, {
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: ""
      });
      console.log(`Updated rules for: ${coll.name}`);
    } catch (err) {
      console.error(`Failed to create ${coll.name}: ${err.message}`);
      if (err.response) console.error(JSON.stringify(err.response, null, 2));
    }
  }

  try {
    const configRecords = await pb.collection('config').getFullList();
    if (configRecords.length === 0) {
      await pb.collection('config').create({
        businessName: 'Mi Negocio',
        rif: '',
        address: '',
        phone: '',
        exchangeRate: 40,
        iva: 16,
        paymentMethods: ['Efectivo Bs.','Pago Móvil','Punto de Venta','Biopago','Zelle ($)','Binance ($)','PayPal ($)','Efectivo ($)','Crédito'],
        expenseTypes: ['Sueldos','Alquiler','Agua','Electricidad','Gas','Publicidad','Delivery','Otros egresos'],
        vendors: ['Vendedor 1']
      });
      console.log('Created initial config record');
    }
  } catch(e) {
    console.error('Error creating initial config', e);
  }

})();

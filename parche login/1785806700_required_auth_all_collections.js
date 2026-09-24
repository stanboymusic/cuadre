/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const ids = [
    "pbc_3818476082", // config
    "pbc_4092854851", // products
    "pbc_1394421508", // cashClosings
    "pbc_2442875294", // clients
    "pbc_1691921218", // expenses
    "pbc_1145533974", // inventoryAdjustments
    "pbc_3461338982", // purchases
    "pbc_2156756805", // receivablePayments
    "pbc_2697449135", // sales
    "pbc_863811952",  // services
    "pbc_3355664324", // suppliers
  ];
  for (const id of ids) {
    const collection = app.findCollectionByNameOrId(id);
    unmarshal({
      "createRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id != \"\"",
      "listRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\""
    }, collection);
    app.save(collection);
  }
}, (app) => {
  const ids = [
    "pbc_3818476082", "pbc_4092854851", "pbc_1394421508", "pbc_2442875294",
    "pbc_1691921218", "pbc_1145533974", "pbc_3461338982", "pbc_2156756805",
    "pbc_2697449135", "pbc_863811952", "pbc_3355664324",
  ];
  for (const id of ids) {
    const collection = app.findCollectionByNameOrId(id);
    unmarshal({
      "createRule": "",
      "deleteRule": "",
      "listRule": "",
      "updateRule": "",
      "viewRule": ""
    }, collection);
    app.save(collection);
  }
})

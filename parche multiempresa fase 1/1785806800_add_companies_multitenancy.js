/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Nueva colección "companies" — solo administrable por ti (superusuario)
  //    desde el panel admin de PocketBase. La app nunca la lista ni la
  //    escribe directamente.
  const companies = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text_companies_pk",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_companies_name",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_9000000001",
    "indexes": [],
    "listRule": null,
    "name": "companies",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });
  app.save(companies);

  // 2. Campo companyId en "users" y en las 11 colecciones de datos.
  //    Sin "required" a nivel de esquema a propósito: la separación real
  //    la va a hacer la regla de acceso en la fase 2, una vez que hayas
  //    asignado companyId a tus datos existentes.
  const ids = [
    "users",
    "pbc_3818476082", "pbc_4092854851", "pbc_1394421508", "pbc_2442875294",
    "pbc_1691921218", "pbc_1145533974", "pbc_3461338982", "pbc_2156756805",
    "pbc_2697449135", "pbc_863811952", "pbc_3355664324",
  ];
  for (const id of ids) {
    const collection = app.findCollectionByNameOrId(id);
    collection.fields.add(new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_companyid",
      "max": 0,
      "min": 0,
      "name": "companyId",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }));
    app.save(collection);
  }
}, (app) => {
  const ids = [
    "users",
    "pbc_3818476082", "pbc_4092854851", "pbc_1394421508", "pbc_2442875294",
    "pbc_1691921218", "pbc_1145533974", "pbc_3461338982", "pbc_2156756805",
    "pbc_2697449135", "pbc_863811952", "pbc_3355664324",
  ];
  for (const id of ids) {
    const collection = app.findCollectionByNameOrId(id);
    collection.fields.removeById("text_companyid");
    app.save(collection);
  }

  const companies = app.findCollectionByNameOrId("pbc_9000000001");
  app.delete(companies);
})

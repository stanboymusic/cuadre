/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3818476082")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_cop",
    "max": null,
    "min": null,
    "name": "cop",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  collection.fields.add(new Field({
    "hidden": false,
    "id": "bool_usefictitiousrate",
    "name": "useFictitiousRate",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_cashdiscountpercent",
    "max": 99,
    "min": 0,
    "name": "cashDiscountPercent",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_divisacashmethods",
    "maxSize": 0,
    "name": "divisaCashMethods",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3818476082")

  collection.fields.removeById("number_cop")
  collection.fields.removeById("bool_usefictitiousrate")
  collection.fields.removeById("number_cashdiscountpercent")
  collection.fields.removeById("json_divisacashmethods")

  return app.save(collection)
})

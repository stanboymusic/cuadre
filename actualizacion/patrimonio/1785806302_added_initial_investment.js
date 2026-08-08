/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3818476082")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_initialinvestment",
    "max": null,
    "min": null,
    "name": "initialInvestment",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3818476082")

  collection.fields.removeById("number_initialinvestment")

  return app.save(collection)
})

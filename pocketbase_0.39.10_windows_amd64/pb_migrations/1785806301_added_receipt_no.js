/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2156756805")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "number_receiptno",
    "max": null,
    "min": null,
    "name": "receiptNo",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2156756805")

  collection.fields.removeById("number_receiptno")

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")

  collection.fields.removeById("text4161067946") // priceMethod
  collection.fields.removeById("number4240569745") // priceValue
  collection.fields.removeById("number3402113753") // price
  collection.fields.removeById("number_pricevalue2")
  collection.fields.removeById("number_price2")
  collection.fields.removeById("number_pricevalue3")
  collection.fields.removeById("number_price3")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")

  collection.fields.add(new Field({ "hidden": false, "id": "text4161067946", "max": 0, "min": 0, "name": "priceMethod", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" }))
  collection.fields.add(new Field({ "hidden": false, "id": "number4240569745", "max": null, "min": null, "name": "priceValue", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" }))
  collection.fields.add(new Field({ "hidden": false, "id": "number3402113753", "max": null, "min": null, "name": "price", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" }))
  collection.fields.add(new Field({ "hidden": false, "id": "number_pricevalue2", "max": null, "min": null, "name": "priceValue2", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" }))
  collection.fields.add(new Field({ "hidden": false, "id": "number_price2", "max": null, "min": null, "name": "price2", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" }))
  collection.fields.add(new Field({ "hidden": false, "id": "number_pricevalue3", "max": null, "min": null, "name": "priceValue3", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" }))
  collection.fields.add(new Field({ "hidden": false, "id": "number_price3", "max": null, "min": null, "name": "price3", "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" }))

  return app.save(collection)
})

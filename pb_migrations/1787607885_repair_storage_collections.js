/// <reference path="../pb_data/types.d.ts" />

// Repairs an instance that is missing part of the storage schema, or has
// drifted from it: storage_app_users, storage_report_box_fill, storage_report_growth, storage_report_tag_usage.
//
// PocketBase records every migration it applies and never re-runs one, so an
// instance that ended up short of the baseline stays short of it. Definitions
// are copied from the baseline by scripts/pb-verify.py --emit-fix.

const REPAIR = [
  {
    "id": "pbc_3601393757",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "storage_app_users",
    "type": "view",
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
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
        "id": "text1579384326",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1466534506",
        "max": 0,
        "min": 0,
        "name": "role",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "indexes": [],
    "system": false,
    "viewQuery": "SELECT id, CAST(name AS TEXT) AS name, CAST((CASE role_rank WHEN 1 THEN 'owner' WHEN 2 THEN 'admin' WHEN 3 THEN 'member' ELSE 'readonly' END) AS TEXT) AS role FROM ( SELECT u.id AS id, u.name AS name, MIN(CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END) AS role_rank FROM users u JOIN app_memberships m ON m.user = u.id JOIN apps a ON a.id IN (SELECT value FROM json_each(m.app)) WHERE m.enabled = TRUE AND a.key = 'storage' GROUP BY u.id, u.name )"
  },
  {
    "id": "pbc_2659375862",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "storage_report_box_fill",
    "type": "view",
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
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
        "id": "_clone_KCpT",
        "max": 0,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_B3iB",
        "max": 0,
        "min": 0,
        "name": "location",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_padc",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "active",
          "archived"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2944294834",
        "max": null,
        "min": null,
        "name": "item_count",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1065894869",
        "max": null,
        "min": null,
        "name": "photo_count",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "indexes": [],
    "system": false,
    "viewQuery": "SELECT b.id AS id, b.title AS title, b.location AS location, b.status AS status, CAST((SELECT COUNT(*) FROM storage_items i WHERE i.box = b.id) AS INTEGER) AS item_count, CAST((SELECT COUNT(*) FROM storage_items i WHERE i.box = b.id AND i.images != '' AND i.images != '[]') AS INTEGER) AS photo_count FROM storage_boxes b"
  },
  {
    "id": "pbc_1966404343",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "storage_report_growth",
    "type": "view",
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
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
        "id": "text2394296326",
        "max": 0,
        "min": 0,
        "name": "month",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number575394000",
        "max": null,
        "min": null,
        "name": "boxes_created",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number3468554169",
        "max": null,
        "min": null,
        "name": "items_created",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "indexes": [],
    "system": false,
    "viewQuery": "SELECT REPLACE(m.month, '-', '') AS id, CAST(m.month AS TEXT) AS month, CAST((SELECT COUNT(*) FROM storage_boxes b WHERE strftime('%Y-%m', b.created) = m.month) AS INTEGER) AS boxes_created, CAST((SELECT COUNT(*) FROM storage_items i WHERE strftime('%Y-%m', i.created) = m.month) AS INTEGER) AS items_created FROM ( SELECT DISTINCT CAST(strftime('%Y-%m', created) AS TEXT) AS month FROM storage_boxes UNION SELECT DISTINCT CAST(strftime('%Y-%m', created) AS TEXT) AS month FROM storage_items ) m ORDER BY m.month"
  },
  {
    "id": "pbc_328497782",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "storage_report_tag_usage",
    "type": "view",
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
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
        "id": "_clone_jE05",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_lVjZ",
        "max": 0,
        "min": 0,
        "name": "color",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number4243822730",
        "max": null,
        "min": null,
        "name": "box_count",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2944294834",
        "max": null,
        "min": null,
        "name": "item_count",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "indexes": [],
    "system": false,
    "viewQuery": "SELECT t.id AS id, t.name AS name, t.color AS color, CAST((SELECT COUNT(*) FROM storage_boxes b WHERE EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = t.id)) AS INTEGER) AS box_count, CAST((SELECT COUNT(*) FROM storage_items i WHERE EXISTS (SELECT 1 FROM json_each(i.tags) WHERE value = t.id)) AS INTEGER) AS item_count FROM storage_tags t"
  }
]

migrate((app) => {
  app.importCollections(REPAIR, false)
}, (app) => {
  // Deliberately empty: the baseline migration owns dropping these, and
  // deleting them here on rollback would take their records with them.
})

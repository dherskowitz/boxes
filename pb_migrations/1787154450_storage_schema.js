/// <reference path="../pb_data/types.d.ts" />

// Storage Boxes app schema.
//
// Imported in extend mode (deleteMissing = false), so collections belonging to
// other apps on a shared PocketBase instance are never touched.
//
// `apps` and `app_memberships` are shared multi-app collections: they are only
// created when absent, never overwritten on an instance that already has them.

const SHARED = [
  {
    "id": "pbc_923867626",
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "apps",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "hidden": false,
        "id": "text2324736937",
        "max": 0,
        "min": 0,
        "name": "key",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3252000302",
        "max": 0,
        "min": 0,
        "name": "subdomain",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "bool1260321794",
        "name": "active",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "editor1843675174",
        "maxSize": 0,
        "name": "description",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_PKqLpArPgL` ON `apps` (`key`)"
    ],
    "created": "2025-12-30 04:09:09.537Z",
    "updated": "2025-12-30 04:10:21.585Z",
    "system": false
  },
  {
    "id": "pbc_2985528408",
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "name": "app_memberships",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation2375276105",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_923867626",
        "hidden": false,
        "id": "relation3379458255",
        "maxSelect": 999,
        "minSelect": 0,
        "name": "app",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "select1466534506",
        "maxSelect": 1,
        "name": "role",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "owner",
          "admin",
          "member",
          "readonly"
        ]
      },
      {
        "hidden": false,
        "id": "bool1358543748",
        "name": "enabled",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "created": "2025-12-30 04:12:39.640Z",
    "updated": "2025-12-31 20:05:49.169Z",
    "system": false
  }
]

const STORAGE = [
  {
    "id": "pbc_822680373",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "updateRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "deleteRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\n(\n  @request.auth.app_memberships_via_user.role ?= \"owner\" ||\n  @request.auth.app_memberships_via_user.role ?= \"admin\"\n)",
    "name": "storage_tags",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "hidden": false,
        "id": "text1716930793",
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
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation3725765462",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "created_by",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_182tx1ekaf` ON `storage_tags` (\n  `name`,\n  `created_by`\n)"
    ],
    "created": "2026-08-18 21:32:59.875Z",
    "updated": "2026-08-19 14:04:48.082Z",
    "system": false
  },
  {
    "id": "pbc_1225868984",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true && @request.body.created_by = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\n(\n  created_by = @request.auth.id ||\n  (@request.auth.storage_box_permissions_via_user.box ?= id &&\n   @request.auth.storage_box_permissions_via_user.role ?= \"editor\")\n) && @request.body.created_by:isset = false",
    "deleteRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\ncreated_by = @request.auth.id",
    "name": "storage_boxes",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "hidden": false,
        "id": "text724990059",
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
        "convertURLs": false,
        "hidden": false,
        "id": "editor1843675174",
        "maxSize": 0,
        "name": "description",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1587448267",
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
        "hidden": false,
        "id": "file3760176746",
        "maxSelect": 15,
        "maxSize": 0,
        "mimeTypes": [
          "image/png",
          "image/vnd.mozilla.apng",
          "image/jpeg",
          "image/webp",
          "image/heic",
          "image/heic-sequence"
        ],
        "name": "images",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1520847447",
        "max": 0,
        "min": 0,
        "name": "qr_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select2063623452",
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
        "cascadeDelete": false,
        "collectionId": "pbc_822680373",
        "hidden": false,
        "id": "relation1874629670",
        "maxSelect": 999,
        "minSelect": 0,
        "name": "tags",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation3725765462",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "created_by",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_LvcdU8J6CX` ON `storage_boxes` (\n  `qr_id`,\n  `created_by`\n)"
    ],
    "created": "2026-08-18 21:23:00.051Z",
    "updated": "2026-08-19 12:54:25.798Z",
    "system": false
  },
  {
    "id": "pbc_1711152412",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true\n&& @request.body.created_by = @request.auth.id\n&& (\n  @request.body.box.created_by = @request.auth.id ||\n  (@request.auth.storage_box_permissions_via_user.box ?= @request.body.box &&\n   @request.auth.storage_box_permissions_via_user.role ?= \"editor\")\n)",
    "updateRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\n(\n  box.created_by = @request.auth.id ||\n  (@request.auth.storage_box_permissions_via_user.box ?= box.id &&\n   @request.auth.storage_box_permissions_via_user.role ?= \"editor\")\n) && @request.body.created_by:isset = false",
    "deleteRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\n(\n  box.created_by = @request.auth.id ||\n  (@request.auth.storage_box_permissions_via_user.box ?= box.id &&\n   @request.auth.storage_box_permissions_via_user.role ?= \"editor\")\n)",
    "name": "storage_items",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "cascadeDelete": false,
        "collectionId": "pbc_1225868984",
        "hidden": false,
        "id": "relation145311802",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "box",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text724990059",
        "max": 0,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "editor1843675174",
        "maxSize": 0,
        "name": "description",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "editor18589324",
        "maxSize": 0,
        "name": "notes",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "hidden": false,
        "id": "file3760176746",
        "maxSelect": 99,
        "maxSize": 0,
        "mimeTypes": [
          "image/png",
          "image/vnd.mozilla.apng",
          "image/jpeg",
          "image/webp",
          "image/heic",
          "image/heic-sequence"
        ],
        "name": "images",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_822680373",
        "hidden": false,
        "id": "relation1874629670",
        "maxSelect": 999,
        "minSelect": 0,
        "name": "tags",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation3725765462",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "created_by",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "created": "2026-08-18 21:37:20.987Z",
    "updated": "2026-08-19 14:03:05.613Z",
    "system": false
  },
  {
    "id": "pbc_3795457256",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true && @request.body.user = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" &&\nuser = @request.auth.id &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true && @request.body.user:isset = false",
    "deleteRule": "@request.auth.id != \"\" &&\nuser = @request.auth.id &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "name": "storage_comments",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "cascadeDelete": false,
        "collectionId": "pbc_1711152412",
        "hidden": false,
        "id": "relation521872670",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "item",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation2375276105",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text999008199",
        "max": 0,
        "min": 0,
        "name": "text",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "created": "2026-08-18 21:38:30.159Z",
    "updated": "2026-08-19 14:02:41.980Z",
    "system": false
  },
  {
    "id": "pbc_3180270093",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\n@request.body.created_by = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" &&\ncreated_by = @request.auth.id &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true && @request.body.created_by:isset = false",
    "deleteRule": "@request.auth.id != \"\" &&\ncreated_by = @request.auth.id &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "name": "storage_item_voice_notes",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "cascadeDelete": false,
        "collectionId": "pbc_1711152412",
        "hidden": false,
        "id": "relation521872670",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "item",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "file410859157",
        "maxSelect": 1,
        "maxSize": 0,
        "mimeTypes": [
          "audio/mpeg",
          "audio/mp4"
        ],
        "name": "audio",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text245846248",
        "max": 0,
        "min": 0,
        "name": "label",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation3725765462",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "created_by",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "created": "2026-08-18 21:52:04.791Z",
    "updated": "2026-08-19 14:03:19.771Z",
    "system": false
  },
  {
    "id": "pbc_1830113085",
    "listRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "viewRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true",
    "createRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\nbox.created_by = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\nbox.created_by = @request.auth.id",
    "deleteRule": "@request.auth.id != \"\" &&\n@request.auth.app_memberships_via_user.app.key ?= \"storage\" &&\n@request.auth.app_memberships_via_user.enabled ?= true &&\nbox.created_by = @request.auth.id",
    "name": "storage_box_permissions",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
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
        "cascadeDelete": false,
        "collectionId": "pbc_1225868984",
        "hidden": false,
        "id": "relation145311802",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "box",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation2375276105",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "select1466534506",
        "maxSelect": 1,
        "name": "role",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "editor"
        ]
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [],
    "created": "2026-08-18 21:53:55.221Z",
    "updated": "2026-08-18 21:53:55.221Z",
    "system": false
  }
]

migrate((app) => {
  const toImport = []

  for (let i = 0; i < SHARED.length; i++) {
    try {
      app.findCollectionByNameOrId(SHARED[i].name)
    } catch (err) {
      toImport.push(SHARED[i])
    }
  }

  for (let i = 0; i < STORAGE.length; i++) {
    toImport.push(STORAGE[i])
  }

  app.importCollections(toImport, false)

  // The app gates every rule on an enabled membership referencing this row.
  try {
    app.findFirstRecordByFilter("apps", "key = 'storage'")
  } catch (err) {
    const apps = app.findCollectionByNameOrId("apps")
    app.save(new Record(apps, {
      key: "storage",
      name: "Storage Boxes",
      active: true,
    }))
  }
}, (app) => {
  // Reverse dependency order. Shared collections are intentionally left alone.
  const names = [
  "storage_box_permissions",
  "storage_item_voice_notes",
  "storage_comments",
  "storage_items",
  "storage_boxes",
  "storage_tags"
]

  for (let i = 0; i < names.length; i++) {
    try {
      app.delete(app.findCollectionByNameOrId(names[i]))
    } catch (err) {
      // already gone
    }
  }
})

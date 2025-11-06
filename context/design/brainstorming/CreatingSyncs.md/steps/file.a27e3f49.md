---
timestamp: 'Tue Nov 04 2025 17:03:16 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251104_170316.d1fa87f4.md]]'
content_id: a27e3f490e9bb48d9f5053c30a6577c7d9ea6fa42f05e887fe2def68c1a67f6c
---

# file: deno.json

```json
// {
//   "imports": {
//     "@concepts/": "./src/concepts/",
//     "@utils/": "./src/utils/",
//     "@hono/cors": "jsr:@hono/cors"
//   },
//   "tasks": {
//     "concepts": "deno run --allow-net --allow-read --allow-sys --allow-env src/concept_server.ts --port 8000 --baseUrl /api"
//   }
// }



{
    "imports": {
        "@concepts/": "./src/concepts/",
        "@concepts": "./src/concepts/concepts.ts",
        "@test-concepts": "./src/concepts/test_concepts.ts",
        "@utils/": "./src/utils/",
        "@engine": "./src/engine/mod.ts",
        "@syncs": "./src/syncs/syncs.ts",
        "@hono/cors": "jsr:@hono/cors"
    },
    "tasks": {
        "start": "deno run --allow-net --allow-write --allow-read --allow-sys --allow-env src/main.ts",
        "concepts": "deno run --allow-net --allow-read --allow-sys --allow-env src/concept_server.ts --port 8000 --baseUrl /api",
        "import": "deno run --allow-read --allow-write --allow-env src/utils/generate_imports.ts",
        "build": "deno run import"
    },
    "lint": {
        "rules": {
            "exclude": [
                "no-import-prefix",
                "no-unversioned-import"
            ]
        }
    }
}

```

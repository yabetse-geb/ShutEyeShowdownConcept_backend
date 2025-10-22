---
timestamp: 'Tue Oct 21 2025 16:34:38 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_163438.27443f2b.md]]'
content_id: 9e5d8da666f91b7963a71564ca1c46ace893813d3f23281b3c72dd3cf77cba39
---

# file: deno.json

```json
{
  "imports": {
    "@concepts/": "./src/concepts/",
    "@utils/": "./src/utils/",
    "@hono/cors": "jsr:@hono/cors"
  },
  "tasks": {
    "concepts": "deno run --allow-net --allow-read --allow-sys --allow-env src/concept_server.ts --port 8000 --baseUrl /api"
  }
}

```

import { closePool } from "./db.js";
import { demoData } from "./data.js";
import { store } from "./store.js";

await store.init();
await store.replaceAll(demoData);

console.log(`Seeded ${store.mode} storage.`);

await closePool();

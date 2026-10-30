import * as webpush from "jsr:@negrel/webpush@0.5.0";

const keys = await webpush.generateVapidKeys({ extractable: true });
const exportedKeys = await webpush.exportVapidKeys(keys);
await Deno.writeTextFile("vapid.json", JSON.stringify(exportedKeys, null, 2));
console.log(`Public VAPID key for Vercel: ${await webpush.exportApplicationServerKey(keys)}`);
console.log("Private VAPID key pair saved to the ignored local file vapid.json.");

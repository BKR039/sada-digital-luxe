# Background Web Push setup

Web Push uses the existing `push_subscriptions` table and service worker. Deploy this function separately from the Vercel app. Generate a VAPID key pair and save the generated JSON locally (never commit it):

```sh
deno run -A supabase/functions/send-web-push/generate-vapid-keys.ts
$keysJson = Get-Content .\vapid.json -Raw
npx supabase db push --project-ref mtfkzabiscyleztypqks
npx supabase secrets set "VAPID_KEYS_JSON=$keysJson" VAPID_SUBJECT=mailto:admin@sada.agency --project-ref mtfkzabiscyleztypqks
Remove-Variable keysJson
npx supabase functions deploy send-web-push --project-ref mtfkzabiscyleztypqks
```

The script saves the private key pair to the ignored local file `vapid.json` and prints the public key. Set that public key as `VITE_VAPID_PUBLIC_KEY` in Vercel, then redeploy the app. Delete `vapid.json` after setup. The key pair must match, and should not be rotated after users subscribe unless they re-enable push on each device.

The Edge Function authenticates the caller, verifies notification ownership, and sends each notification only once to its intended active subscriptions. Expired push endpoints are marked inactive. The PWA user must install/open the app, grant notification permission, and enable Mobile Push in Notification Preferences once per device.

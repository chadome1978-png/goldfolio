# Goldfolio + Supabase BNK — Security Notes

## Approved scope

The user selected Supabase project **BNK** (`etsguakphlytlvzotmor`) and explicitly asked to include photo and warranty attachments. Goldfolio will use its own `public.goldfolio_*` tables and a private bucket named `goldfolio-attachments`; existing RoomRent tables, rows and buckets are out of scope and must not be read, altered or deleted.

The project's WebDev server capability is already enabled; the managed WebDev database remains disabled. Website auto-publishing remains off.

## Security design

- Use Manus OAuth for app-user identity, as required by the WebDev authentication contract. The server validates the application session and derives the owner identifier from the verified Manus `openId`; it never trusts an `owner_id` supplied by the browser.
- Keep all database and Storage requests behind the Node server. Use a Supabase secret key only as a server environment value; never add it to Vite-prefixed variables, client bundles, source files, Git, logs or screenshots.
- Enable Row Level Security on all new public-schema tables and revoke `anon` and `authenticated` grants. There are no direct browser-to-Supabase data requests. The server uses its privileged key, which bypasses RLS, so every API operation must explicitly filter by the verified owner ID and validate resource ownership.
- Keep the Storage bucket private. Only accept the app's image/PDF types and enforce the upload size limits already used by the client. Private access is mediated by the authenticated server; no public object URLs.
- Keep IndexedDB and JSON export/restore as the local cache/offline fallback. Do not upload existing local holdings or attachments on first login until the user confirms the initial sync in the app. After that explicit opt-in, authenticated changes may sync automatically; failures must preserve local data and show a pending/error state.
- Use conflict-aware merging by `updatedAt`, with deletion tombstones so an offline or stale device does not silently restore a remotely deleted holding. Do not replace one side wholesale without an explicit action.

## Verified official Supabase guidance

Supabase recommends secret keys only for controlled server-side components because they have elevated access and bypass RLS; they must never be exposed in a browser or source control. Its API-key guide also recommends current `sb_secret_...` keys over legacy `service_role` JWT keys.[1]

Supabase's RLS guide says to enable RLS on every table in an exposed schema and explicitly manage grants. A privileged secret key bypasses RLS, so application-server authorization checks remain mandatory.[2]

Supabase Storage private buckets restrict object access and downloads; signed URLs are time-limited. Goldfolio instead serves private attachments through its authenticated server boundary and keeps no public bucket.[3]

[1]: https://supabase.com/docs/guides/getting-started/api-keys "Supabase API keys"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[3]: https://supabase.com/docs/guides/storage/buckets/fundamentals "Supabase Storage bucket fundamentals"

# Goldfolio + Supabase BNK — Security Notes

## Approved scope

The user selected Supabase project **BNK** (`etsguakphlytlvzotmor`) and explicitly asked to include photo and warranty attachments. Goldfolio uses only `public.goldfolio_holdings`, `public.goldfolio_preferences`, and the private bucket `goldfolio-attachments`. Existing RoomRent tables, rows, functions, and buckets are outside Goldfolio's migration and have not been modified.

The WebDev server capability is enabled; the WebDev managed database remains disabled. Auto Publish is off. No live publication was requested.

## Applied schema and verified access

On 2026-11-19, the additive migration `goldfolio_cloud_sync` created the two Goldfolio tables, owner/update index, server-only upsert RPC, and private attachment bucket. Read-only checks confirmed `relrowsecurity = true` and `relforcerowsecurity = true` for both tables. `anon` and `authenticated` have no table grants; `service_role` has the table privileges used by the server. The upsert RPC is executable by `service_role` only. The bucket is private, limited to 5 MiB, and allows JPEG, PNG, WebP, and PDF.

A restrictive `storage.objects` policy denies all direct access to the Goldfolio bucket while leaving other buckets' policy behavior unchanged. The Supabase security advisor reports “RLS enabled, no policy” for both new tables; this is intentional fail-closed behavior combined with revoked browser grants. No client role receives direct table access. Supabase advisors also returned unrelated pre-existing notices elsewhere in BNK; those objects are not part of this change and were not altered.

## Credentials and request flow

- `GOLDFOLIO_SUPABASE_SECRET_KEY` is the server-only Supabase secret API key used on the `apikey` header for PostgREST database requests. It must never be sent as `Authorization: Bearer` because the current opaque `sb_secret_...` keys are not JWTs.[1]
- `GOLDFOLIO_SUPABASE_STORAGE_SERVICE_KEY` is a separate server-only `service_role` JWT used for private Storage requests. Supabase Storage's server-side access guidance uses the service key in the `Authorization` header to bypass RLS; this credential never reaches the browser.[2]
- Both values must be added through WebDev's protected-secret input surface, not pasted into chat or committed to source, `.env`, public Git, logs, screenshots, or responses. They are not currently configured, so live authentication/database/storage requests and end-to-end saves remain unverified.
- Manus OAuth provides the application identity. The server validates the `webdev_app_session` HS256 signature, project ID, expiry, and `openId`; it derives the owner from that verified session and never accepts `owner_id` from the client.
- All database requests pass through the Node API, are filtered by the session-derived owner ID, and require Cloud Sync opt-in. Existing local records and attachments are not uploaded until the user confirms first sync. Local IndexedDB and JSON backup remain available if cloud operations fail.
- Attachment paths are opaque owner-hash/record/slot/UUID keys. Uploads validate MIME signatures, metadata and a 5 MiB limit; downloads require an authenticated owner-scoped record lookup. The bucket is not public and no public object URL is generated.

## Remaining verification

Configure both protected secrets, load them into the development runtime, and then test OAuth login, status, consent/cancel, holding upsert and delete tombstones, owner isolation, quote preferences, and private attachment upload/download/delete. Confirm successful saves only after these requests have been exercised with real authenticated sessions. Do not publish unless the user explicitly requests it.

## References

[1]: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys "Supabase API key migration guide"
[2]: https://supabase.com/docs/guides/storage/security/access-control "Supabase Storage access control"
[3]: https://supabase.com/docs/reference/javascript/storage-from-remove "Supabase Storage object removal API"

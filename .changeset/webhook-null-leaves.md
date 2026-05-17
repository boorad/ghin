---
'@spicygolf/ghin': patch
---

Fix webhook settings GET to accept `null` leaves. GHIN returns every event key on every top-level field with `null` as the "unregistered" sentinel rather than omitting the key, which previously caused `schemaWebhookSettings` parsing to fail and `ensureRegistered` to misreport state. The response schema now allows `string | null | undefined` per leaf while PATCH bodies retain the stricter "optional, no null" shape (use `''` to clear a URL).

---
'@spicygolf/ghin': minor
---

Score posts no longer send the `source: GHINcom` header

Every authed request defaulted to a `source: GHINcom` header. USGA read that header as the origin of a posted score, so every score this library posted was attributed as a manual GHIN.com entry rather than as an API post. USGA stamp the real source server-side, so the three score-post endpoints — `POST /scores/hbh.json`, `POST /scores/adjusted.json`, `POST /scores/18h9and9.json` — now send no `source` header at all.

Omitted, not blanked. A blank `source` is still a value we would be asserting, and its meaning is USGA's to define; sending nothing is the unambiguous signal.

Deliberately scoped to `/scores`. The GET endpoints still send `source` as both a header and a query parameter, and `POST /playing_handicaps.json` still sends it as a header and a body field. GHIN may genuinely key off the value there, and that behaviour is not ours to guess at.

No public API change: `CLIENT_SOURCE` is unchanged and still exported. The mechanism is a new exported `OMIT_HEADER` sentinel — a caller passes `headers: { source: OMIT_HEADER }` and the request client strips the key before the request goes out, so the sentinel never reaches the wire.

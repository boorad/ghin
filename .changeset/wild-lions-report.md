---
'@spicygolf/ghin': minor
---

Stop sending `source: GHINcom` on every transport

v0.19.0 removed the `source` header from the three score-post endpoints only, because GHIN might have keyed off it elsewhere. USGA have since confirmed they want the value gone entirely — they stamp the real source server-side, and our sending `GHINcom` made them read Spicy's API traffic as GHIN.com consumer traffic. This removes it from all three places it reached the wire:

- the `source` HTTP header, which `authedRequest` added to **every** authed request
- the `?source=GHINcom` query parameter on the ten GET endpoints that seeded it into their query string
- the `source` field in the `POST /playing_handicaps.json` request body

Absent, not blank, everywhere — a blank `source` is still a value we would be asserting, and its meaning is USGA's to define.

**Breaking for direct importers, though this is a 0.x library and Spicy is the only consumer.** Two exports are removed:

- `OMIT_HEADER` — the v0.19.0 sentinel that let a call site opt out of the header default. With no default left there is nothing to opt out of, so the sentinel, the stripping loop in `authedRequest`, and the three `headers: { source: OMIT_HEADER }` call sites are all gone.
- `CLIENT_SOURCE` — nothing references it any more, so it is deleted rather than left as a dead public constant.

`schemaCourseHandicapsRequest` also loses its `source` field. **Open question for USGA:** nothing in this repo's code, fixtures or docs says whether `POST /playing_handicaps.json` *requires* the `source` key to be present, so we removed it rather than send an empty one. If USGA come back saying the key is mandatory, that field is the single place to restore it.

---
'@spicygolf/ghin': minor
---

Auto re-login on 401/403 responses. Per USGA Data Services §4.2.1, USGA tokens expire after 12 hours regardless of the JWT `exp` claim, so long-running services that hold a `GhinClient` past the session ceiling were failing with `AuthenticationError` until the process restarted. The request client now performs a single-shot re-login + retry on 401/403 (kept outside the exponential-backoff loop to avoid login storms when credentials are actually wrong). Concurrent in-flight requests that all hit 401 share one re-login.

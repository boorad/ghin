# GHIN Authentication Flow

This document describes the authentication flows used by the GHIN API, as implemented by this library and verified through real-world integration testing.

## Overview

The GHIN API requires authentication for **all endpoints** (as of early 2026 — previously some endpoints like `golfers/search.json` allowed unauthenticated access).

This library supports two authentication paths:

1. **Firebase Installations + GHIN Login** (default) — Two-step flow used by the ghin.com web app
2. **Direct API Login** (`apiAccess: true`) — Single-step flow for accounts with API access enabled

The `GhinClient` handles both paths automatically. You only need to provide your GHIN credentials in the client configuration.

## Path A: Firebase Installations + GHIN Login (Default)

This is the flow used by the ghin.com Single Page Application. It involves two HTTP requests.

### Step 1: Firebase Installation Token

The client requests a session token from the Google Firebase Installations API. This step does **not** use your GHIN credentials — it uses hardcoded Firebase app identifiers from the ghin.com web app.

**Endpoint:** `POST https://firebaseinstallations.googleapis.com/v1/projects/ghin-mobile-app/installations`

**Headers:**
```
Content-Type: application/json
x-goog-api-key: AIzaSyBxgTOAWxiud0HuaE5tN-5NTlzFnrtyz-I
```

**Request body:**
```json
{
  "appId": "1:884417644529:web:47fb315bc6c70242f72650",
  "authVersion": "FIS_v2",
  "fid": "fg6JfS0U01YmrelthLX9Iz",
  "sdkVersion": "w:0.5.7"
}
```

**Response:**
```json
{
  "authToken": {
    "token": "<firebase-installation-token>",
    "expiresIn": "604800s"
  }
}
```

The `expiresIn` value is parsed to calculate the token's absolute expiry time.

> **Note:** This is the [Firebase Installations API](https://firebase.google.com/docs/reference/installations/rest), **not** the Firebase Identity Toolkit (`identitytoolkit.googleapis.com`). The Installations API authenticates the _app_, not the _user_. The API key and app ID are public client-side values embedded in the ghin.com SPA — they are not secrets.

### Step 2: GHIN Login with Installation Token

The Firebase installation token is sent alongside GHIN credentials to obtain a GHIN session token.

**Endpoint:** `POST https://api2.ghin.com/api/v1/golfer_login.json`

**Request body:**
```json
{
  "token": "<firebase-installation-token>",
  "user": {
    "email_or_ghin": "your-username-or-ghin-number",
    "password": "your-password"
  }
}
```

**Response:**
```json
{
  "golfer_user": {
    "golfer_user_token": "<ghin-bearer-token>",
    "golfer_id": 1234567,
    "email": "user@example.com",
    "expires_at": "2026-02-25T04:00:00.000Z"
  }
}
```

The `golfer_user_token` is used as a `Bearer` token in the `Authorization` header for all subsequent API requests.

## Path B: Direct API Login (`apiAccess: true`)

For GHIN accounts with explicit API access, a simpler single-step flow is available.

**Endpoint:** `POST https://api2.ghin.com/api/v1/users/login.json`

**Request body:**
```json
{
  "user": {
    "email": "your-email@example.com",
    "password": "your-password",
    "remember_me": true
  }
}
```

**Response:**
```json
{
  "token": "<ghin-bearer-token>"
}
```

Enable this path by setting `apiAccess: true` in the client config:

```typescript
const ghin = new GhinClient({
  username: process.env.GHIN_USERNAME,
  password: process.env.GHIN_PASSWORD,
  apiAccess: true,
})
```

## Real-World Finding: Direct Login Without Firebase Token

During integration testing with the [TPS League](https://tpsleague.com) platform, we discovered that the `/golfer_login.json` endpoint (Step 2) also accepts requests **without** the Firebase installation token:

```json
{
  "user": {
    "email_or_ghin": "your-username",
    "password": "your-password",
    "remember_me": true
  }
}
```

This simpler flow works for server-side integrations where the Firebase Installations step adds unnecessary latency. However, this behavior is undocumented by GHIN and may change. The library uses the full two-step flow by default for maximum compatibility.

## Token Lifecycle

### Validation

Before each API request, the client checks whether the current token is still valid by:
1. Decoding the JWT payload (using `jwt-decode`, no signature verification)
2. Comparing the `exp` claim against the current time
3. If expired or missing, triggering a refresh

### Three-Tier Caching

Token retrieval follows a priority chain:
1. **In-memory** — Fastest; checked first on every request
2. **Cache adapter** — Checked if in-memory token is missing/expired
3. **Full refresh** — Re-authenticates via Firebase + GHIN login (or API login)

A mutex lock prevents concurrent token refreshes when multiple requests fire simultaneously.

### Token TTL

Token expiry varies. The `golfer_user_token` JWT contains an `exp` claim that the client respects automatically. In practice, tokens have been observed to last anywhere from 1 hour to 24 hours depending on the login path and GHIN's server-side configuration. Do not assume a fixed TTL — always rely on the JWT `exp` claim.

## Custom Cache Adapter

Provide a custom cache adapter to persist tokens across process restarts (useful for serverless environments like Cloudflare Workers where in-memory state doesn't persist between requests):

```typescript
import { GhinClient, type CacheClient } from '@spicygolf/ghin'

class D1CacheClient implements CacheClient {
  constructor(private db: D1Database) {}

  async read(): Promise<string | undefined> {
    const row = await this.db
      .prepare("SELECT value FROM cache WHERE key = 'ghin_token'")
      .first()
    return row?.value as string | undefined
  }

  async write(value: string): Promise<void> {
    await this.db
      .prepare("INSERT OR REPLACE INTO cache (key, value) VALUES ('ghin_token', ?)")
      .bind(value)
      .run()
  }
}

const ghin = new GhinClient({
  username: process.env.GHIN_USERNAME,
  password: process.env.GHIN_PASSWORD,
  cache: new D1CacheClient(env.DB),
})
```

## Security Notes

- Never commit GHIN credentials to source control. Use environment variables or a secrets manager.
- The Firebase API key and app ID are public client-side values from the ghin.com SPA — they are not secrets.
- The `golfer_user_token` is a JWT that should be treated as sensitive. Store it securely if persisting via a cache adapter.
- All GHIN API communication uses HTTPS.

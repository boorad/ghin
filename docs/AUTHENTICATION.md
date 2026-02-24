# GHIN Authentication Flow

This document describes the two-step authentication flow used by the GHIN API.

## Overview

GHIN uses a two-step authentication process:

1. **Firebase Authentication** — Exchange username/password for a Firebase ID token
2. 2. **GHIN Token Exchange** — Exchange the Firebase token for a GHIN session token
  
   3. The `GhinClient` handles both steps automatically. You only need to provide your GHIN credentials (username/password) in the client configuration.
  
   4. ## Step 1: Firebase Authentication
  
   5. GHIN's login endpoint uses Google Firebase under the hood.
  
   6. **Endpoint:** `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
  
   7. **Query params:** `?key=<FIREBASE_API_KEY>`
  
   8. **Request body:**
   9. ```json
      {
        "email": "your-ghin-username@example.com",
        "password": "your-ghin-password",
        "returnSecureToken": true
      }
      ```

      **Response:**
      ```json
      {
        "idToken": "<firebase-id-token>",
        "email": "your-ghin-username@example.com",
        "refreshToken": "<firebase-refresh-token>",
        "expiresIn": "3600",
        "localId": "<firebase-user-id>"
      }
      ```

      The `idToken` is a signed JWT issued by Firebase that is valid for ~1 hour.

      ## Step 2: GHIN Token Exchange

      The Firebase `idToken` is exchanged for a GHIN session token via the GHIN login endpoint.

      **Endpoint:** `POST https://api2.ghin.com/api/v1/golfer_login.json`

      **Request body:**
      ```json
      {
        "user": {
          "email_or_ghin": "your-ghin-username@example.com",
          "password": "your-ghin-password",
          "token": "<firebase-id-token>",
          "remember_me": true
        },
        "source": "GHINcom"
      }
      ```

      **Response:**
      ```json
      {
        "golfer_user": {
          "golfer_user_token": "<ghin-session-token>",
          "golfer_id": 1234567,
          "email": "your-ghin-username@example.com",
          "expires_at": "2026-02-25T04:00:00.000Z"
        }
      }
      ```

      The `golfer_user_token` is used as a Bearer token for all subsequent authenticated API requests.

      ## Token Auto-Refresh

      The `GhinClient` automatically refreshes tokens before they expire. When a request fails with a `401 Unauthorized` response, the client re-authenticates using the stored credentials and retries the request.

      Tokens are cached (in-memory by default, or via a custom cache adapter) to avoid unnecessary re-authentication on every request.

      ## Custom Cache Adapter

      You can provide a custom cache adapter to persist tokens across process restarts:

      ```typescript
      import { GhinClient, type CacheClient } from '@spicygolf/ghin'

      class RedisCacheClient implements CacheClient {
        async get(key: string): Promise<string | null> {
          // return await redis.get(key)
        }
        async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
          // await redis.set(key, value, 'EX', ttlSeconds ?? 3600)
        }
        async delete(key: string): Promise<void> {
          // await redis.del(key)
        }
      }

      const ghin = new GhinClient({
        username: process.env.GHIN_USERNAME,
        password: process.env.GHIN_PASSWORD,
        cache: new RedisCacheClient(),
      })
      ```

      ## Security Notes

      - Never commit GHIN credentials to source control. Use environment variables.
      - - The GHIN API key for Firebase is a public client-side key embedded in the ghin.com SPA — it is not a secret, but the credentials themselves must be kept private.
        - - Tokens expire after approximately 24 hours. The client handles renewal automatically.

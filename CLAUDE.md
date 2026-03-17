# GHIN - Claude Code Configuration

`@spicygolf/ghin` — unofficial TypeScript wrapper for the Golf Handicap and Information Network (GHIN) API.

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript | Language (strict mode, ES2022 target) |
| Bun | Package manager (v1.3.2) |
| tsup | Bundler (CJS + ESM + DTS) |
| Vitest | Test runner |
| Biome | Formatter + linter |
| Zod | Schema validation |
| neverthrow | Result/Error types |
| Changesets | Version management |

## Common Commands

```bash
bun run build            # Build dist (CJS, ESM, DTS)
bun run format           # Auto-format with Biome
bun run lint             # Biome lint + tsc type check
bun run test             # Vitest watch mode
bun run test:run         # Vitest single run
bun run test:coverage    # Vitest with coverage
bun run dev              # Run playground script
```

## Quality Checks

The pre-commit hook runs `./scripts/code-quality.sh` which checks: biome (format + lint), lint + tsc, and build. To run manually:

```bash
./scripts/code-quality.sh
```

## Code Style

- **Biome** handles formatting and linting (not ESLint/Prettier)
- Single quotes, no semicolons, 2-space indent, 120 char line width, LF endings
- Import organization is enforced by Biome
- Run `bun run format` to auto-fix

## Project Structure

```
src/
  client/
    ghin/              # Main GhinClient — courses, facilities, golfers, handicaps
      models/          # Zod schemas + TypeScript types for API responses
    request-client/    # HTTP client with auth token refresh
    in-memory-cache-client/  # Default cache implementation
  models/              # Core interfaces (CacheClient, ClientConfig, validation)
  errors/              # Custom error classes (GhinError, AuthenticationError, etc.)
  utils/               # Retry logic, helpers
  playground/          # Dev test scripts
```

## Key Patterns

- **Zod schemas** define all API response types — models live alongside their client methods in `src/client/ghin/models/`
- **neverthrow Result types** for error handling — functions return `Result<T, E>` instead of throwing
- **Auth token refresh** is handled automatically by the request client with mutex locking
- **In-memory caching** with configurable TTL via `CacheClient` interface

## Git Workflow

- Never commit directly to `main` — always use feature branches
- Branch naming: `feat/<name>`, `fix/<name>`, `refactor/<name>`
- Conventional commit messages: `type: short description`
- Releases managed via Changesets + GitHub Actions

## CI/CD

- **Main CI** (all branches except main): biome check, lint, build, test with coverage → Codecov
- **Release** (manual dispatch): changesets version → build → npm publish → GitHub release

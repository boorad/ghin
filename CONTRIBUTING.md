# Contributing to `ghin`

Thank you for your interest in contributing! This guide covers everything you need to get started — from setting up your local environment to opening a pull request.

## Table of Contents

- [Development Setup](#development-setup)
- - [Running Tests](#running-tests)
  - - [Linting & Formatting](#linting--formatting)
    - - [Project Structure](#project-structure)
      - - [Commit Conventions](#commit-conventions)
        - - [Changeset Versioning](#changeset-versioning)
          - - [Opening a Pull Request](#opening-a-pull-request)
           
            - ---

            ## Development Setup

            This project uses [Bun](https://bun.sh) as its package manager and runtime.

            ```shell
            # 1. Fork the repo on GitHub, then clone your fork
            git clone https://github.com/<YOUR_USERNAME>/ghin.git
            cd ghin

            # 2. Install dependencies
            bun install

            # 3. Copy the environment example and fill in your GHIN credentials
            cp .env.example .env
            # Edit .env and set GHIN_USERNAME and GHIN_PASSWORD
            ```

            > **Note:** Credentials are only needed for the playground scripts in `src/playground/`. The unit test suite runs entirely with mocked HTTP — no live credentials required.
            >
            > ---
            >
            > ## Running Tests
            >
            > ```shell
            > # Run the full test suite (182 tests across 15 files)
            > bun run test
            >
            > # Run tests in watch mode during development
            > bun run test --watch
            >
            > # Run a single test file
            > bun run test src/client/ghin/index.test.ts
            > ```
            >
            > All tests mock the HTTP layer via `msw` (Mock Service Worker) — no real network calls are made.
            >
            > ---
            >
            > ## Linting & Formatting
            >
            > This project uses [Biome](https://biomejs.dev) for both linting and formatting.
            >
            > ```shell
            > # Check for lint and format issues
            > bun run lint
            >
            > # Auto-fix lint and format issues
            > bun run lint:fix
            >
            > # Format only
            > bun run format
            > ```
            >
            > Biome is configured in `biome.json`. Please ensure `bun run lint` passes with no errors before opening a PR.
            >
            > ---
            >
            > ## Project Structure
            >
            > ```
            > src/
            > ├── client/
            > │   ├── ghin/
            > │   │   ├── index.ts            # GhinClient — main entry point, all public methods
            > │   │   ├── index.test.ts       # Integration-style tests for GhinClient
            > │   │   └── models/             # Zod schemas + TypeScript types per domain
            > │   │       ├── course/
            > │   │       ├── facility/
            > │   │       ├── golfers/
            > │   │       ├── handicaps/
            > │   │       └── scores/
            > │   ├── in-memory-cache-client/ # Default cache implementation
            > │   └── request-client/         # Auth, HTTP, token refresh logic
            > ├── errors/                     # Custom error classes
            > ├── models/                     # Shared primitive Zod schemas (number, string, date, …)
            > ├── playground/                 # Ad-hoc scripts for manual API exploration
            > └── index.ts                    # Public package entry point
            > docs/
            > ├── API_ENDPOINTS.md            # Complete endpoint reference
            > ├── AUTHENTICATION.md           # Two-step Firebase + GHIN auth flow
            > └── llm-output/                 # Research notes from API exploration sessions
            > ```
            >
            > ### Adding a New Endpoint
            >
            > 1. **Add the Zod schema** in the appropriate `models/` subdirectory (e.g., `src/client/ghin/models/golfers/my-new-endpoint.ts`)
            > 2. 2. **Re-export it** from the subdirectory's `index.ts`
            >    3. 3. **Add the method** to `GhinClient` in `src/client/ghin/index.ts`
            >       4. 4. **Write tests** in `src/client/ghin/index.test.ts` — use the existing mock patterns for `mockFetch` or `mockFetchCustomPath`
            >          5. 5. **Document the endpoint** in `docs/API_ENDPOINTS.md`
            >            
            >             6. ---
            >            
            >             7. ## Commit Conventions
            >            
            >             8. This project follows [Conventional Commits](https://www.conventionalcommits.org/) with emoji prefixes, matching the existing commit history style:
            > 
            | Type | Emoji | Example |
            |------|-------|---------|
            | `feat` | ✨ | `feat: ✨ add golfers.getFollowing()` |
            | `fix` | 🐛 | `fix: 🐛 handle null geolocation fields` |
            | `docs` | 📝 | `docs: 📝 add CONTRIBUTING.md` |
            | `test` | 🧪 | `test: 🧪 add tests for getFollowing` |
            | `chore` | 🔧 | `chore: 🔧 update dependencies` |
            | `refactor` | ♻️ | `refactor: ♻️ extract shared URL builder` |

            The commit message format is:
            ```
            <type>: <emoji> <short description>

            [optional body]

            [optional footer, e.g. Closes #42]
            ```

            ---

            ## Changeset Versioning

            This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

            Before opening a PR that changes public behaviour, add a changeset:

            ```shell
            bun changeset
            ```

            This will prompt you to:
            1. Select the type of change (`major`, `minor`, or `patch`)
            2. 2. Write a short summary for the changelog
              
               3. The generated `.changeset/*.md` file should be committed with your changes. Changesets are consumed automatically by the release workflow when a PR merges to `main`.
              
               4. > **Skip changesets for:** docs-only PRs, chore/refactor PRs that don't change public API, and test-only PRs.
                  >
                  > ---
                  >
                  > ## Opening a Pull Request
                  >
                  > 1. Create a branch off `main` following the naming convention: `<type>/<short-description>` (e.g., `feat/golfer-following`, `fix/geolocation-nan`, `docs/api-reference`)
                  > 2. 2. Make your changes, write tests, and ensure `bun run test` and `bun run lint` both pass
                  >    3. 3. Add a changeset if applicable (see above)
                  >       4. 4. Push your branch and open a PR against `boorad/ghin:main`
                  >          5. 5. Fill in the PR description with:
                  >             6.    - **Summary** — what you changed and why
                  >                   -    - **Test Plan** — what you tested (unit tests, manual verification, etc.)
                  >                        -    - **Checklist** — tests pass, lint passes, TypeScript compiles, build succeeds
                  >                         
                  >                             - ### Verifying your build locally
                  >                         
                  >                             - ```shell
                  >                               # Run the full verification suite before opening a PR
                  >                               bun install
                  >                               bun run test       # all tests must pass
                  >                               bun run lint       # no lint errors
                  >                               bun run build      # TypeScript must compile and bundle successfully
                  >                               ```
                  >
                  > ---
                  >
                  > Thank you for helping improve `ghin`! ⛳

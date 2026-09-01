# Code Review Branch Commits

Review all commits on the current branch since diverging from main.

## Prerequisites

**IMPORTANT**: A reviewer should not be the same "person" who wrote the code. Before starting, check if this is a fresh context/session:

- **If there is prior conversation history in this session** (e.g., you helped write the code being reviewed), do NOT review it yourself — your context is biased. Instead, spawn a fresh reviewer:
  - Launch a fresh `general-purpose` subagent (synchronously — `run_in_background: false`) with a prompt telling it to perform the full review defined in the **Instructions** section below on the current branch, and to return its findings as: a summary, positives, and a severity-ranked list of issues (each with `file:line`, description, and a proposed action).
  - The subagent starts with a clean context and did NOT write the code, so its review is unbiased.
  - When it returns, relay its review to the user verbatim, then run the **Follow-up** fix-plan step yourself (the subagent can't interact with the user).
- **If this is a fresh context** (no prior history — you did not write this code), perform the review directly.

## Instructions

When activated, perform a full code review of the commits since branching from main:

1. **Get the commits**: Run `git log main..HEAD --oneline` to see all commits on this branch
2. **Get the full diff**: Run `git diff main..HEAD` to see all changes
3. **For each file changed**, read enough context to understand the changes
4. **Review for**:
   - Correctness and logic errors
   - Consistency with existing patterns in the codebase
   - TypeScript best practices
   - Zod schema correctness (this project uses Zod extensively for validation)
   - Error handling with `neverthrow` Result types
   - Potential bugs or edge cases
   - Code clarity and maintainability
5. **Provide a structured review** with:
   - Summary of what the branch does
   - Positives (what's done well)
   - Issues & suggestions (ranked by severity)
   - Recommended actions (if any)

Run `./scripts/code-quality.sh` to verify the code compiles and passes lint.

## Follow-up

After presenting the review, build a **fix plan table** classifying each finding:

| # | File | Issue | Proposed Action |
|---|------|-------|-----------------|
| 1 | path/to/file.ts:42 | Brief description | Fix / Skip / Ask |

- **Fix**: Will apply the change
- **Skip**: Not worth changing (explain why)
- **Ask**: Ambiguous, needs user input on approach

Reserve **Ask** for findings where two defensible fixes lead to materially different work and the choice is the user's to make. A finding you can resolve from the code, the conventions, or a sensible default is a **Fix** or a **Skip** with the reason stated — not an Ask. Padding the table with Asks to be safe is how this step became a second round trip for nothing.

Then:

- **No `Ask` items** — apply every **Fix** immediately, without waiting. Print the table first so the user can see what is about to happen and interject, then do the work. Say plainly what you changed and what you skipped; the user reviews the result, not the plan.
- **One or more `Ask` items** — apply the unambiguous **Fix** items anyway, then stop and put the Asks to the user. Blocking the whole batch on one open question wastes the rest.

Run `./scripts/code-quality.sh` after all fixes are applied to verify everything is clean, and re-run the test suite (`bun run test:run`) — the quality gate does not run tests.

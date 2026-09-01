# Implement an Issue End-to-End

Take a GitHub issue number and drive it to an open PR with as little human
intervention as possible. `$ARGUMENTS` is the issue number (bare, `#123`, or a
full issue URL). With no argument, ask which issue and stop.

You are the **orchestrator**. Keep your context small and delegate: don't do
implementation reading, don't write implementation code. Every phase that
touches the codebase runs in a subagent with a fresh context; you hold the issue
text, the plan doc path, and each subagent's report. A targeted read to triage a
failure is fine — a full subagent round trip for a one-line typo is not.

You are also explicitly authorised to push and open a PR at the end. That
overrides the standing "stop at commit" preference, because invoking a command
named issue-to-PR is the ask.

## The one place humans are allowed in

Structural forks get asked once, in Phase 2, before any code is written, with
`AskUserQuestion`. A fork is structural only if a wrong guess means throwing the
work away: a breaking change to a published type or schema, a new client method
boundary, a change to how errors surface through `Result`, or two designs with
materially different blast radius on consumers. Naming, file placement, and
internal factoring are **not** — decide them and move on. If the issue is
ambiguous about *what to build* (not how), that is also a Phase 2 question.

Anything that surfaces after Phase 2 is answered by picking the option most
consistent with the codebase, writing it into the plan doc under
**Assumptions**, and continuing.

If `AskUserQuestion` isn't available (a `-p` or scheduled run), stop and report
the questions with your recommendations. Do not guess on a structural fork.

## Phase 1 — Read the issue (you, cheap)

```bash
gh issue view <N> --json number,title,body,labels,comments,state,closedByPullRequestsReferences
```

Take `<N>` from the returned `number` — that normalizes `#123` and URLs. `<slug>`
is the issue title, lowercased, non-alphanumerics collapsed to hyphens, ≤5
words; it must match between the branch name and the plan filename, because
`/pr` matches plan docs on an exact identifier.

If `state` is `CLOSED` or `closedByPullRequestsReferences` is non-empty, stop
and say so. (Don't use `gh pr list --search "<N>"` — it free-text matches
unrelated PRs and misses linked ones.)

Also `gh issue list --search "<key terms>" --state all --limit 10` if the issue
references prior work.

## Phase 2 — Recon (subagent, `Explore`)

Launch **one** `Explore` subagent, synchronously (`run_in_background: false`),
with the full issue title + body + relevant comments pasted in — it cannot see
your context — and this instruction set:

> Search "very thorough". Read `CLAUDE.md`. Do not write any code. Return:
>
> 1. **Files** — every file that must change, with `path:line` anchors and one
>    line on what changes there. Zod schemas live in
>    `src/client/ghin/models/` alongside the client methods that use them.
> 2. **Existing patterns to mirror** — the closest already-shipped analogue in
>    this repo, by path, and what it does.
> 3. **Phases** — a 2-5 step implementation order where each step is
>    independently committable and each step's tests can run on their own.
> 4. **Tests** — which existing test files cover this area and what new cases
>    are needed.
> 5. **Published surface** — does this change the emitted types or runtime
>    behaviour consumers can observe? If so, is it `minor` (new capability) or
>    `patch` (fix/refactor), and is anything about it breaking?
> 6. **Structural questions** — ONLY questions where a wrong guess wastes the
>    implementation. Each with 2-3 concrete options and your recommendation. If
>    there are none, say "none" — do not invent one.
> 7. **Gotchas** — the specific rules from CLAUDE.md that apply to *these*
>    files, plus this repo's standing conventions: `neverthrow` `Result` rather
>    than throwing, Zod parse leniency (a field going absent must not take down
>    a whole response), Biome formatting. Quote them; the implementation agents
>    get this list verbatim.
> 8. **Manual verification** — anything unit tests can't prove: real GHIN/USGA
>    API responses, sandbox-vs-production payload differences, auth token
>    refresh against the live service, downstream consumer behaviour. Be strict.
>    If there is nothing, say "none".

If it returns no files to change, stop and report — the issue needs
clarification, not code.

Structural questions present → put them to the user, recommendation first. This
is the only stop that *asks a question*; several later steps stop and report
without asking. None → continue immediately, without checking in.

## Phase 3 — Branch and plan doc (you)

First the guards, then the command:

- `git status --porcelain` must be empty. If it isn't, stop — do not stash.
- `git rev-parse --show-toplevel` is the repo root. Use it verbatim in every
  subagent prompt; a hardcoded path sends edits from a worktree into the main
  checkout.
- If `<type>/<N>-<slug>` already exists, stop and report — the issue is already
  in flight.

```bash
git fetch origin main && git checkout -b <type>/<N>-<slug> origin/main
```

`<type>` is `fix` / `feat` / `refactor` / `chore` from the issue's nature.
Note that `chore/` and `ci/` branches are exempt from the CI changeset gate;
everything else needs a changeset before the PR passes.

Write `plans/todo/<N>-<slug>.md`: the problem, a **Live tracker** section with
the phase list as a checklist, answered structural questions under
**Decisions**, self-answered ones under **Assumptions**. Commit.

## Phase 4 — Implement (one fresh subagent per phase, sequential)

Record `before=$(git rev-parse HEAD)`, then launch a `general-purpose` subagent,
synchronously, with a self-contained prompt:

> Repo: `<repo root from git rev-parse>`, branch `<branch>`. Confirm
> `git branch --show-current` is `<branch>` before you edit anything — if it
> isn't, stop and report. Never commit to main.
>
> Read `CLAUDE.md`, then `plans/todo/<N>-<slug>.md`.
>
> **Your phase only: "<phase title>".** Do not start later phases.
> <paste this phase's files, pattern notes, and Gotchas from the recon report;
> and one paragraph of the previous phase's report if there was one>
>
> Never `--no-verify`. Mark deliberate simplifications with a `ponytail:`
> comment.
>
> Write this phase's tests. Run `bun run test:run <affected paths>` and fix
> everything it reports, including pre-existing failures in files you touched.
> Commit with a conventional-commit message — the pre-commit hook runs
> `./scripts/code-quality.sh` — and tick this phase's box in the plan doc in the
> same commit.
>
> Return: paths changed, what you tested and the result, any deviation from the
> plan and why, anything unfinished.

Then verify, don't trust the report: `git rev-parse HEAD` must differ from
`$before` **and** `git status --porcelain` must be empty. Either check failing
means the phase didn't land — launch a **second fresh** subagent with the first
one's report pasted in as context. If that one also fails, stop and report. Two
attempts, no more.

If a subagent reports a genuine structural fork, take the option most consistent
with the repo, record it under **Assumptions**, and keep going. Do not ask.

## Phase 5 — Whole-branch tests (you)

```bash
bun run test:run
```

Only this — the pre-commit hook already ran `./scripts/code-quality.sh` on every
phase commit, and it's repo-wide rather than diff-scoped, so the last phase's
hook was the whole-branch gate. The quality gate does not run tests; that's the
gap this closes.

Failures go to a fresh `general-purpose` subagent with the output pasted in,
told to fix and commit. At most twice, then stop and report.

## Phase 6 — Review

Launch a fresh `general-purpose` subagent and give it the **Instructions**
section of `.claude/commands/review.md` to perform on this branch, returning a
summary, positives, and severity-ranked issues with `file:line` and a proposed
action. It must be fresh — your context wrote this code.

Classify its findings yourself per review.md's Fix / Skip / Ask taxonomy, but do
**not** present the table and do **not** stop for Asks: apply every Fix, and for
each Ask pick the option most consistent with the codebase and record it under
**Assumptions**. Re-run `bun run test:run`; commit.

Then `git mv plans/todo/<N>-<slug>.md plans/done/` and commit it — here, not in
Phase 7, so the doc still moves when Phase 6.5 stops the run. Carry unchecked
verification items over, marked "Carried" with an owner.

Keep the review text for the final report.

## Phase 6.5 — Manual verification gate (you)

Read the recon's **Manual verification** list:

- **"none"** → Phase 7.
- **Anything listed** → **stop here.** Do not push, do not open a PR. Report
  what shipped, the review, and a numbered list of exactly what the user must
  check by hand and how. The branch is committed and ready; `/pr` opens it once
  they're satisfied.

## Phase 7 — PR

Run the `/pr` command's flow, with one note: the plan doc already moved in
Phase 6, so skip its step 3. Its changeset step (step 2) still applies — use the
recon report's **Published surface** answer to pick `minor` vs `patch`. Body
gets `Closes #<N>`. Report the URL.

## Final report

Short. What shipped, the PR URL or why you stopped short of one, the review
verbatim, every **Assumption** you made without asking, and what's left for the
user by hand. Nothing else.

# Commit Changes

Stage and commit the current changes with a well-crafted message.

## Instructions

When activated, commit the current working tree changes:

1. **Sync with remote**:
   - Run `git fetch origin main` to get latest upstream
   - Run `git log HEAD..origin/main --oneline` to check if main has moved ahead
   - If it has, warn the user but don't rebase automatically

2. **Ensure we're not on main**:
   - Run `git branch --show-current`
   - If on `main`, create a new feature branch:
     - Look at the staged/unstaged changes to infer a branch name
     - Run `git checkout -b feat/<descriptive-name>`
     - Inform the user of the new branch name

3. **Review changes**:
   - Run `git diff --stat` and `git diff --staged --stat` to see what's changed
   - If nothing is staged, stage all changed files by name (do NOT use `git add -A` — it may pick up sensitive files like `.env`)
   - Run `git diff --staged --stat` to confirm what will be committed

4. **Generate commit message**:
   - Use conventional commit format: `type: short description`
   - Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`
   - If the change is substantial, add a body paragraph separated by a blank line
   - Body should explain **what** changed and **why**, not how (the diff shows how)
   - Keep the subject line under 72 characters

5. **Commit**:
   ```bash
   git commit -m "<message>"
   ```
   Use 60000ms timeout — pre-commit hooks (biome check, lint, build) take 15-45 seconds.

6. **Report** the commit hash and summary to the user

If the user provides arguments (e.g., `/commit "fix: resolve race condition"`), use that as the commit message instead of generating one.

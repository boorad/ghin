# Create Pull Request

Create a pull request for the current branch.

## Instructions

When activated, create a pull request for the current branch:

1. **Verify branch state**:
   - Run `git branch --show-current` to get the current branch name
   - Ensure we're not on `main` (abort if so)
   - Run `git log main..HEAD --oneline` to see commits to include

2. **Check for a changeset** (CI gate — `changeset` job fails without one):
   - Run `git diff --name-only main..HEAD -- '.changeset/*.md' ':!.changeset/README.md' ':!.changeset/config.json'` — if non-empty, skip this step
   - Otherwise determine if a changeset is needed:
     - **Needed** for any change under `src/` that affects published behavior (features, fixes, refactors users can observe)
     - **Not needed** for pure dev-tooling: tests, CI configs, docs, `.claude/`, `plans/`, `scripts/`, `vitest.config.*`, `tsup.config.*`, `biome.json`, `.changeset/config.json`
   - If needed, create `.changeset/<kebab-name>.md` with frontmatter `'@spicygolf/ghin': minor|patch` (use `minor` for new features, `patch` for fixes/refactors). Body is one paragraph explaining the user-visible change and why — model it on existing files in `.changeset/` from prior releases. Commit it on the current branch before pushing.
   - If not needed, create `.changeset/<kebab-name>.md` with `--empty` semantics: same frontmatter block but no body — or run `npx changeset add --empty` and commit the result.

3. **Move completed plan to done** (if applicable):
   - Check `plans/todo/` for a plan file related to this branch (match by issue number or feature name)
   - If found, check whether all checklist items (`- [ ]`) are complete (`- [x]`)
   - If all complete: `git mv plans/todo/<file> plans/done/<file>`
   - Commit: `git commit -m "docs: move completed plan to plans/done/"`
   - If not all complete, leave it in `plans/todo/`

4. **Push the branch** (if not already pushed):
   - Run `git push -u origin <branch-name>`

5. **Check for related issues**:
   - Look at the branch name for issue numbers (e.g., `fix/896-buffer-import` references #896)
   - Check commit messages for issue references
   - Run `gh issue list --state open --limit 20` to see recent open issues that might be related
   - If the PR resolves an issue, note it for the body

6. **Generate PR title and body**:
   - Title: Use conventional commit format based on the primary change (e.g., `feat: add course search pagination`)
   - Body should include:
     - **Summary**: Brief description of what this PR does
     - **Changes**: Bullet list of key changes
     - **Testing**: How to test the changes (if applicable)
     - **Issue references**: Add `Fixes #XXX` or `Closes #XXX` for any issues this PR resolves (these will auto-close the issues when merged)
     - **Not verified** (only if something is): anything that could not be checked before opening the PR — a production-only response, an irreversible UAT mutation, a credential you don't have. One line each. Put it here rather than in a plan doc, so it is visible where the review happens. If everything was verified, omit the heading entirely.

7. **Create the PR**:

   ```bash
   gh pr create --title "<title>" --body "<body>" --base main --assignee @me
   ```

8. **Report the PR URL** to the user

If the user provides arguments (e.g., `/pr "Custom title"`), use that as the PR title instead of generating one.

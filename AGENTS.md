# Repository Guidelines

## Layout

- `src/undercurrent/`: the package
- `tests/`: pytest tests
- `.github/workflows/ci.yml`: format check, lint, type check and tests on every pull request and every push to `main`
- `.github/workflows/release.yml`: on a `v*` tag on `main`, builds `Dockerfile`, pushes `ghcr.io/elmir-mamedov/undercurrent:<tag>` and publishes a GitHub Release

## Commands

```sh
uv sync
uv run ruff format
uv run ruff check
uv run mypy
uv run pytest
```

CI runs the same with `uv sync --locked` and `ruff format --check`. Add dependencies with `uv add` (`uv add --dev` for tooling) and commit `uv.lock` together with `pyproject.toml`.

## Branches

- `main` is protected: no direct pushes, force-pushes or deletion. It accepts only pull requests that passed CI, merged with Rebase and merge.
- Changes reach `main` through a release branch, `release/<version>`. Only one is open at a time. List it with `git fetch origin && git branch -r --list 'origin/release/*'`. If none is open, cut one from `main` without checking it out: `git push origin origin/main:refs/heads/release/<version>`.
- Never commit on `main` or on the release branch, and never switch branches, edit or commit in the main checkout. Each piece of work gets its own worktree, on a branch named `<type>/<short-name>` cut from the release branch:

  ```sh
  git fetch origin
  git worktree add --no-track -b fix/short-name ../undercurrent-worktrees/short-name origin/release/<version>
  cd ../undercurrent-worktrees/short-name && uv sync
  ```

## Pull requests

Once a change is committed and the checks pass locally, ask before pushing. Then:

1. Run `git fetch origin`. If the release branch has moved, `git merge-base --is-ancestor origin/release/<version> HEAD` fails. In that case, rebase onto the release branch and run the checks again.
2. Push the branch, run `gh pr create --base release/<version>`, then `gh pr checks <number> --watch`.
3. Once every check has passed, run `gh pr merge <number> --rebase`.
   - Don't use `--auto` or `--delete-branch`. GitHub deletes the merged branch itself.
   - If a check fails, fix it, squash the fix into the commit it belongs to, `git push --force-with-lease`, and wait for the checks again.
4. From the main checkout, run `git worktree remove ../undercurrent-worktrees/short-name && git branch -D fix/short-name`.

Merge the release branch into `main` or tag a release only when asked.

## Releases

1. Open the last pull request into the release branch from `chore/release-<version>`. It bumps `version` in `pyproject.toml`, runs `uv lock`, and commits as `chore: release <version>`.
2. Open a pull request from `release/<version>` into `main` and merge it with `--rebase` after CI passes.
3. Run `git fetch origin && git tag v<version> origin/main && git push origin v<version>`, then delete the release branch.

The release workflow refuses a tag that isn't on `main` or that doesn't match the version in `pyproject.toml`. Only admins can create `v*` tags, and no one can move or delete them.

## Commits

- Use Conventional Commits: `<type>(<scope>): <description>`, in the imperative, lowercase, with no trailing period and a subject line under 72 characters.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`, `build`, `ci`, `revert`.
- Each commit is one finished change that passes the checks. Rebase merges keep every commit exactly as written.
- Stage explicit paths. Don't use `git add -A`.
- Commit messages, pull request titles and descriptions describe the change only. Add a body only when the subject line isn't enough.
- Don't add `Co-Authored-By`, `Generated with` or any other trailer.

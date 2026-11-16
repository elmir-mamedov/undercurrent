# Repository Guidelines

## Layout

- `src/undercurrent/`: the package
- `tests/`: pytest tests
- `.github/workflows/ci.yml`: format check, lint, type check and tests on every pull request and every push to `main`
- `.github/workflows/release.yml`: on a `v*` tag on `main`, builds `Dockerfile`, pushes `ghcr.io/elmir-mamedov/undercurrent:<tag>` and publishes a GitHub Release
- `web/`: static map page, with no build step
- `web/vendor/`: pinned third-party files (MapLibre GL JS 6.16.0, JetBrains Mono 2.304). They're copied in, not installed; update one by replacing its files.
- `tiles/prague.pmtiles`: local OpenStreetMap vector tile archive, not committed

## Commands

```sh
uv sync
uv run ruff format
uv run ruff check
uv run mypy
uv run pytest
```

CI runs the same with `uv sync --locked` and `ruff format --check`. Add dependencies with `uv add` (`uv add --dev` for tooling) and commit `uv.lock` together with `pyproject.toml`.

## Web

Serve `web/` and the tile archive locally, then open http://localhost:8000/:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory web
pmtiles serve tiles --interface=127.0.0.1 --port=8081 --cors=http://localhost:8000,http://127.0.0.1:8000 --public-url=http://localhost:8081
```

- `TILES` in `web/script.js` points at the local tile server.
- To regenerate the archive, run `pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles tiles/prague.pmtiles --bbox=14.0,49.8,14.95,50.35`.
- The style reads the Protomaps basemap layers `roads`, `water`, `buildings`, `landuse` and `places`, and tells features apart by `kind` and `kind_detail`.
  - `landcover` only exists at zoom levels 5–7, below the map's minimum zoom of 9, so the style doesn't use it.
  - Pedestrian streets and living streets are drawn as streets, not paths.
- Labels use the style's `font-faces` property with the JetBrains Mono files, so the style has no `glyphs` URL.
- The map data is © OpenStreetMap contributors. Keep the attribution visible.

## Local testing

Every change runs on a local version of the project before anything is deployed to the web. This holds for the whole project, including hosting and services added later.

- The local version runs entirely on this machine: the package through `uv run`, the map through the two servers under [Web](#web), and the release image through `docker build -t undercurrent:local .` and `docker run --rm undercurrent:local`. It reads only local data and never calls or writes to anything deployed.
- In a worktree, serve that worktree's `web/`. Run the tile server from the main checkout, since `tiles/` isn't committed.
- Settings committed to the repo point at the local version, like `TILES` in `web/script.js`. Production values never become the committed default.
- Anything new that gets deployed, such as a host, a server, a database or a secret, gets a local counterpart in the same change, and this file says how to start it.
- Passing checks aren't enough. Start the local version and try the change there before asking to push.

## Branches

- `main` is protected: no direct pushes, force-pushes or deletion. It accepts only pull requests that passed CI, merged with Rebase and merge.
- Changes reach `main` through a release branch, `release/<version>`. Only one is open at a time. List it with `git fetch origin && git branch -r --list 'origin/release/*'`. If none is open, cut one from `main` without checking it out: `git push origin origin/main:refs/heads/release/<version>`.
- The main checkout stays on the open release branch. Never commit on `main` or on the release branch, and never switch branches, edit or commit in the main checkout. It only fast-forwards, to test a release. Each piece of work gets its own worktree, on a branch named `<type>/<short-name>` cut from the release branch:

  ```sh
  git fetch origin
  git worktree add --no-track -b fix/short-name ../undercurrent-worktrees/short-name origin/release/<version>
  cd ../undercurrent-worktrees/short-name && uv sync
  ```

## Pull requests

Once a change is committed, the checks pass locally and the change works in the local version, ask before pushing. Then:

1. Run `git fetch origin`. If the release branch has moved, `git merge-base --is-ancestor origin/release/<version> HEAD` fails. In that case, rebase onto the release branch and run the checks again.
2. Push the branch, run `gh pr create --base release/<version>`, then `gh pr checks <number> --watch`.
3. Once every check has passed, run `gh pr merge <number> --rebase`.
   - Don't use `--auto` or `--delete-branch`. GitHub deletes the merged branch itself.
   - If a check fails, fix it, squash the fix into the commit it belongs to, `git push --force-with-lease`, and wait for the checks again.
4. From the main checkout, run `git worktree remove ../undercurrent-worktrees/short-name && git branch -D fix/short-name`.

Merge the release branch into `main` or tag a release only when asked.

## Releases

1. Open the last pull request into the release branch from `chore/release-<version>`. It bumps `version` in `pyproject.toml`, runs `uv lock`, and commits as `chore: release <version>`.
2. Bring the main checkout up to date with `git fetch origin && git merge --ff-only origin/release/<version>`, then test the whole release in the local version, image included. Fix anything broken through a pull request into the release branch, then repeat this step.
3. Open a pull request from `release/<version>` into `main` and merge it with `--rebase` after CI passes.
4. Run `git fetch origin && git tag v<version> origin/main && git push origin v<version>`, then delete the release branch.

The release workflow refuses a tag that isn't on `main` or that doesn't match the version in `pyproject.toml`. Only admins can create `v*` tags, and no one can move or delete them.

## Commits

- Use Conventional Commits: `<type>(<scope>): <description>`, in the imperative, lowercase, with no trailing period and a subject line under 72 characters.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`, `build`, `ci`, `revert`.
- Each commit is one finished change that passes the checks. Rebase merges keep every commit exactly as written.
- Stage explicit paths. Don't use `git add -A`.
- Commit messages, pull request titles and descriptions describe the change only. Add a body only when the subject line isn't enough.
- Don't add `Co-Authored-By`, `Generated with` or any other trailer.

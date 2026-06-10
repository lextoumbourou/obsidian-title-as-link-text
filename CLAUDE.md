# Title As Link Text — Obsidian plugin

Automatically rewrites link text (markdown links and wikilinks) to use note
titles instead of filenames. All plugin logic lives in `main.ts`:
`LinkUpdater` is the testable core; `TitleAsLinkTextPlugin` wires it to
Obsidian events with one debouncer per file path.

## Commands

- `npm test` — Jest test suite
- `npm run lint` — ESLint
- `npm run build` — typecheck (tsc) + production bundle to `main.js` (gitignored)

## Conventions

- Write a failing test before fixing a bug, where practical.
- No AI attribution in commit messages (no Co-Authored-By trailers).
- Title computation falls back: frontmatter title → first heading → filename.
  When a note has no explicit title (frontmatter/heading), custom link display
  text must be preserved, never replaced with the filename.
- Never write a note whose content is unchanged: a no-op write re-triggers the
  metadata `changed` event and causes a rewrite loop. Writes go through
  `vault.process` (atomic), never read-then-`vault.modify`.

## Tests

- `__tests__/test-utils.ts` provides `setupTest(files, metadata)` and its own
  `jest.mock('obsidian', ...)`, which overrides `__mocks__/obsidian.ts` for any
  test file importing it.
- `__mocks__/obsidian.ts` (used by tests that do NOT import test-utils, e.g.
  `plugin-debounce.test.ts`) has a real timer-based `debounce` — drive it with
  jest fake timers.
- A hand-rolled vault mock needs `read`, `modify`, AND `process` implemented;
  `updateLinksInNote` reads as a pre-check, then writes via `process`.

## Release process

Do NOT create GitHub releases manually — pushing a tag does everything:

1. Retitle the `[Unreleased]` section in `changelog.md` to the new version.
2. Bump `version` in `manifest.json` (the only place the version lives;
   `package.json` has no version field and `versions.json` does not exist).
3. Commit as two commits matching history: `Version X.Y.Z` (manifest), then
   `Update change log.`
4. `git push`, then `git tag X.Y.Z && git push origin X.Y.Z`.
5. `.github/workflows/release.yml` builds and publishes the release with
   `main.js`, `manifest.json`, and the plugin zip. If a release for the tag
   already exists it just replaces the assets.

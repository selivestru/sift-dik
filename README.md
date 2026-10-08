# SiftDIK — card game

The project uses [Vite+](https://viteplus.dev/guide/) 1.1.0 and a Bun workspace:

- `apps/web` — the React website with TanStack Router, Tailwind CSS, and React Compiler.
- `packages/game-engine` — the game engine and its tests.

## Setup

Install dependencies from the repository root. The Bun version is pinned in
`packageManager`, and the Node.js version is pinned in `.node-version`.
A single root `bun.lock` covers both packages.
TypeScript 7.0.2 is pinned in the root `catalog`; the root and all workspace
packages reference it through `"typescript": "catalog:"`.

```sh
vp install --frozen-lockfile
```

## Commands for each package

Run these commands from the repository root:

```sh
vp run dev:web                 # Start the website on port 3000
vp run build:web               # Type-check and build the website
vp run preview:web             # Preview the website production build
vp run test:web                # Run website tests (none configured yet)
vp run test:engine             # Run the engine tests
vp run build:engine            # Type-check and build the engine
```

The website currently has no test files. Its test command reports this and exits
with an error until tests are added.

`vpr dev:web` is shorthand for `vp run dev:web`. All scripts also work with Bun,
for example `bun run dev:web` or `bun run build:engine`.

## Workspace commands

```sh
vp run dev:web                 # Start web at http://localhost:3000
vp check                       # Check formatting, lint rules, and types
vp test run                    # Run all engine tests
vp run build                   # Type-check and build both packages
vp -C packages/game-engine pack # Build engine ESM and TypeScript declarations
```

You can also target a directory directly:

```sh
vp -C apps/web dev
vp -C apps/web preview
```

`vp dev`, `vp test`, `vp build`, and `vp pack` run built-in tools.
`vp run <task>` runs a `package.json` script. Use `vp run build` to include the
TypeScript checks before building. Shared lint and formatting settings live in
the root `vite.config.ts`; each package has its own application or engine config.

Without a global `vp` installation, use Bun and the local CLI:

```sh
bun install --frozen-lockfile
bun run dev:web
bun run check
bun run test
bun run build
```

## Git hooks

Installing dependencies runs `prepare` and installs the Vite+ hook dispatcher.
The hook scripts in `.vite-hooks/` are part of the repository; generated files
under `.vite-hooks/_/` are ignored. Node.js must meet the root `engines` range,
and Git 2.32.0 or newer is required for staged checks.

- **Before commit:** `vp staged` runs `vp check --fix` on staged files. It formats
  them, applies available lint fixes, and checks types for TypeScript files. Fixes
  are automatically staged. Remaining errors block the commit.
- **Before push:** `vp run check:push` checks formatting, lint, and types across
  the project, then runs all configured tests. It makes no automatic fixes.
  A failed check or test blocks the push. Production builds remain a separate task.

Use Git as usual:

```sh
git add <files>
git commit -m "feat: describe the change"
git push
```

After automatic fixes, review the staged diff. Fix any reported errors and retry
the commit or push; use `git add` again for edits you make yourself. When a file
is partially staged, the staged checks preserve its unstaged changes.

You can run the checks manually:

```sh
vp staged                     # Check and fix staged files
vp run check:push             # Run the same checks as pre-push
vp hooks status              # Show whether hooks are installed
vp hooks enable              # Install or restore hooks in this clone
```

Without a global CLI, use `bun run check:staged` and `bun run check:push`.
For troubleshooting, `vp hooks disable` disables hooks locally until you run
`vp hooks enable`. This preference survives dependency installation. To skip
hooks for one Git command, prefix it with `VP_GIT_HOOKS=0`.

## Using the engine

The engine builds to `packages/game-engine/dist/index.mjs` and `index.d.mts`.
The `@sift-dik/game-engine` package export points to these files, so build the package
before consuming it. To use it in an application, add
`"@sift-dik/game-engine": "workspace:*"` to that application's dependencies.

## Migration notes

The engine already used Vitest 5, so no Vitest 4
compatibility settings were needed. There was no previous tsdown configuration.

Declaration generation warns about the experimental TypeScript 7 API, which the
engine already used. The build and consumer type checks pass.

Tools that require the older TypeScript compiler API can use the official
`@typescript/typescript6` compatibility package alongside TypeScript 7. If a tool
imports `typescript` by name, its package may need `typescript` aliased to
`@typescript/typescript6`, with TypeScript 7 installed under a separate alias such
as `@typescript/native`. This keeps `tsc` on version 7 and provides the old API
and `tsc6` separately. See Microsoft's
[side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
Add this only for a tool that actually needs it.

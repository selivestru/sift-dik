# Repository Guidelines

## Project Context & Scope

`sift-dik` is a custom two-player card game intended to follow Legends of Runeterra (LoR) mechanics with its own cards, fighters, and factions. `packages/game-engine` contains the active vanilla engine rewrite. Use its current code and tests as the implementation reference; importing legacy behavior requires review.

The current milestone is a complete vanilla match: creation, mulligan, unit play and replacement, attacks, blocks, passes, round transitions, combat damage, and victory. Spells, keywords, triggered abilities, and an effect stack are future work. `reservedEnergy` already accumulates for future spell support, but currently cannot be spent. Full LoR feature parity is a goal, not a claim about the current engine.

The user values understandable, incremental implementation and explanations of interconnected actions. For guidance requests, explain without writing code; implement when requested. Keep changes focused on the requested milestone rather than introducing speculative systems. Verify ambiguous LoR rules against official Riot documentation before changing behavior.

## Project Structure & Module Organization

This package implements a vanilla, LoR-style card-game engine in TypeScript.

- `src/core/`: game creation, action dispatch, round transitions, and combat resolution. Individual action handlers live in `src/core/actions/`.
- `src/types/`: card, action, event, and game-state contracts.
- `src/schemas/`: Zod validation for game creation and incoming actions.
- `src/constants/`: game limits and card definitions.
- `src/utils/`: seeded randomness, shuffling, and player lookup.
- `src/tests/`: action tests and complete-match integration tests.
- `src/index.ts`: public package exports.

## Build, Test, and Development Commands

Install dependencies from the repository root with `vp install` (or `bun install` without the global CLI). The project uses a Bun workspace and a single root lockfile. Run package commands from `packages/game-engine`:

- `bun run test`: run the complete Vitest suite.
- `bun run typecheck`: check TypeScript without emitting files.
- `bun run check`: run Vite+ formatting, lint, and type checks.
- `bun run lint`: lint source through Vite+ / Oxlint.
- `bun run format`: format source through Vite+ / Oxfmt.
- `bun run build`: check types and build ESM with declarations through `vp pack`.

The package has no development server; use tests for local development. Its package export resolves to `dist/index.mjs` and `dist/index.d.mts`, so build it before consuming it.

## Coding Style & Naming Conventions

Use TypeScript ES modules, two-space indentation, single quotes, no semicolons, trailing commas, and a 100-column print width. Follow the root `vite.config.ts` for shared lint and format settings.

Use kebab-case filenames (`pass-action.ts`), camelCase functions and variables, PascalCase interfaces, and uppercase constants. Use `import type` for type-only dependencies. The `~/` alias resolves to `src/`.

## Engine API & State Ownership

The public entry points are `createGame(players, { seed })` and `applyAction(state, action)`, exported through `src/index.ts`. `applyAction` validates the action with Zod, clones the supplied state, and returns `{ state, events }`; handlers modify that clone. Invalid actions throw without modifying the caller's state. Call handlers through `applyAction` at integration boundaries.

Separate card definition `id` from runtime `instanceId`: multiple copies may share a definition ID. Actions, combat slots, and events identify individual cards by instance ID. Units remain on their owner's `board` during combat; slots hold references, not separate card copies.

Use `rngState` and seeded RNG helpers for gameplay randomness. A supplied seed and action history must reproduce the same states and events. `createGame` may generate a seed when none is supplied; action logic must not introduce independent randomness. Resolve external player IDs through `getPlayer`, which uses `Object.hasOwn` to reject inherited properties such as an unregistered `toString`.

## Match Lifecycle & Invariants

- Exactly two players have distinct IDs, decks of 40 unit cards, and initial `reputation` of 20 (the Nexus-health equivalent).
- Creation starts at round 0 in `mulligan`, with four cards per hand and zero energy. Each player confirms once, keeping or replacing up to four unique hand instances. Draw replacements before returning rejected cards to the shuffled deck, so rejected instances cannot be immediate replacements. Confirmation does not require ordinary turn priority.
- Once both confirm, round 1 starts: each player gets one normal energy and draws one card, bringing the opening hand to five. Later rounds increase `maxEnergy` by one up to 10 and refill `energy`. Bank the previous round's unused normal energy into the existing `reservedEnergy` before refilling, capped at three; do not bank during the first round.
- `initiativePlayerId` owns the round's attack token; `turnPlayerId` is the player allowed to act now. Initial initiative is random and alternates each round independently of the last actor. Spending the token requires declaring an attack. Playing a unit passes priority but does not consume the token; newly played units can attack that round.
- Hands hold at most 10 cards and boards at most six units. A full-hand draw obliterates the drawn card. On a full board, unit play requires an explicit `replaceInstanceId`: the old unit is obliterated and the new one is appended. Unit play spends only normal energy.
- Damaged units retain their remaining health across rounds. Dead units enter `graveyard`; obliterated cards do not.
- Lethal reputation damage ends the match. A required round-start draw from an empty deck loses the match; both decks empty means a draw (`winnerPlayerId: null`). Drawing the last available card is legal. Finished matches reject further actions.

## Priority, Passes & Combat

Match `phase` is `mulligan`, `playing`, or `finished`. Combat is optional state with its own explicit `stage`; slot contents alone cannot represent whether blocks have been confirmed.

| Situation           | Expected action and result                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No active combat    | First pass transfers priority; the second consecutive pass ends the round. Unit play and attack declaration reset the pass count.                                                                                  |
| `awaiting_blocks`   | The defender declares unique attacker/blocker pairs. A defender pass means empty blocks. Empty blocks resolve combat immediately; nonempty blocks switch to `awaiting_response` and give priority to the attacker. |
| `awaiting_response` | The attacker passes to resolve the confirmed combat. This pass does not end the round.                                                                                                                             |

`declareAttacksAction` consumes the attack token, preserves attacker order in slots, and gives priority to the defender. Unit play and another attack are forbidden during active combat. `resolveCombat` processes slots in order: blocked units exchange damage simultaneously; unblocked attackers damage reputation. Dead units are removed after each exchange, and processing stops on lethal reputation damage. A missing assigned blocker does not turn the attack into an unblocked hit.

After combat, clear `combat`, reset consecutive passes, and give priority to the defender. `passAction` routes by combat stage; preserve this distinction when adding spells and response windows.

## Events, UI & Backend Integration

Events describe ordered transitions for UI animations; returned state is the authoritative final result. Preserve payloads, instance IDs, and event order:

- `MULLIGAN_COMPLETED` pairs replaced and received instances in hand order.
- Normal round transitions emit `ROUND_ENDED`, reserve changes when applicable, `ROUND_STARTED`, then per-player energy and draw events.
- Replacement emits `ENERGY_CHANGED`, `UNIT_OBLITERATED`, then `UNIT_PLAYED`. Ordinary play does not emit obliteration.
- `COMBAT_DAMAGE_RESOLVED` describes one processed slot and its positive-damage strikes; zero-attack slots can have an empty `strikes` array. `UNIT_DIED` follows the damage event. `COMBAT_RESOLVED` marks overall completion; lethal combat then emits `GAME_OVER`.
- `UNIT_OBLITERATED` removes a board unit without death; `CARD_OBLITERATED` currently covers a burned draw.

Consumers can use the previous state to animate removed cards and the returned state to resolve newly played cards. Tests verify this data contract; they do not verify browser animations.

Networking and persistence belong to consuming applications. The planned backend authenticates the actor, applies actions to stored authoritative state, persists the result, and sends suitable updates to clients, potentially through sockets. Raw `GameState` contains both players' hidden hands and decks; design visibility projections before sending it to opponents. Keep transport and animation code outside the engine.

## Testing Guidelines

Name tests `src/tests/<feature>.test.ts` and import Vitest APIs from `vite-plus/test`. Run one file with `bun run test -- src/tests/pass-action.test.ts`.

Cover valid actions, rejected inputs, state immutability, event payloads and ordering, and relevant limits. Update `full-match.test.ts` when changing interactions between combat, passes, rounds, and victory. It covers seeded multi-round matches through lethal damage and deck exhaustion, replay determinism, and conservation of card instances across zones and obliteration. No numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

Use English Conventional Commits.

PR descriptions should explain the problem, resulting behavior, affected contracts, and validation commands. Link relevant issues and identify event or state compatibility changes.

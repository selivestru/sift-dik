# AGENTS.md — SiftDIK Project Context & Architecture Guide

Welcome, Agent. This document contains all essential domain knowledge, architecture decisions, and current progress for the **SiftDIK** project. Read this thoroughly before suggesting or reviewing changes.

---

## 1. Project Overview & Philosophy

**SiftDIK** is a competitive digital collectible card game (CCG).
- **Mechanical Inspiration:** *Legends of Runeterra* (LoR) priority system, alternating attack token, two-player active turns, left-to-right combat resolution, and spell mana banking.
- **Theme & Lore:** The visual novel *Being A DIK*. Characters represent people from the college campus and surrounding town, with events reflecting college drama, frat wars, pranks, and relationships.
- **Architectural Principle:** The core game rules live in an isolated, pure, zero-dependency package (`packages/game-engine`). Network (NestJS) and UI (React) layers are strictly decoupled consumers of this engine.
- **User Collaboration Style:** The user wants to learn and write the code themselves. **Do not write all code for them unsolicited.** Guide them, provide code hints/snippets, review their changes for edge cases, point out bugs, and explain architectural principles.

---

## 2. Domain & Lore Mapping

| LoR Concept | SiftDIK Equivalent | Mechanics |
| :--- | :--- | :--- |
| **Nexus HP** (20) | **Reputation** (20) | Player life total. Reaching 0 means social defeat (loss). |
| **Mana** (1..10) | **Energy** (1..10) | Starts at 1, increases by 1 each round up to 10. Refills every round. |
| **Spell Mana** (up to 3) | **Reserved Energy** (0..3) | Up to 3 unspent normal Energy rolls over into Reserved Energy at the end of each round. |
| **Attack Token** | **Initiative** (`hasAttackToken`) | Alternates each round. Grants the right to declare attacks. Consumed on attack declaration. |
| **Regions** | **Factions** | `dik` (The ΔIKs), `aaa` (Tri-Alphas / Jocks), `hot` (The HOTs), `bbb` (Tri-Betas / Nerds), plus Free/Unaligned cards. |
| **Spells** | **Spells / Events** | Speeds: `burst` (instant, no priority pass), `fast` (stacks, can be reacted to), `slow` (actions, pass priority). |
| **Units** | **Characters / Units** | Named characters from the universe (e.g. Main Character, Derek, Jacob, Sage, Josy, Maya). |

---

## 3. Technology Stack & Workspace Structure

- **Monorepo:**
  - `packages/game-engine`: Pure TypeScript deterministic state machine.
    - Package manager: **Bun**
    - Test runner: **Vitest**
    - Linter / Formatter: `oxlint` / `oxfmt`
  - *(Future)* `apps/server`: NestJS backend (rooms, matchmaking, WebSocket transport, AI bots).
  - *(Future)* `apps/web`: React frontend (PixiJS/HTML5 board, event-driven animations).

---

## 4. Game Engine Architecture (`packages/game-engine`)

### Core Principles
1. **Purity & Immutability:** `applyAction(state, action)` does not mutate the input state. It creates a deep clone (`structuredClone(state)`), applies mutations, and returns `{ state: nextState, events: GameEvent[] }`.
2. **Determinism:** No `Math.random()` or `Date.now()` inside game logic. Initial game state uses a seeded PRNG (`createRng` - Mulberry32 algorithm) so games can be perfectly replayed.
3. **Definition vs Instance:**
   - `CardDefinition`: Static catalogue card template (`id`, `name`, `baseCost`, `baseHealth`, `baseAttack`, etc.).
   - `CardInstance`: Live card in a match (`instanceId`: `${playerId}-card-${index}`, `ownerId`, dynamic `cost`, `health`, `attack`).
4. **Zone Transitions:**
   - Bench (`player.board`, max 6 units) $\rightarrow$ Battlefield (`combat.slots`) $\rightarrow$ Bench (if survived) OR Graveyard (`player.graveyard` if health $\le$ 0).
   - Card draw: Deck (`player.deck`) $\rightarrow$ Hand (`player.hand`, max 10 cards). If hand is full, drawn card goes to graveyard. If deck is empty on draw, player immediately loses (`GAME_OVER`).

---

## 5. Implementation Status: Layer 0 (COMPLETED)

Layer 0 represents vanilla card game physics (stats without triggered card abilities or keywords).

### Types (`src/types/`)
- `card.types.ts`: `BaseCard`, `UnitCard`, `SpellCard`, `UnitCardInstance`, `SpellCardInstance`, `CardDefinition`, `CardInstance`.
- `game-state.types.ts`: `PlayerState`, `CombatSlot`, `CombatState`, `GameState`.
- `action.types.ts`: `PlayUnitAction`, `DeclareAttacksAction`, `DeclareBlocksAction`, `PassAction`, `GameAction`.
- `event.types.ts`: `ENERGY_CHANGED`, `CARD_DRAWN`, `UNIT_SPAWNED`, `DAMAGE_DEALT`, `UNIT_DIED`, `ROUND_STARTED`, `ROUND_ENDED`, `GAME_OVER`.
- `common.types.ts`: `RandomFn`.

### Core Logic (`src/core/`)
- `create-game.ts`: Deterministic game initialization with seeded PRNG, deck shuffling, 4-card starting hand, initial 1 energy, random first-turn attack token assignment.
- `apply-action.ts`: Action dispatcher returning `{ state, events }`.
- `actions/play-unit-action.ts`: Validates energy, board cap (6), turn, card type, removes card from hand, spawns on board, passes priority to opponent, resets `consecutivePasses`.
- `actions/declare-attacks-action.ts`: Validates attack token, attackers on board, moves attackers from `board` to `combat.slots`, consumes attack token, passes priority to defender.
- `actions/declare-blocks-action.ts`: Validates defender board units, one-to-one blocking assignments, resolves combat left-to-right (two-way unit damage & unblocked reputation damage), returns survivors to board, discards dead to graveyard, passes priority back to defender.
- `actions/pass-action.ts`: Alternates turns. When `consecutivePasses === 2`:
  - Increments round number.
  - Alternates initiative player and hands them `hasAttackToken = true`.
  - Converts leftover energy to reserved energy (capped at 3).
  - Increments max energy (capped at 10) and refills current energy.
  - Draws 1 card per player (empty deck triggers loss).
  - Resets `consecutivePasses = 0`.

### Tests (`src/tests/game-loop.test.ts`)
- All 4 comprehensive Vitest tests pass cleanly covering the entire Layer 0 loop.

---

## 6. Next Milestones (Roadmap)

### Layer 1: Keywords & Abilities
- **Combat Keywords:**
  - `Overwhelm` (excess attack damage dealt to defender unit carries over to player Reputation).
  - `Tough` (reduces all incoming damage by 1).
  - `Quick Attack` (attacker strikes before blocker; blocker strikes back only if it survives).
  - `Challenger` (attacker can pull a specific enemy unit into blocking them).
- **Triggered Abilities:**
  - Event listener / trigger hooks: `ON_PLAY`, `ON_ATTACK`, `ON_DAMAGE_TAKEN`, `ON_DEATH`, `ON_ROUND_START`.
  - Example card: MC (`ON_ATTACK`: grant another attacking ally +1/+0).
- **Spell System & Fast/Slow Stack:**
  - `BURST`: Instant effect, does not pass priority.
  - `FAST` / `SLOW`: Placed onto the spell stack; can be chained with opponent responses before resolution.

### Layer 2: Card Catalogue & Deck Building
- Card database with characters from *Being A DIK*.
- Deck rules validation: 40 cards, max 2 factions, max 3 copies of any card.

### Layer 3: Server & Networking (NestJS)
- Game rooms, WebSocket gateways, action validation, state sync, random/heuristic bot.

### Layer 4: Client (React)
- Interactive board rendering, drag-and-drop actions, event-based animations.

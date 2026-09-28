# AGENTS.md — SiftDIK Project Context & Architecture Guide

Welcome, Agent. This document contains all essential domain knowledge, architecture decisions, and current progress for the **SiftDIK** project. Read this thoroughly before suggesting or reviewing changes.

---

## 1. Project Overview & Philosophy

**SiftDIK** is a competitive digital collectible card game (CCG).
- **Mechanical Inspiration:** *Legends of Runeterra* (LoR) priority system, alternating attack token, two-player active turns, left-to-right combat resolution, spell mana banking, and LIFO spell stack.
- **Theme & Lore:** The visual novel *Being A DIK*. Characters represent people from the college campus and surrounding town, with events reflecting college drama, frat wars, pranks, and relationships.
- **Architectural Principle:** The core game rules live in an isolated, pure, zero-dependency package (`packages/game-engine`). Network (NestJS) and UI (React) layers are strictly decoupled consumers of this engine.
- **User Collaboration Style:** The user wants to learn and write the code themselves. **Do not write all code for them unsolicited.** Guide them, provide code hints/snippets, review their changes for edge cases, point out bugs, and explain architectural principles. Always maintain 1 keyword / feature = 1 test file.

---

## 2. Domain & Lore Mapping

| LoR Concept | SiftDIK Equivalent | Mechanics |
| :--- | :--- | :--- |
| **Nexus HP** (20) | **Reputation** (20) | Player life total. Reaching 0 means social defeat (loss). Max 20 (`MAX_REPUTATION`). |
| **Mana** (1..10) | **Energy** (1..10) | Starts at 1, increases by 1 each round up to 10. Refills every round. |
| **Spell Mana** (up to 3) | **Reserved Energy** (0..3) | Up to 3 unspent normal Energy rolls over into Reserved Energy at the end of each round. Spells spend Reserved Energy first. |
| **Attack Token** | **Initiative** (`hasAttackToken`) | Alternates each round. Grants the right to declare attacks. Consumed on attack declaration. |
| **Regions** | **Factions** | `dik` (The ΔIKs), `aaa` (Tri-Alphas / Jocks), `hot` (The HOTs), `bbb` (Tri-Betas / Nerds), plus Free/Unaligned cards. |
| **Spells** | **Spells / Events** | Speeds: `burst` (instant, no priority pass), `fast` (stacks, can be reacted to), `slow` (actions, cannot be played in combat). |
| **Units** | **Characters / Units** | Named characters from the universe (e.g. Tremolo, Derek, Jacob, Sage, Josy, Maya). |

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
4. **Stats Model:**
   - Units track `baseAttack`, `attack`, `tempAttack` (round-scoped buffs).
   - Units track `baseHealth`, `maxHealth`, `health`, `tempHealth` (round-scoped buffs).
   - Units track `keywords` and `tempKeywords` (round-scoped keywords granted by spells/effects).
5. **Zone Transitions:**
   - Bench (`player.board`, max 6 units) $\rightarrow$ Battlefield (`combat.slots`) $\rightarrow$ Bench (if survived) OR Graveyard (`player.graveyard` if health $\le$ 0).
   - Spell Cast: Hand (`player.hand`) $\rightarrow$ Spell Stack (`state.spellStack`) $\rightarrow$ Graveyard (`player.graveyard`) upon resolution.
   - Card draw: Deck (`player.deck`) $\rightarrow$ Hand (`player.hand`, max 10 cards). If hand is full, drawn card goes to graveyard. If deck is empty on draw, player loses (`GAME_OVER`).

---

## 5. Implementation Status

### Layer 0: Core Game Loop (COMPLETED)
- **State Initialization:** `src/core/create-game.ts` (deterministic shuffle, mulligan/initial 4-card hand, initial initiative coin-flip).
- **Core Actions:**
  - `PLAY_UNIT`: validates energy, board cap (6), turn, card type, spawns on board, passes priority.
  - `DECLARE_ATTACKS`: validates attack token and board units, moves attackers to `combat.slots`, consumes attack token, passes priority to defender.
  - `DECLARE_BLOCKS`: 1-to-1 blocker assignments, calculates strikes and returns survivors to board, discards dead to graveyard.
  - `PASS`: alternates turns. If `consecutivePasses === 2`: increments round, alternates initiative and attack token, rolls unspent energy into reserved energy (cap 3), refills energy, draws 1 card, resets consecutive passes, resets temporary stats (`tempAttack`, `tempHealth`, `tempKeywords`).

### Layer 1: Combat Keywords & Mechanics (COMPLETED)
All 9 core combat keywords are implemented with dedicated isolated test suites (1 test file per keyword):
1. **`quick_attack` (`src/tests/quick-attack.test.ts`):** Striking first when attacking. Eliminates blocker without taking retaliation damage if blocker dies.
2. **`double_attack` (`src/tests/double-attack.test.ts`):** Striking twice (first strike, then simultaneous strike). Hits twice in face if unblocked.
3. **`lifesteal` (`src/tests/lifesteal.test.ts`):** Restores allied player Reputation by amount of damage dealt in attack and defense (capped at `MAX_REPUTATION = 20`).
4. **`regeneration` (`src/tests/regeneration.test.ts`):** Fully heals damaged unit to `maxHealth` at round end on `player.board`.
5. **`tough` (`src/tests/tough.test.ts`):** Reduces all incoming damage to unit by 1 (minimum 0).
6. **`overwhelm` (`src/tests/overwhelm.test.ts`):** Excess attack damage above blocker lethal threshold (accounting for Tough) carries over to defender player's Reputation.
7. **`cannot_attack` (`src/tests/cannot-attack.test.ts`):** Unit is rejected from being declared in `DECLARE_ATTACKS`.
8. **`cannot_block` (`src/tests/cannot-block.test.ts`):** Unit is rejected from being declared in `DECLARE_BLOCKS`.
9. **`impulse` (`src/tests/impulse.test.ts`):** Grants +1 Reserved Energy (cap 3) upon summon (`PLAY_UNIT`).

### Layer 1: Spells & Spell Stack System (COMPLETED)
- **Action:** `PLAY_SPELL` (`src/core/actions/play-spell-action.ts`):
  - Validates turn, hand presence, card type, target presence, and energy.
  - **Spell Mana Banking:** Spends `reservedEnergy` first, then spills over into base `energy`.
  - Places `fast` and `slow` spells into `state.spellStack`.
- **LIFO Stack Resolution:** `src/core/spells/resolve-spell-stack.ts`:
  - When opponent passes on a non-empty spell stack, spells resolve from newest to oldest (`.pop()`).
  - Resolved spells move to owner's `graveyard`.
- **Pass Action Integration:** `src/core/actions/pass-action.ts` prioritizes resolving `spellStack` before round turnover and allows passing during combat if spells are on the stack.

### Layer 1: Triggered Abilities & Card Registry (COMPLETED)
- **Abilities Architecture:**
  - `src/types/abilities.types.ts`: Trigger types (`ON_SUMMON`, `ON_ATTACK`, `ON_REPUTATION_STRIKE`, `ON_KILL`, `ON_DEATH`, `ON_ROUND_START`, `ON_ROUND_END`) and handler signatures.
  - `src/core/abilities/trigger-abilities.ts`: Universal ability dispatcher.
  - `src/core/abilities/registry.ts`: Ability implementation registry.
  - `src/core/spells/registry.ts`: Spell implementation registry.
- **Implemented Cards:**
  - **Tremolo (`src/catalog/characters/tremolo.ts`):**
    - Quick Attack.
    - *Support (`TREMOLO_SUPPORT`):* Grants the attacking ally to his right (`slots[index + 1]`) +1|+1 for the round (`tempAttack`, `tempHealth`).
    - *Reputation Strike (`TREMOLO_REPUTATION_STRIKE`):* Restores 1 Reserved Energy when striking enemy Reputation.
    - *Test:* `src/tests/tremolo.test.ts`.
  - **Preemptive Strike (`src/catalog/spells/preemptive-strike.ts`):**
    - Fast spell, Cost 3.
    - Grants target ally +0|+2 and temporary `quick_attack` until round end.
    - *Test:* `src/tests/preemptive-strike.test.ts`.

---

## 6. Directory Map (`packages/game-engine`)

```text
src/
├── catalog/                     # Card templates & definitions
│   ├── characters/              # Character unit cards (e.g. tremolo.ts)
│   └── spells/                  # Spell cards (e.g. preemptive-strike.ts)
├── constants/
│   └── game.ts                  # Game limits (MAX_REPUTATION=20, INIT_ENERGY=1, etc.)
├── core/
│   ├── abilities/
│   │   ├── registry.ts          # Triggered abilities implementation map
│   │   └── trigger-abilities.ts # Ability dispatcher
│   ├── spells/
│   │   ├── registry.ts          # Spell effects implementation map
│   │   └── resolve-spell-stack.ts # LIFO stack resolution
│   ├── actions/
│   │   ├── declare-attacks-action.ts
│   │   ├── declare-blocks-action.ts
│   │   ├── pass-action.ts
│   │   ├── play-spell-action.ts
│   │   └── play-unit-action.ts
│   ├── apply-action.ts          # Central action dispatcher
│   └── create-game.ts           # Deterministic game initialization
├── tests/                       # Vitest suites (1 test file per mechanic)
│   ├── cannot-attack.test.ts
│   ├── cannot-block.test.ts
│   ├── double-attack.test.ts
│   ├── game-loop.test.ts
│   ├── impulse.test.ts
│   ├── lifesteal.test.ts
│   ├── overwhelm.test.ts
│   ├── preemptive-strike.test.ts
│   ├── quick-attack.test.ts
│   ├── regeneration.test.ts
│   ├── tough.test.ts
│   └── tremolo.test.ts
├── types/                       # TypeScript interfaces & discriminated unions
└── utils/                       # Deterministic PRNG, shuffle, next player helpers
```

---

## 7. Next Milestones (Roadmap)

### Current Objective: Layer 1 Expansion (Vertical Slice Cards)
1. Implement remaining prototype characters & associated spells (from user notes).
2. Burst spell speed handling (instant execution without stack).
3. Challenger keyword (forcing blockers).
4. Direct damage & kill spells (e.g. removal spells).

### Layer 2: Card Catalogue & Deck Rules
- Complete 20-30 card starter set.
- Deck validator (40 cards, max 2 factions, max 3 copies per card).

### Layer 3: Server & Networking (NestJS)
- WebSocket gateway, match rooms, action forwarding, reconnections.

### Layer 4: Client (React + PixiJS/HTML5)
- Board state rendering, card frame overlays, drag-and-drop actions, event animation queue.

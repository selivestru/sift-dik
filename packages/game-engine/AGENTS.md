# AGENTS.md — SiftDIK Game Engine Context & Architecture Guide

Welcome, Agent. This document contains all essential domain knowledge, architecture decisions, and current progress for the **`packages/game-engine`** package. Read this thoroughly before suggesting or reviewing changes.

---

## 1. Project Overview & Philosophy

**SiftDIK** is a competitive digital collectible card game (CCG).

- **Mechanical Inspiration:** _Legends of Runeterra_ (LoR) priority system, alternating attack token, two-player active turns, left-to-right combat resolution, spell mana banking, and LIFO spell stack.
- **Theme & Lore:** The visual novel _Being A DIK_. Characters represent people from the college campus and surrounding town, with events reflecting college drama, frat wars, pranks, and relationships.
- **Architectural Principle:** The core game rules live in an isolated, pure, zero-dependency package (`packages/game-engine`). Network (NestJS) and UI (React) layers are strictly decoupled consumers of this engine.
- **Code Style & Quality:**
  - **No non-test comments:** Source code files (`src/core/`, `src/types/`, `src/catalog/`, `src/utils/`, `src/constants/`) must NOT contain inline or block comments. The code must be self-documenting through clean naming, decomposition, and single-responsibility functions. Comments are allowed only in test files (`src/tests/`).
  - **Testing Rule:** Maintain strictly **1 keyword / mechanic = 1 isolated test file**.
  - **User Collaboration Style:** The user wants to learn and write the code themselves. **Do not write all code for them unsolicited.** Guide them, provide code hints/snippets, review their changes for edge cases, point out bugs, and explain architectural principles.

---

## 2. Domain & Lore Mapping

| LoR Concept              | SiftDIK Equivalent                | Mechanics                                                                                                                      |
| :----------------------- | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **Nexus HP** (20)        | **Reputation** (20)               | Player life total. Reaching 0 means social defeat (loss). Max 20 (`MAX_REPUTATION`).                                           |
| **Mana** (1..10)         | **Energy** (1..10)                | Starts at 1, increases by 1 each round up to 10. Refills every round.                                                          |
| **Spell Mana** (up to 3) | **Reserved Energy** (0..3)        | Up to 3 unspent normal Energy rolls over into Reserved Energy at the end of each round. Spells spend Reserved Energy first.    |
| **Attack Token**         | **Initiative** (`hasAttackToken`) | Alternates each round. Grants the right to declare attacks. Consumed on attack declaration.                                    |
| **Regions**              | **Factions**                      | `dik` (The DIKs), `aaa` (Tri-Alphas / Jocks), `hot` (The HOTs), `bbb` (Tri-Betas / Nerds), plus Free/Unaligned cards.          |
| **Spells**               | **Spells / Events**               | Speeds: `burst` (instant, no priority pass), `fast` (stacks, can be reacted to), `slow` (actions, cannot be played in combat). |
| **Units**                | **Characters / Units**            | Named characters from the universe (e.g. Tremolo, Derek, Jacob, Sage, Josy, Maya).                                             |

---

## 3. Technology Stack & Workspace Structure

- **Monorepo:**
  - `packages/game-engine`: Pure TypeScript deterministic state machine.
    - Package manager: **Bun**
    - Test runner: **Vitest**
    - Linter / Formatter: `oxlint` / `oxfmt`
    - Validation: **Zod** (ability payload schemas)
  - _(Future)_ `apps/server`: NestJS backend (rooms, matchmaking, WebSocket transport, AI bots).
  - _(Future)_ `apps/web`: React frontend (PixiJS/HTML5 board, event-driven animations).

---

## 4. Game Engine Architecture (`packages/game-engine`)

### Core Principles

1. **Purity & Immutability:** `applyAction(state, action)` does not mutate the input state. It creates a deep clone (`structuredClone(state)`), applies mutations, and returns `{ state: nextState, events: GameEvent[] }`.
2. **Determinism:** No `Math.random()` or `Date.now()` inside game logic. Initial game state uses a seeded PRNG (`createRng` - Mulberry32 algorithm) so games can be perfectly replayed.
3. **Definition vs Instance:**
   - `CardDefinition`: Static catalogue card template (`id`, `name`, `baseCost`, `baseHealth`, `baseAttack`, etc.).
   - `CardInstance`: Live card in a match (`instanceId`: `${playerId}-card-${index}`, `ownerId`, dynamic `cost`, `health`, `attack`).
4. **Stats & Modifiers Model:**
   - Units track `baseAttack`, `attack`, `tempAttack` (round-scoped attack buffs).
   - Units track `baseHealth`, `maxHealth`, `health`, `tempHealth` (round-scoped health buffs).
   - Units and Spells track universal `keywords?: Keyword[]` and `tempKeywords?: Keyword[]` (round-scoped keywords granted by spells/effects).
5. **Zone Transitions:**
   - Bench (`player.board`, max 6 units) $\rightarrow$ Battlefield (`combat.slots`) $\rightarrow$ Bench (if survived) OR Graveyard (`player.graveyard` if health $\le$ 0 or ephemeral).
   - Spell Cast: Hand (`player.hand`) $\rightarrow$ Spell Stack (`state.spellStack`) $\rightarrow$ Graveyard (`player.graveyard`) upon resolution.
   - Card draw: Deck (`player.deck`) $\rightarrow$ Hand (`player.hand`, max 10 cards). If hand is full, drawn card goes to graveyard. If deck is empty on draw, player loses (`GAME_OVER`).
   - Fleeting Discard: Hand (`player.hand`) $\rightarrow$ Graveyard (`player.graveyard`) at round end.

---

## 5. Implementation Status

### Layer 0: Core Game Loop (COMPLETED)

- **State Initialization:** `src/core/create-game.ts` (deterministic shuffle, mulligan/initial 4-card hand, initial initiative coin-flip, empty `spellStack`).
- **Decomposed Actions:**
  - `PLAY_UNIT`: validates energy, board cap (6), turn, card type; spends energy; deploys unit to board; triggers Impulse if applicable; passes priority.
  - `DECLARE_ATTACKS`: validates attack token, attackers on board, `cannot_attack` keyword; moves attackers to `combat.slots`; triggers attack/support abilities; passes priority to defender.
  - `DECLARE_BLOCKS` (LoR combat sequence): validates defender turn, `blocksDeclared === false`, `cannot_block`/`stunned` keywords, elusive and pressure restrictions (requires $\ge 3$ attack); assigns 1-to-1 blockers into `combat.slots`, sets `combat.blocksDeclared = true`, and passes priority to the **attacker** (reaction window). Does NOT resolve strikes.
  - **Combat strike resolution** (`src/core/combat/resolve-combat.ts`): strikes resolve only when the spell stack is empty AND both players pass consecutively during active combat. Resolves slots left-to-right with double attack, quick attack, standard strikes, lifesteal, overwhelm, ram, fury, invulnerable, barrier, and ephemeral mechanics. After resolution combat closes and priority returns to the attacker. This enables LoR reaction windows: fast spells can be cast after blocks are declared and apply before strikes (e.g. Preemptive Strike on a blocked attacker, stunning a blocker so the attacker strikes Reputation).
  - `PASS`: if spells are on the stack, resolves the stack (LIFO) first. If combat is active with an empty stack: two consecutive passes resolve strikes instead of ending the round; `consecutivePasses` resets after combat, so combat passes never advance the round. Outside combat, `consecutivePasses === 2`: increments round, alternates initiative and attack token, rolls unspent energy into reserved energy (cap 3), refills energy, draws 1 card, discards fleeting cards, purges unspent ephemeral units, resets temporary stats (`tempAttack`, `tempHealth`, `tempKeywords`, `barrier`).

### Layer 1: Combat Keywords & Mechanics (20 KEYWORDS COMPLETED)

All 17 combat keywords are implemented with dedicated isolated test suites (1 test file per keyword):

1. **`quick_attack` (`src/tests/quick-attack.test.ts`):** Striking first when attacking. Eliminates blocker without taking retaliation damage if blocker dies.
2. **`double_attack` (`src/tests/double-attack.test.ts`):** Striking twice (first strike, then simultaneous strike). Hits twice in face if unblocked.
3. **`lifesteal` (`src/tests/lifesteal.test.ts`):** Restores allied player Reputation by amount of damage dealt in attack and defense (capped at `MAX_REPUTATION = 20`).
4. **`regeneration` (`src/tests/regeneration.test.ts`):** Fully heals damaged unit to `maxHealth` at round end on `player.board`.
5. **`tough` (`src/tests/tough.test.ts`):** Reduces all incoming damage to unit by 1 (minimum 0).
6. **`overwhelm` / Пробивание (`src/tests/overwhelm.test.ts`):** Excess attack damage above blocker lethal threshold (accounting for Tough) carries over to defender player's Reputation.
7. **`cannot_attack` (`src/tests/cannot-attack.test.ts`):** Unit is rejected from being declared in `DECLARE_ATTACKS`.
8. **`cannot_block` (`src/tests/cannot-block.test.ts`):** Unit is rejected from being declared in `DECLARE_BLOCKS`.
9. **`impulse` (`src/tests/impulse.test.ts`):** Grants +1 Reserved Energy (cap 3) upon summon (`PLAY_UNIT`).
10. **`elusive` (`src/tests/elusive.test.ts`):** Attacking elusive unit can only be blocked by another elusive unit.
11. **`fury` (`src/tests/fury.test.ts`):** Surviving unit permanently gains +1|+1 upon killing an opposing combatant in attack or defense.
12. **`ram` (`src/tests/ram.test.ts`):** Attacking unit deals 1 bonus damage to enemy Reputation upon striking (both when blocked and unblocked).
13. **`fleeting` (`src/tests/fleeting.test.ts`):** Fleeting cards in hand are discarded to graveyard at round end with `CARD_DISCARDED` event.
14. **`ephemeral` (`src/tests/ephemeral.test.ts`):** Ephemeral units die immediately after striking in combat, or at round end if left on bench.
15. **`invulnerable` (`src/tests/invulnerable.test.ts`):** Unit is immune to all combat damage (takes 0 damage).
16. **`pressure` (`src/tests/pressure.test.ts`):** Unit with pressure can only be blocked by enemies with 3 or more attack.
17. **`barrier` (`src/tests/barrier.test.ts`):** Negates the next incoming damage > 0 and is consumed. Unconsumed barriers expire at round end.
18. **`stunned` (`src/tests/stun.test.ts`):** Stunned unit cannot be declared as attacker or blocker this round; a unit stunned while attacking is removed from combat and returns to its owner's board. Expires at round end via `tempKeywords`. Stunned units cannot be forced to block via `challenger`/`vulnerable` (hard restriction, as in LoR).
19. **`challenger` (`src/tests/challenger.test.ts`):** When attacking, the owner MAY pass `forcedBlockers` in `DECLARE_ATTACKS` to force an enemy to block this unit. The forced unit must be a valid blocker (no `stunned`/`cannot_block`, elusive pairing, pressure 3+ attack). The forced blocker is assigned into the combat slot at attack declaration and cannot be re-blocked by the defender.
20. **`vulnerable` (`src/tests/vulnerable.test.ts`):** ANY attacking unit (without `challenger`) can force this unit to block it via `forcedBlockers`. Forcing a vulnerable unit ignores `cannot_block`, elusive and pressure; being `stunned` still prevents forcing (see keyword 18).

### Layer 1: Spells & Spell Stack System (COMPLETED)

- **Targeting convention:** spell targets are passed positionally in `PlaySpellAction.targets?: string[]` and mirrored on `StackSpell`; the action validates that every entry exists on a board or in combat, and each spell's handler defines the meaning of each position (e.g. Brother's Shoulder: `targets[0]` = own unit to damage, `targets[1]` = ally to buff).
- **Action:** `PLAY_SPELL` (`src/core/actions/play-spell-action.ts`):
  - Validates turn, hand presence, card type, target presence, energy availability, and slow spell restrictions: `slow` requires empty stack AND no active combat (slow is never a reaction); playing units follows the same slow-speed rules (`play-unit-action.ts` rejects units while spells are on the stack or during combat).
  - **Spell Mana Banking:** Spends `reservedEnergy` first, then spills over into base `energy`.
  - `burst` spells resolve instantly on cast (LoR burst): no stack entry, no priority pass — the caster keeps the turn and `consecutivePasses` resets. `fast` and `slow` spells are placed into `state.spellStack` and pass priority to the opponent.
- **Sequential Stack Resolution:** `src/core/spells/resolve-spell-stack.ts` (`resolveSpellItem`):
  - When both players pass consecutively on a non-empty spell stack, exactly ONE spell resolves — the top of the stack (newest, `.pop()`).
  - After each resolution players exchange priority again (opponent of the resolved spell's caster goes first) and may react before the next spell resolves.
  - Resolved spells move to owner's `graveyard`.
- **Pass Action Integration:** `src/core/actions/pass-action.ts` prioritizes the `spellStack` (one spell per consecutive double pass) before round progression; during active combat with an empty stack, two consecutive passes resolve combat strikes (see Combat strike resolution above) instead of advancing the round.

### Layer 1: Triggered Abilities & Card Registry (COMPLETED)

- **Abilities Architecture:**
  - `src/types/abilities.types.ts`: Trigger types (`ON_SUMMON`, `ON_ATTACK`, `ON_REPUTATION_STRIKE`, `ON_KILL`, `ON_DEATH`, `ON_ALLY_DEATH`, `ON_ROUND_START`, `ON_ROUND_END`) and handler signatures. `ON_ALLY_DEATH` is dispatched via `notifyAllyDeath` (`trigger-abilities.ts`) at every death site: combat cleanup, ephemeral round-end purge, `applyDamageToUnit` deaths.
  - **Per-ability typed contexts:** `AbilityHandler<C extends AbilityContext>` is generic; each ability declares its own context in `AbilityContextMap` (e.g. `TremoloPathAbilityContext` requires `chosenPath`). The registry is typed as `AbilityHandlerMap = { [K in AbilityType]: AbilityHandler<AbilityContextMap[K]> }`, so a new ability must declare its context and handler or compilation fails. The only cast lives in the dispatcher (`trigger-abilities.ts`), which cannot statically correlate a runtime `abilityId` with its context.
  - **Ability-agnostic actions:** player actions never carry ability-specific fields. `PlayUnitAction.abilityContexts?: AbilityContextInput` is keyed by ability id and typed via `AbilityContextMap`; the dispatcher merges the engine-provided base context with the per-ability payload. Each ability owns its payload validation through an optional Zod schema (`payloadSchema`, typed as `ZodType<AbilityPayload<C>>` so the schema output must match the ability context) in its registry entry; `play-unit-action.ts` parses payloads with it before any state mutation and passes the parsed result downstream. Abilities without player input simply omit it.
  - `src/core/abilities/trigger-abilities.ts`: Universal ability dispatcher.
  - `src/core/abilities/registry.ts`: Ability router mapping to isolated handler functions in `src/core/abilities/handlers/`.
  - `src/core/spells/registry.ts`: Spell router mapping to isolated handler functions in `src/core/spells/handlers/`.
- **Implemented Cards:**
  - **Tremolo (`src/catalog/characters/tremolo.ts`):**
    - _Choose Path (`TREMOLO_PATH`, ON_SUMMON):_ `PlayUnitAction` carries `abilityContexts.tremolo_path.chosenPath` (`dik` / `neutral` / `chick`, see `src/constants/characters.ts`); payload validated by the Zod schema `tremoloPathPayloadSchema` in `play-unit-action.ts` before state changes.
    - _DIK path:_ permanent +1|+0 and `quick_attack`.
    - _Neutral path:_ permanent −1 attack (floor 0), `elusive`, restores 1 Reserved Energy (cap 3).
    - _CHICK path:_ permanent `tough`, grants his `Tremolo Support` ability (ON_ATTACK: the attacking ally to his right gets +1|+1 for the round).
    - _Test:_ `src/tests/tremolo.test.ts`.
  - **Preemptive Strike (`src/catalog/spells/preemptive-strike.ts`):**
    - Fast spell, Cost 3.
    - Grants target ally +2|+1 and temporary `quick_attack` until round end.
    - _Test:_ `src/tests/preemptive-strike.test.ts`.
  - **Temp Stun (`src/catalog/spells/temp-stun.ts`) — TEMPORARY:**
    - Test vehicle for the `stunned` keyword, to be removed or replaced once a real stun card exists.
    - Fast spell, Cost 2. Stuns target unit; if the target is attacking, it is removed from combat back to its owner's board.
    - Handler: `src/core/spells/handlers/temp-stun.ts`.
    - _Test:_ `src/tests/stun.test.ts`.
  - **Temp Burst (`src/catalog/spells/temp-burst.ts`) — TEMPORARY:**
    - Test vehicle for burst spell speed, to be removed or replaced once a real burst card exists.
    - Burst spell, Cost 1. Gives an ally +1|+0 this round (round-scoped `tempAttack`).
    - Handler: `src/core/spells/handlers/temp-burst.ts`.
    - _Test:_ `src/tests/burst-speed.test.ts`.
  - **Temp Slow (`src/catalog/spells/temp-slow.ts`) — TEMPORARY:**
    - Test vehicle for slow spell speed, to be removed or replaced once a real slow card exists.
    - Slow spell, Cost 2. Gives an ally +1|+1 permanently.
    - Handler: `src/core/spells/handlers/temp-slow.ts`.
    - _Test:_ `src/tests/slow-speed.test.ts`.
  - **Derek (`src/catalog/characters/derek.ts`):** DIKs, Cost 2, 2|3.
    - _Search (ON_SUMMON):_ take Maya from your deck into your hand (silent no-op if absent).
    - _Brotherhood (ON_ATTACK):_ if attacking alongside Tremolo, both gain +1|+1 this round (stacks across multiple Dereks).
    - _Revenge (ON_ALLY_DEATH):_ if allied Maya dies, permanently gains +2|+2 and `overwhelm`.
    - _Test:_ `src/tests/derek.test.ts`.
  - **Maya (`src/catalog/characters/maya.ts`):** HOTs, Cost 2, 1|3.
    - _Search (ON_SUMMON):_ take Derek from your deck into your hand (silent no-op if absent).
    - _Maya Support (ON_ATTACK):_ grants the ally to the right +1|+1 this round; +2|+2 instead when the supported ally is Josy or Tremolo.
    - _Vengeance (ON_ALLY_DEATH):_ if allied Derek dies, the strongest enemy unit (attack; ties → slots-then-board order) permanently gains `vulnerable`.
    - _Test:_ `src/tests/maya.test.ts`.
  - **Josy (`src/catalog/characters/josy.ts`):** HOTs, Cost 2, 1|2, `elusive`.
    - _Draw (ON_REPUTATION_STRIKE):_ draw 1 card (empty deck = defeat); if the drawn card is HOTs/DIKs faction, its cost is reduced by 1 this round via `tempCost` (restored at round end for hand and board cards).
    - _Test:_ `src/tests/josy.test.ts`.
  - **Brother's Shoulder (`src/catalog/spells/brothers-shoulder.ts`):**
    - Burst spell, Cost 2. Two targets: deals 1 damage to your own unit (via `applyDamageToUnit`) and grants an ally +2|+1 this round.
    - _Test:_ `src/tests/derek.test.ts`.
  - **Always and Forever (`src/catalog/spells/always-and-forever.ts`):**
    - Burst spell, Cost 2. Grants an ally `barrier` (expires at round end if unconsumed).
    - _Test:_ `src/tests/maya.test.ts`.
  - **Low Blow (`src/catalog/spells/low-blow.ts`):**
    - Slow spell, Cost 4. Deals 4 damage to a chosen enemy unit (via `applyDamageToUnit`) and applies `stunned` to it if it survives.
    - _Test:_ `src/tests/josy.test.ts`.
  - **Rusty (`src/catalog/characters/rusty.ts`):** DIKs, Cost 5, 3|5, `regeneration`.
    - _Recruitment (ON_SUMMON):_ all allied DIKs in hand and deck permanently cost 1 less (floor 0; no `tempCost` — round-end restore does not touch it).
    - _Rally (ON_ATTACK):_ all attacking allies except himself gain +1|+1 this round.
    - _Test:_ `src/tests/rusty.test.ts`.
  - **Brotherhood (`src/catalog/spells/brotherhood.ts`):**
    - Fast spell, Cost 4. Grants `barrier` to all own units on board and in combat slots (expires at round end if unconsumed).
    - _Test:_ `src/tests/rusty.test.ts`.

### Layer 1: Localization & Interactive Descriptions (COMPLETED)
- **Architecture:** the engine and `GameState` stay locale-agnostic; localized strings live in the `src/locales/` layer and are resolved by card id on the client.
- **Description tokens:** card descriptions contain `{term}` tokens (e.g. `{quick_attack}`, `{summon}`); the same key serves as token, glossary entry and (for mechanics) `KEYWORD` value.
- **`parseDescription` (`src/locales/parse-description.ts`):** splits a description into `DescriptionSegment[]` (`text` / `term`) for interactive rendering (hover tooltips on UI side).
- **Locales (`ru.ts`, `en.ts`):** each provides `cards: Record<CardId, CardStrings>` (compile-time completeness per card id) and `terms: Record<TermKey, TermEntry>` — a glossary of all keywords plus game terms (`summon`, `reputation`, `initiative`, `reserved_energy`, path terms, `support`).
- **Exports:** `LOCALES`, `LocaleCode`, `getLocale`, `getCardStrings`, `parseDescription`, locale types — from the package root.
- _Test:_ `src/tests/locales.test.ts` (parser unit cases + completeness checks: every locale covers every card id and term key; every token in a description resolves in the glossary).

---

## 6. Directory Map (`packages/game-engine`)

```text
src/
├── catalog/                          # Card templates & definitions
│   ├── characters/                   # Character unit cards (tremolo, derek, maya, josy)
│   └── spells/                       # Spell cards (e.g. preemptive-strike.ts, temp-stun.ts, temp-burst.ts, temp-slow.ts)
├── constants/
│   ├── characters.ts                 # Character card ids (CHARACTERS) & Tremolo paths (TREMOLO_PATH)
│   └── game.ts                       # Game limits (MAX_REPUTATION=20, INIT_ENERGY=1, etc.)
├── locales/                          # Localization & interactive description layer
│   ├── en.ts                         # English locale (cards + terms glossary)
│   ├── ru.ts                         # Russian locale (cards + terms glossary)
│   ├── parse-description.ts          # Parses "{term}" tokens into DescriptionSegment[]
│   ├── types.ts                      # Locale, CardStrings, TermEntry, TermKey, CardId
│   └── index.ts                      # LOCALES map, getLocale, getCardStrings
├── core/
│   ├── combat/
│   │   └── resolve-combat.ts         # Combat strike resolution (LoR reaction window)
│   ├── abilities/
│   │   ├── handlers/                 # Isolated ability handlers
│   │   │   ├── tremolo-path.ts
│   │   │   └── support.ts
│   │   ├── registry.ts               # Abilities routing table
│   │   └── trigger-abilities.ts      # Ability dispatcher
│   ├── spells/
│   │   ├── handlers/                 # Isolated spell handlers
│   │   │   ├── preemptive-strike.ts
│   │   │   ├── temp-stun.ts
│   │   │   ├── temp-burst.ts
│   │   │   └── temp-slow.ts
│   │   ├── registry.ts               # Spells routing table
│   │   └── resolve-spell-stack.ts    # Single-spell resolve (sequential stack resolution)
│   ├── actions/
│   │   ├── declare-attacks-action.ts # Decomposed attack phase coordinator
│   │   ├── declare-blocks-action.ts  # Decomposed combat resolution coordinator
│   │   ├── pass-action.ts            # Decomposed pass and round progression coordinator
│   │   ├── play-spell-action.ts      # Decomposed spell cast coordinator
│   │   └── play-unit-action.ts       # Decomposed unit summon coordinator
│   ├── apply-action.ts               # Central action dispatcher
│   └── create-game.ts                # Deterministic game initialization
├── tests/                            # Vitest suites (1 test file per mechanic, 32 files total)
│   ├── barrier.test.ts
│   ├── burst-speed.test.ts
│   ├── cannot-attack.test.ts
│   ├── cannot-block.test.ts
│   ├── challenger.test.ts
│   ├── derek.test.ts
│   ├── combat-reaction.test.ts
│   ├── double-attack.test.ts
│   ├── elusive.test.ts
│   ├── ephemeral.test.ts
│   ├── fleeting.test.ts
│   ├── fury.test.ts
│   ├── game-loop.test.ts
│   ├── impulse.test.ts
│   ├── invulnerable.test.ts
│   ├── josy.test.ts
│   ├── lifesteal.test.ts
│   ├── locales.test.ts
│   ├── maya.test.ts
│   ├── overwhelm.test.ts
│   ├── preemptive-strike.test.ts
│   ├── pressure.test.ts
│   ├── quick-attack.test.ts
│   ├── ram.test.ts
│   ├── regeneration.test.ts
│   ├── rusty.test.ts
│   ├── slow-speed.test.ts
│   ├── spell-stack.test.ts
│   ├── stun.test.ts
│   ├── tough.test.ts
│   ├── tremolo.test.ts
│   └── vulnerable.test.ts
├── types/                            # TypeScript interfaces & discriminated unions
│   ├── abilities.types.ts
│   ├── action.types.ts
│   ├── card.types.ts
│   ├── common.types.ts
│   ├── event.types.ts
│   ├── game-state.types.ts
│   ├── index.ts
│   └── spells.types.ts
└── utils/                            # Deterministic PRNG, shuffle, next player helpers
```

---

## 7. Next Milestones (Roadmap)

### Next Step: Vertical Slice (Back & UI) or Card Expansion

1. **Vertical Slice Option:**
   - Stand up `apps/server` (minimal NestJS WebSocket Gateway forwarding `applyAction`).
   - Stand up `apps/web` (React + Tailwind card board rendering Tremolo, Preemptive Strike, and player board).
2. **Layer 1 Expansion Option:**
   - Challenger keyword (forcing enemy units to block).
   - Additional character cards from user design notes.

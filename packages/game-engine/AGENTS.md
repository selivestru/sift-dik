# Game engine guidance

Keep game rules in `src/core` as a small, deterministic state machine. `applyAction` clones the state once and returns the updated state with its events. Card definitions are vanilla units; do not add spells, abilities, keywords, or effect registries.

The supported game flow is two players, energy that grows to 10, card draw, unit play, one attack-token phase per round, one-to-one blocks, combat resolved after two passes, and game end at zero Reputation or an empty-deck draw.

Keep public types in `src/types`, current character stats in `src/catalog/characters.ts`, and localized character names in `src/locales/names.ts`. Avoid unnecessary layers and dependencies.

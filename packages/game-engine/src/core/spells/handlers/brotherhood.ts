import { KEYWORD, type GameEvent, type GameState, type UnitCardInstance } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'

export const handleBrotherhood = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const casterId = spellItem.spell.ownerId

  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  const allies = [
    ...state.players[casterId]!.board,
    ...combatUnits.filter((unit): unit is UnitCardInstance => unit !== null),
  ]

  for (const ally of allies) {
    if (ally.ownerId !== casterId) continue

    if (!ally.keywords) {
      ally.keywords = []
    }

    if (!ally.keywords.includes(KEYWORD.BARRIER)) {
      ally.keywords.push(KEYWORD.BARRIER)
    }
  }
}

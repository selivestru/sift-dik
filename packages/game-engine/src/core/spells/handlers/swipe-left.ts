import { type GameEvent, type GameState, type UnitCardInstance } from '../../../types'
import { applyDamageToUnits } from '../../combat/damage'
import type { SpellContext } from '../../../types/spells.types'
import { applyDirectReputationDamage } from '../../combat/resolve-combat'

export const handleSwipeLeft = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const casterId = spellItem.spell.ownerId
  const opponentId = Object.keys(state.players).find((id) => id !== casterId)!

  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  const enemyUnits = [
    ...state.players[opponentId]!.board,
    ...combatUnits.filter((unit): unit is UnitCardInstance => unit !== null),
  ].filter((unit) => unit.ownerId === opponentId)

  applyDamageToUnits(state, events, enemyUnits, 1)

  applyDirectReputationDamage(state, events, opponentId, 1)
}

import type { GameEvent, GameState, UnitCardInstance } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'

export const handleWarmUpTheCrowd = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const casterId = spellItem.spell.ownerId

  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  const fighters = [
    ...state.players[casterId]!.board,
    ...combatUnits.filter((unit): unit is UnitCardInstance => unit !== null),
  ]

  for (const fighter of fighters) {
    if (fighter.ownerId !== casterId) continue

    fighter.attack += 1
    fighter.tempAttack = (fighter.tempAttack ?? 0) + 1
  }
}

import { CHARACTERS } from '../../../constants/characters'
import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleElenaSummon = (
  state: GameState,
  _events: GameEvent[],
  { sourceUnit }: AbilityContext,
): void => {
  const johnBoys = state.players[sourceUnit.ownerId]!.board.filter(
    (unit) => unit.id === CHARACTERS.JOHN_BOY && unit.health > 0,
  )

  if (johnBoys.length === 0) return

  for (const unit of [sourceUnit, ...johnBoys]) {
    unit.attack += 1
    unit.health += 1
    unit.maxHealth += 1
  }
}

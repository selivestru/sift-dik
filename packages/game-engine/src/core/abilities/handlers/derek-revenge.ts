import { CHARACTERS } from '../../../constants/characters'
import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { AllyDeathAbilityContext } from '../../../types/abilities.types'

export const handleDerekRevenge = (
  _state: GameState,
  _events: GameEvent[],
  context: AllyDeathAbilityContext,
): void => {
  if (context.deadUnit.id !== CHARACTERS.MAYA) return

  const derek = context.sourceUnit

  derek.attack += 2
  derek.health += 2
  derek.maxHealth += 2

  if (!derek.keywords) {
    derek.keywords = []
  }

  if (!derek.keywords.includes(KEYWORD.OVERWHELM)) {
    derek.keywords.push(KEYWORD.OVERWHELM)
  }
}

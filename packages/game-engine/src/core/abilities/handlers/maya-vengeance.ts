import { CHARACTERS } from '../../../constants/characters'
import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { AllyDeathAbilityContext } from '../../../types/abilities.types'
import { findStrongestEnemyUnit } from '../../utils/enemy-targeting'

export const handleMayaVengeance = (
  state: GameState,
  _events: GameEvent[],
  context: AllyDeathAbilityContext,
): void => {
  if (context.deadUnit.id !== CHARACTERS.DEREK) return

  const enemyId = Object.keys(state.players).find((id) => id !== context.sourceUnit.ownerId)!

  const strongestEnemy = findStrongestEnemyUnit(state, enemyId)

  if (!strongestEnemy) return

  if (!strongestEnemy.keywords) {
    strongestEnemy.keywords = []
  }

  if (!strongestEnemy.keywords.includes(KEYWORD.VULNERABLE)) {
    strongestEnemy.keywords.push(KEYWORD.VULNERABLE)
  }
}

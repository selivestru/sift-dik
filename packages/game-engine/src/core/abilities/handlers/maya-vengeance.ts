import { CHARACTERS } from '../../../constants/characters'
import { KEYWORD, type GameEvent, type GameState, type UnitCardInstance } from '../../../types'
import type { AllyDeathAbilityContext } from '../../../types/abilities.types'

const findStrongestEnemyUnit = (
  state: GameState,
  enemyId: string,
): UnitCardInstance | undefined => {
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  const enemyUnits = [...combatUnits, ...state.players[enemyId]!.board].filter(
    (unit): unit is UnitCardInstance =>
      unit !== null && unit.ownerId === enemyId && unit.health > 0,
  )

  if (enemyUnits.length === 0) return undefined

  return enemyUnits.reduce((strongest, unit) => (unit.attack > strongest.attack ? unit : strongest))
}

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

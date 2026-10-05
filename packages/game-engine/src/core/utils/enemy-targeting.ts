import type { GameState, UnitCardInstance } from '../../types'

export const findStrongestEnemyUnit = (
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

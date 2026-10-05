import type { GameState, UnitCardInstance } from '../../types'

export const findLiveUnit = (state: GameState, unitId: string): UnitCardInstance | undefined => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits =
    state.combat?.slots.flatMap((slot) =>
      slot.blocker ? [slot.attacker, slot.blocker] : [slot.attacker],
    ) ?? []

  return [...boardUnits, ...combatUnits].find(
    (unit) => unit.instanceId === unitId && unit.health > 0,
  )
}

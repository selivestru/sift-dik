import type { GameEvent, GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'

const findUnit = (state: GameState, unitId: string) => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  return [...boardUnits, ...combatUnits].find((unit) => unit?.instanceId === unitId)
}

export const handleTempBurst = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targetUnitInstanceId

  if (!targetId) return

  const target = findUnit(state, targetId)

  if (!target) return

  target.attack += 1
  target.tempAttack = (target.tempAttack ?? 0) + 1
}

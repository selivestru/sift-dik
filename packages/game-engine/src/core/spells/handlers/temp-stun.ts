import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'

const findUnit = (state: GameState, unitId: string) => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  return [...boardUnits, ...combatUnits].find((unit) => unit?.instanceId === unitId)
}

const removeUnitFromCombat = (state: GameState, unitId: string): void => {
  const combat = state.combat

  if (!combat) return

  const attackerSlotIndex = combat.slots.findIndex((slot) => slot.attacker.instanceId === unitId)

  if (attackerSlotIndex !== -1) {
    const [removedSlot] = combat.slots.splice(attackerSlotIndex, 1)

    if (removedSlot) {
      state.players[combat.attackerPlayerId]!.board.push(removedSlot.attacker)
    }

    return
  }

  const blockerSlot = combat.slots.find((slot) => slot.blocker?.instanceId === unitId)

  if (blockerSlot?.blocker) {
    const blocker = blockerSlot.blocker
    blockerSlot.blocker = null
    state.players[combat.defenderPlayerId]!.board.push(blocker)
  }
}

export const handleTempStun = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targetUnitInstanceId

  if (!targetId) return

  const target = findUnit(state, targetId)

  if (!target) return

  if (!target.keywords) {
    target.keywords = []
  }

  if (!target.keywords.includes(KEYWORD.STUNNED)) {
    target.keywords.push(KEYWORD.STUNNED)
    target.tempKeywords = [...(target.tempKeywords ?? []), KEYWORD.STUNNED]
  }

  removeUnitFromCombat(state, targetId)
}

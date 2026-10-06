import type { GameState } from '../../types'

export const removeFromCombat = (state: GameState, unitId: string): void => {
  const combat = state.combat
  if (!combat) return
  const slot = combat.slots.find((item) => item.attacker.instanceId === unitId || item.blocker?.instanceId === unitId)
  if (!slot) return
  if (slot.attacker.instanceId === unitId) {
    combat.slots = combat.slots.filter((item) => item !== slot)
    if (slot.blocker && slot.blocker.health > 0) {
      state.players[slot.blocker.ownerId]!.board.push(slot.blocker)
    }
  } else {
    slot.wasBlocked = true
    slot.blocker = null
  }
}


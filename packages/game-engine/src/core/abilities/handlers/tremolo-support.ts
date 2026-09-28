import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleTremoloSupport = (
  state: GameState,
  _events: GameEvent[],
  context: AbilityContext,
): void => {
  const targetUnit = context.targetUnit

  if (!targetUnit || !state.combat) return

  const targetSlotIndex = state.combat.slots.findIndex(
    (s) => s.attacker.instanceId === targetUnit.instanceId,
  )

  if (targetSlotIndex === -1) return

  const targetSlot = state.combat.slots[targetSlotIndex]!

  targetSlot.attacker.attack += 1
  targetSlot.attacker.health += 1
  targetSlot.attacker.maxHealth += 1

  targetSlot.attacker.tempAttack = (targetSlot.attacker.tempAttack ?? 0) + 1
  targetSlot.attacker.tempHealth = (targetSlot.attacker.tempHealth ?? 0) + 1
}

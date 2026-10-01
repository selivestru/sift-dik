import type { GameEvent, GameState } from '../../../types'
import type { SupportAbilityContext } from '../../../types/abilities.types'

export const handleTremoloSupport = (
  state: GameState,
  _events: GameEvent[],
  context: SupportAbilityContext,
): void => {
  const supportedAlly = context.targetUnit

  if (!supportedAlly || !state.combat) return

  const supportedSlot = state.combat.slots.find(
    (s) => s.attacker.instanceId === supportedAlly.instanceId,
  )

  if (!supportedSlot) return

  supportedSlot.attacker.attack += 1
  supportedSlot.attacker.health += 1
  supportedSlot.attacker.maxHealth += 1

  supportedSlot.attacker.tempAttack = (supportedSlot.attacker.tempAttack ?? 0) + 1
  supportedSlot.attacker.tempHealth = (supportedSlot.attacker.tempHealth ?? 0) + 1
}

import { CHARACTERS } from '../../../constants/characters'
import type { GameEvent, GameState } from '../../../types'
import type { SupportAbilityContext } from '../../../types/abilities.types'

const findSupportAmount = (supportedAllyId: string): number =>
  supportedAllyId === CHARACTERS.JOSY || supportedAllyId === CHARACTERS.TREMOLO ? 2 : 1

export const handleMayaSupport = (
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

  const amount = findSupportAmount(supportedSlot.attacker.id)

  supportedSlot.attacker.attack += amount
  supportedSlot.attacker.health += amount
  supportedSlot.attacker.maxHealth += amount

  supportedSlot.attacker.tempAttack = (supportedSlot.attacker.tempAttack ?? 0) + amount
  supportedSlot.attacker.tempHealth = (supportedSlot.attacker.tempHealth ?? 0) + amount
}

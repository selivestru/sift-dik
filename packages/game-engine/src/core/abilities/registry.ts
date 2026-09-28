import { GAME_EVENT_TYPE } from '../../types'
import {
  ABILITY,
  TRIGGER,
  type AbilityHandler,
  type AbilityType,
} from '../../types/abilities.types'

export const ABILITIES: Record<AbilityType, AbilityHandler> = {
  [ABILITY.TREMOLO_SUPPORT]: {
    trigger: TRIGGER.ON_ATTACK,
    execute: (state, events, context) => {
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
    },
  },
  [ABILITY.TREMOLO_REPUTATION_STRIKE]: {
    trigger: TRIGGER.ON_REPUTATION_STRIKE,
    execute: (state, events, context) => {
      const player = state.players[context.sourceUnit.ownerId]!

      if (player.reservedEnergy < 3) {
        player.reservedEnergy += 1

        events.push({
          type: GAME_EVENT_TYPE.ENERGY_CHANGED,
          playerId: player.id,
          energy: player.reservedEnergy,
          isReserved: true,
        })
      }
    },
  },
}

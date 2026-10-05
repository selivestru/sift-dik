import { GAME_EVENT_TYPE, type GameEvent, type UnitCardInstance } from '../../types'

export const fullyHealUnit = (unit: UnitCardInstance, events: GameEvent[]): void => {
  const amount = unit.maxHealth - unit.health

  if (amount <= 0) return

  unit.health = unit.maxHealth
  events.push({
    type: GAME_EVENT_TYPE.HEAL_DEALT,
    targetId: unit.instanceId,
    amount,
    isReputation: false,
  })
}

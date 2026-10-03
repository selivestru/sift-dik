import { GAME_EVENT_TYPE, type GameEvent, type GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

const MENDING_AMOUNT = 2

export const handleJacobMending = (
  state: GameState,
  events: GameEvent[],
  context: AbilityContext,
): void => {
  const player = state.players[context.sourceUnit.ownerId]!

  for (const unit of player.board) {
    if (unit.instanceId === context.sourceUnit.instanceId) continue

    const delta = Math.min(MENDING_AMOUNT, unit.maxHealth - unit.health)

    if (delta <= 0) continue

    unit.health += delta

    events.push({
      type: GAME_EVENT_TYPE.HEAL_DEALT,
      targetId: unit.instanceId,
      amount: delta,
      isReputation: false,
    })
  }
}

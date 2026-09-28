import { GAME_EVENT_TYPE, type GameEvent, type GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleTremoloReputationStrike = (
  state: GameState,
  events: GameEvent[],
  context: AbilityContext,
): void => {
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
}

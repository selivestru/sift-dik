import { MAX_RESERVED_ENERGY } from '../../../constants/game'
import {
  GAME_EVENT_TYPE,
  type GameEvent,
  type GameState,
  type UnitCardInstance,
} from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'
import { compareUnitStrength } from '../../utils/unit-order'

const findWeakestAlly = (state: GameState, jamie: UnitCardInstance) => {
  const allies = state.players[jamie.ownerId]!.board.filter(
    (unit) => unit.instanceId !== jamie.instanceId,
  )

  if (allies.length === 0) return undefined

  return allies.reduce((weakest, ally) => (compareUnitStrength(ally, weakest) < 0 ? ally : weakest))
}

export const handleJamieBloom = (
  state: GameState,
  events: GameEvent[],
  context: AbilityContext,
): void => {
  const player = state.players[context.sourceUnit.ownerId]!

  if (player.reservedEnergy < MAX_RESERVED_ENERGY) {
    player.reservedEnergy += 1

    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: player.id,
      energy: player.reservedEnergy,
      isReserved: true,
    })

    return
  }

  const weakestAlly = findWeakestAlly(state, context.sourceUnit)

  if (!weakestAlly) return

  weakestAlly.attack += 1
  weakestAlly.health += 1
  weakestAlly.maxHealth += 1
}

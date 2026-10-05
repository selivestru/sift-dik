import { guestsCard } from '../../../catalog/characters/guests'
import { MAX_UNITS_ON_BOARD_PER_PLAYER } from '../../../constants/game'
import {
  GAME_EVENT_TYPE,
  type GameEvent,
  type GameState,
  type UnitCardInstance,
} from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'
import { createCardCopy } from '../../utils/card-copy'

export const handleTommyInvite = (
  state: GameState,
  events: GameEvent[],
  context: AbilityContext,
): void => {
  const combat = state.combat

  if (!combat) return

  if (combat.slots.length >= MAX_UNITS_ON_BOARD_PER_PLAYER) return

  const guests = createCardCopy(state, context.sourceUnit.ownerId, guestsCard) as UnitCardInstance

  combat.slots.push({ attacker: guests, blocker: null })

  events.push({
    type: GAME_EVENT_TYPE.UNIT_SPAWNED,
    playerId: guests.ownerId,
    unit: guests,
  })
}

import { GAME_ACTION_TYPE, type PassAction } from '~/types/action.types'
import { GAME_EVENT_TYPE, type GameEvent } from '~/types/event.types'
import { COMBAT_STAGE, PHASE, type GameState } from '~/types/game-state.types'
import { getPlayer } from '~/utils/get-player'
import { getSecondPlayer } from '~/utils/get-second-player'

import type { ApplyActionResult } from '../apply-action'
import { resolveCombat } from '../resolve-combat'
import { startRound } from '../start-round'
import { declareBlocksAction } from './declare-blocks-action'

export function passAction(state: GameState, action: PassAction): ApplyActionResult {
  if (state.phase !== PHASE.PLAYING) {
    throw new Error('Cannot pass in this phase')
  }

  const player = getPlayer(state.players, action.playerId)

  if (state.turnPlayerId !== player.id) {
    throw new Error("Not player's turn")
  }

  const events: GameEvent[] = [
    {
      type: GAME_EVENT_TYPE.PLAYER_PASSED,
      playerId: player.id,
    },
  ]

  const combat = state.combat

  if (combat) {
    if (combat.stage === COMBAT_STAGE.AWAITING_BLOCKS) {
      if (player.id !== combat.defenderPlayerId) {
        throw new Error('Only the defender may pass while awaiting blocks')
      }

      const result = declareBlocksAction(state, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: player.id,
        blocks: [],
      })

      return {
        state: result.state,
        events: [...events, ...result.events],
      }
    }

    if (combat.stage === COMBAT_STAGE.AWAITING_RESPONSE) {
      if (player.id !== combat.attackerPlayerId) {
        throw new Error('Only the attacker may pass while awaiting a response')
      }

      return resolveCombat(state, events)
    }

    throw new Error('Cannot pass in this combat stage')
  }

  state.consecutivePasses += 1

  if (state.consecutivePasses === 2) {
    events.push({ type: GAME_EVENT_TYPE.ROUND_ENDED, round: state.round })

    startRound(state, events)
  } else {
    state.turnPlayerId = getSecondPlayer(state.players, player.id).id
  }

  return {
    state,
    events,
  }
}

import type { DeclareAttacksAction } from '~/types/action.types'
import { GAME_EVENT_TYPE, type GameEvent } from '~/types/event.types'
import { COMBAT_STAGE, PHASE, type GameState } from '~/types/game-state.types'
import { getPlayer } from '~/utils/get-player'
import { getSecondPlayer } from '~/utils/get-second-player'

import type { ApplyActionResult } from '../apply-action'

export function declareAttacksAction(
  state: GameState,
  action: DeclareAttacksAction,
): ApplyActionResult {
  if (state.phase !== PHASE.PLAYING) {
    throw new Error('Cannot declare attacks in this phase')
  }

  if (state.combat) {
    throw new Error('Cannot declare attacks during combat')
  }

  const player = getPlayer(state.players, action.playerId)

  if (state.turnPlayerId !== player.id) {
    throw new Error("Not player's turn")
  }

  if (!player.hasAttackToken) {
    throw new Error('Player does not have the attack token')
  }

  const attackersOnBoard = action.attackers.every((instanceId) =>
    player.board.some((unit) => unit.instanceId === instanceId),
  )

  if (!attackersOnBoard) {
    throw new Error('Attacker is not on player board')
  }

  const secondPlayer = getSecondPlayer(state.players, player.id)

  const events: GameEvent[] = [
    {
      type: GAME_EVENT_TYPE.ATTACK_DECLARED,
      attackerPlayerId: player.id,
      defenderPlayerId: secondPlayer.id,
      attackerInstanceIds: [...action.attackers],
    },
  ]

  state.combat = {
    attackerPlayerId: player.id,
    defenderPlayerId: secondPlayer.id,
    stage: COMBAT_STAGE.AWAITING_BLOCKS,
    slots: action.attackers.map((attackerId) => ({ attackerId, blockerId: null })),
  }

  player.hasAttackToken = false

  state.consecutivePasses = 0
  state.turnPlayerId = secondPlayer.id

  return {
    state,
    events,
  }
}

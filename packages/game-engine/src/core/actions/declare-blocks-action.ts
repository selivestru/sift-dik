import type { DeclareBlocksAction } from '~/types/action.types'
import { GAME_EVENT_TYPE, type GameEvent } from '~/types/event.types'
import { COMBAT_STAGE, PHASE, type GameState } from '~/types/game-state.types'
import { getPlayer } from '~/utils/get-player'

import type { ApplyActionResult } from '../apply-action'
import { resolveCombat } from '../resolve-combat'

export function declareBlocksAction(
  state: GameState,
  action: DeclareBlocksAction,
): ApplyActionResult {
  if (state.phase !== PHASE.PLAYING) {
    throw new Error('Cannot declare blocks in this phase')
  }

  const combat = state.combat

  if (!combat) {
    throw new Error('No active combat')
  }

  if (combat.stage !== COMBAT_STAGE.AWAITING_BLOCKS) {
    throw new Error('Blockers have already been confirmed')
  }

  const player = getPlayer(state.players, action.playerId)

  if (combat.defenderPlayerId !== player.id) {
    throw new Error('Only the defender may declare blocks')
  }

  if (state.turnPlayerId !== player.id) {
    throw new Error("Not player's turn")
  }

  const attackerIds = new Set(combat.slots.map((slot) => slot.attackerId))
  const blockerIds = new Set(player.board.map((unit) => unit.instanceId))

  const attackersInCombat = action.blocks.every((block) =>
    attackerIds.has(block.attackerInstanceId),
  )

  if (!attackersInCombat) {
    throw new Error('Block references a unit that is not attacking')
  }

  const blockersOnBoard = action.blocks.every((block) => blockerIds.has(block.defenderInstanceId))

  if (!blockersOnBoard) {
    throw new Error('Blocker is not on defender board')
  }

  const blocksByAttacker = new Map(
    action.blocks.map((block) => [block.attackerInstanceId, block.defenderInstanceId]),
  )

  combat.slots = combat.slots.map((slot) => ({
    ...slot,
    blockerId: blocksByAttacker.get(slot.attackerId) ?? null,
  }))

  const events: GameEvent[] = [
    {
      type: GAME_EVENT_TYPE.BLOCKS_DECLARED,
      attackerPlayerId: combat.attackerPlayerId,
      defenderPlayerId: player.id,
      slots: combat.slots.map((slot) => ({ ...slot })),
    },
  ]

  if (action.blocks.length === 0) {
    return resolveCombat(state, events)
  }

  combat.stage = COMBAT_STAGE.AWAITING_RESPONSE

  state.turnPlayerId = combat.attackerPlayerId
  state.consecutivePasses = 0

  return {
    state,
    events,
  }
}

import type { DeclareBlocksAction, GameEvent, GameState } from '../../types'
import type { ApplyActionResult } from '../apply-action'

export const declareBlocksAction = (
  state: GameState,
  action: DeclareBlocksAction,
): ApplyActionResult => {
  const nextState = structuredClone(state)

  if (nextState.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${nextState.winnerPlayerId}`)
  }

  if (nextState.combat === null) {
    throw new Error('Cannot declare blocks: no combat is currently in progress')
  }

  if (
    nextState.turnPlayerId !== action.playerId ||
    nextState.combat.defenderPlayerId !== action.playerId
  ) {
    throw new Error(`It is not player "${action.playerId}" turn to declare blocks`)
  }

  const attackerIds = action.blocks.map((b) => b.attackerInstanceId)

  if (new Set(attackerIds).size !== attackerIds.length) {
    throw new Error('Cannot assign multiple blockers to the same attacker')
  }

  const defenderIds = action.blocks.map((b) => b.defenderInstanceId)

  if (new Set(defenderIds).size !== defenderIds.length) {
    throw new Error('Cannot assign the same defender unit to multiple attackers')
  }

  const combatAttackerIds = new Set(nextState.combat.slots.map((s) => s.attacker.instanceId))
  const allAttackersValid = attackerIds.every((id) => combatAttackerIds.has(id))

  if (!allAttackersValid) {
    throw new Error('One or more targeted attackers are not present in current combat slots')
  }

  const defenderState = nextState.players[action.playerId]!
  const defenderBoardIds = new Set(defenderState.board.map((u) => u.instanceId))
  const allDefendersValid = defenderIds.every((id) => defenderBoardIds.has(id))

  if (!allDefendersValid) {
    throw new Error(
      `Cannot declare block: one or more defender units are not present on player "${action.playerId}" board`,
    )
  }

  const blockerIdSet = new Set(defenderIds)
  const blockerUnits = defenderState.board.filter((u) => blockerIdSet.has(u.instanceId))
  defenderState.board = defenderState.board.filter((u) => !blockerIdSet.has(u.instanceId))

  for (const block of action.blocks) {
    const slot = nextState.combat.slots.find(
      (s) => s.attacker.instanceId === block.attackerInstanceId,
    )!
    const blockerUnit = blockerUnits.find((u) => u.instanceId === block.defenderInstanceId)!
    slot.blocker = blockerUnit
  }

  const attackerPlayer = nextState.players[nextState.combat.attackerPlayerId]!
  const defenderPlayer = nextState.players[nextState.combat.defenderPlayerId]!

  const events: GameEvent[] = []

  for (const { attacker, blocker } of nextState.combat.slots) {
    if (blocker) {
      attacker.health -= blocker.attack
      blocker.health -= attacker.attack

      events.push(
        {
          type: 'DAMAGE_DEALT',
          targetId: attacker.instanceId,
          amount: blocker.attack,
          isReputation: false,
        },
        {
          type: 'DAMAGE_DEALT',
          targetId: blocker.instanceId,
          amount: attacker.attack,
          isReputation: false,
        },
      )

      if (attacker.health <= 0) {
        attackerPlayer.graveyard.push(attacker)
        events.push({ type: 'UNIT_DIED', unitInstanceId: attacker.instanceId })
      } else {
        attackerPlayer.board.push(attacker)
      }

      if (blocker.health <= 0) {
        defenderPlayer.graveyard.push(blocker)
        events.push({ type: 'UNIT_DIED', unitInstanceId: blocker.instanceId })
      } else {
        defenderPlayer.board.push(blocker)
      }
    } else {
      defenderPlayer.reputation -= attacker.attack

      events.push({
        type: 'DAMAGE_DEALT',
        targetId: defenderPlayer.id,
        amount: attacker.attack,
        isReputation: true,
      })

      attackerPlayer.board.push(attacker)

      if (defenderPlayer.reputation <= 0) {
        nextState.winnerPlayerId = attackerPlayer.id
        events.push({ type: 'GAME_OVER', winnerPlayerId: nextState.winnerPlayerId })
        break
      }
    }
  }

  nextState.combat = null

  if (nextState.winnerPlayerId === null) {
    nextState.turnPlayerId = defenderPlayer.id
  }

  return {
    state: nextState,
    events,
  }
}

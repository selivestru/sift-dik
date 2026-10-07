import type { UnitCardInstance } from '~/types/card.types'
import { GAME_EVENT_TYPE, type CombatDamageStrike, type GameEvent } from '~/types/event.types'
import { PHASE, type GameState, type PlayerState } from '~/types/game-state.types'

import type { ApplyActionResult } from './apply-action'

export function resolveCombat(state: GameState, events: GameEvent[]): ApplyActionResult {
  if (state.phase !== PHASE.PLAYING) {
    throw new Error('Cannot resolve combat in this phase')
  }

  const combat = state.combat

  if (!combat) throw new Error('No active combat')

  const attackerPlayer = state.players[combat.attackerPlayerId]
  const defenderPlayer = state.players[combat.defenderPlayerId]

  for (const [slotIndex, slot] of combat.slots.entries()) {
    const attacker = attackerPlayer.board.find((unit) => unit.instanceId === slot.attackerId)

    if (!attacker) continue

    const blocker = defenderPlayer.board.find((unit) => unit.instanceId === slot.blockerId)
    if (slot.blockerId !== null && !blocker) continue

    const strikes: CombatDamageStrike[] = []

    if (blocker) {
      attacker.health -= blocker.attack
      blocker.health -= attacker.attack

      if (attacker.attack > 0) {
        strikes.push({
          sourceInstanceId: attacker.instanceId,
          amount: attacker.attack,
          target: {
            type: 'unit',
            playerId: defenderPlayer.id,
            cardInstanceId: blocker.instanceId,
            health: blocker.health,
          },
        })
      }

      if (blocker.attack > 0) {
        strikes.push({
          sourceInstanceId: blocker.instanceId,
          amount: blocker.attack,
          target: {
            type: 'unit',
            playerId: attackerPlayer.id,
            cardInstanceId: attacker.instanceId,
            health: attacker.health,
          },
        })
      }
    } else {
      defenderPlayer.reputation -= attacker.attack

      if (attacker.attack > 0) {
        strikes.push({
          sourceInstanceId: attacker.instanceId,
          amount: attacker.attack,
          target: {
            type: 'reputation',
            playerId: defenderPlayer.id,
            reputation: defenderPlayer.reputation,
          },
        })
      }
    }

    events.push({
      type: GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      slotIndex,
      attackerId: attacker.instanceId,
      blockerId: slot.blockerId,
      strikes,
    })

    removeDeadUnit(attackerPlayer, attacker, events)

    if (blocker) removeDeadUnit(defenderPlayer, blocker, events)

    if (defenderPlayer.reputation <= 0) break
  }

  state.combat = null
  state.consecutivePasses = 0
  state.turnPlayerId = defenderPlayer.id

  events.push({
    type: GAME_EVENT_TYPE.COMBAT_RESOLVED,
    attackerPlayerId: attackerPlayer.id,
    defenderPlayerId: defenderPlayer.id,
  })

  if (defenderPlayer.reputation <= 0) {
    state.phase = PHASE.FINISHED
    state.winnerPlayerId = attackerPlayer.id

    events.push({
      type: GAME_EVENT_TYPE.GAME_OVER,
      winnerPlayerId: attackerPlayer.id,
    })
  }

  return {
    state,
    events,
  }
}

function removeDeadUnit(player: PlayerState, unit: UnitCardInstance, events: GameEvent[]): void {
  if (unit.health > 0) return

  player.board = player.board.filter((card) => card.instanceId !== unit.instanceId)
  player.graveyard.push(unit)

  events.push({
    type: GAME_EVENT_TYPE.UNIT_DIED,
    playerId: player.id,
    cardInstanceId: unit.instanceId,
  })
}

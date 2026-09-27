import { MAX_REPUTATION } from '../../constants/game'
import {
  GAME_EVENT_TYPE,
  UNIT_KEYWORD,
  type DeclareBlocksAction,
  type GameEvent,
  type GameState,
  type UnitCardInstance,
} from '../../types'
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
    const hasDoubleAttack = attacker.keywords?.includes(UNIT_KEYWORD.DOUBLE_ATTACK)

    if (blocker) {
      const hasQuickAttack = attacker.keywords?.includes(UNIT_KEYWORD.QUICK_ATTACK)

      if (hasDoubleAttack) {
        const damageToBlocker1 = calculateDamage(attacker.attack, blocker)
        blocker.health -= damageToBlocker1

        applyLifesteal(nextState, events, attacker)

        events.push({
          type: GAME_EVENT_TYPE.DAMAGE_DEALT,
          targetId: blocker.instanceId,
          amount: damageToBlocker1,
          isReputation: false,
        })

        if (blocker.health > 0) {
          const damageToAttacker = calculateDamage(blocker.attack, attacker)
          const damageToBlocker2 = calculateDamage(attacker.attack, blocker)

          attacker.health -= damageToAttacker
          blocker.health -= damageToBlocker2

          applyLifesteal(nextState, events, blocker)
          applyLifesteal(nextState, events, attacker)

          events.push(
            {
              type: GAME_EVENT_TYPE.DAMAGE_DEALT,
              targetId: attacker.instanceId,
              amount: damageToAttacker,
              isReputation: false,
            },
            {
              type: GAME_EVENT_TYPE.DAMAGE_DEALT,
              targetId: blocker.instanceId,
              amount: damageToBlocker2,
              isReputation: false,
            },
          )
        }
      } else if (hasQuickAttack) {
        const damageToBlocker = calculateDamage(attacker.attack, blocker)
        blocker.health -= damageToBlocker

        applyLifesteal(nextState, events, attacker)

        events.push({
          type: GAME_EVENT_TYPE.DAMAGE_DEALT,
          targetId: blocker.instanceId,
          amount: damageToBlocker,
          isReputation: false,
        })

        if (blocker.health > 0) {
          const damageToAttacker = calculateDamage(blocker.attack, attacker)
          attacker.health -= damageToAttacker

          applyLifesteal(nextState, events, blocker)

          events.push({
            type: GAME_EVENT_TYPE.DAMAGE_DEALT,
            targetId: attacker.instanceId,
            amount: damageToAttacker,
            isReputation: false,
          })
        }
      } else {
        const damageToAttacker = calculateDamage(blocker.attack, attacker)
        const damageToBlocker = calculateDamage(attacker.attack, blocker)

        attacker.health -= damageToAttacker
        blocker.health -= damageToBlocker

        applyLifesteal(nextState, events, blocker)
        applyLifesteal(nextState, events, attacker)

        events.push(
          {
            type: GAME_EVENT_TYPE.DAMAGE_DEALT,
            targetId: attacker.instanceId,
            amount: damageToAttacker,
            isReputation: false,
          },
          {
            type: GAME_EVENT_TYPE.DAMAGE_DEALT,
            targetId: blocker.instanceId,
            amount: damageToBlocker,
            isReputation: false,
          },
        )
      }

      if (attacker.health <= 0) {
        attackerPlayer.graveyard.push(attacker)
        events.push({ type: GAME_EVENT_TYPE.UNIT_DIED, unitInstanceId: attacker.instanceId })
      } else {
        attackerPlayer.board.push(attacker)
      }

      if (blocker.health <= 0) {
        defenderPlayer.graveyard.push(blocker)
        events.push({ type: GAME_EVENT_TYPE.UNIT_DIED, unitInstanceId: blocker.instanceId })
      } else {
        defenderPlayer.board.push(blocker)
      }
    } else {
      const strikeCount = hasDoubleAttack ? 2 : 1

      for (let i = 0; i < strikeCount; i++) {
        defenderPlayer.reputation -= attacker.attack

        events.push({
          type: GAME_EVENT_TYPE.DAMAGE_DEALT,
          targetId: defenderPlayer.id,
          amount: attacker.attack,
          isReputation: true,
        })

        applyLifesteal(nextState, events, attacker)

        if (defenderPlayer.reputation <= 0) {
          nextState.winnerPlayerId = attackerPlayer.id
          events.push({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId: nextState.winnerPlayerId })
          break
        }
      }

      attackerPlayer.board.push(attacker)

      if (nextState.winnerPlayerId !== null) {
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

function applyLifesteal(state: GameState, events: GameEvent[], striker: UnitCardInstance) {
  const hasLifeSteal = striker.keywords?.includes(UNIT_KEYWORD.LIFESTEAL)

  if (hasLifeSteal) {
    const player = state.players[striker.ownerId]!

    state.players[player.id]!.reputation = Math.min(
      MAX_REPUTATION,
      player.reputation + striker.attack,
    )

    events.push({
      type: GAME_EVENT_TYPE.HEAL_DEALT,
      targetId: player.id,
      amount: striker.attack,
      isReputation: true,
    })
  }
}

function calculateDamage(damage: number, target: UnitCardInstance): number {
  const hasTough = target.keywords?.includes(UNIT_KEYWORD.TOUGH)

  if (hasTough) {
    return Math.max(0, damage - 1)
  }

  return damage
}

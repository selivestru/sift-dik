import { MAX_REPUTATION } from '../../constants/game'
import {
  GAME_EVENT_TYPE,
  UNIT_KEYWORD,
  type DeclareBlocksAction,
  type GameEvent,
  type GameState,
  type PlayerState,
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

  const hasCannotBlockUnit = blockerUnits.some((unit) =>
    unit.keywords?.includes(UNIT_KEYWORD.CANNOT_BLOCK),
  )

  if (hasCannotBlockUnit) {
    throw new Error(
      'Cannot declare block: one or more defender units have the "cannot_block" keyword',
    )
  }

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
        const { blockerDamage: strike1Damage, reputationDamage: rep1 } = calculateStrikeDamage(
          attacker,
          blocker,
        )
        blocker.health -= strike1Damage

        applyLifesteal(nextState, events, attacker)

        events.push({
          type: GAME_EVENT_TYPE.DAMAGE_DEALT,
          targetId: blocker.instanceId,
          amount: strike1Damage,
          isReputation: false,
        })

        applyReputationDamage(nextState, events, defenderPlayer, attackerPlayer.id, rep1)

        if (blocker.health > 0 && nextState.winnerPlayerId === null) {
          const damageToAttacker = calculateDamage(blocker.attack, attacker)
          const { blockerDamage: strike2Damage, reputationDamage: rep2 } = calculateStrikeDamage(
            attacker,
            blocker,
          )

          attacker.health -= damageToAttacker
          blocker.health -= strike2Damage

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
              amount: strike2Damage,
              isReputation: false,
            },
          )

          applyReputationDamage(nextState, events, defenderPlayer, attackerPlayer.id, rep2)
        }
      } else if (hasQuickAttack) {
        const { blockerDamage, reputationDamage } = calculateStrikeDamage(attacker, blocker)
        blocker.health -= blockerDamage

        applyLifesteal(nextState, events, attacker)

        events.push({
          type: GAME_EVENT_TYPE.DAMAGE_DEALT,
          targetId: blocker.instanceId,
          amount: blockerDamage,
          isReputation: false,
        })

        const isGameOver = applyReputationDamage(
          nextState,
          events,
          defenderPlayer,
          attackerPlayer.id,
          reputationDamage,
        )

        if (blocker.health > 0 && !isGameOver) {
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
        const { blockerDamage, reputationDamage } = calculateStrikeDamage(attacker, blocker)

        attacker.health -= damageToAttacker
        blocker.health -= blockerDamage

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
            amount: blockerDamage,
            isReputation: false,
          },
        )

        applyReputationDamage(
          nextState,
          events,
          defenderPlayer,
          attackerPlayer.id,
          reputationDamage,
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

      if (nextState.winnerPlayerId !== null) {
        break
      }
    } else {
      const strikeCount = hasDoubleAttack ? 2 : 1

      for (let i = 0; i < strikeCount; i++) {
        applyLifesteal(nextState, events, attacker)

        const isGameOver = applyReputationDamage(
          nextState,
          events,
          defenderPlayer,
          attackerPlayer.id,
          attacker.attack,
        )

        if (isGameOver) {
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

interface StrikeDamageResult {
  blockerDamage: number
  reputationDamage: number
}

function calculateStrikeDamage(
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
): StrikeDamageResult {
  const hasOverwhelm = attacker.keywords?.includes(UNIT_KEYWORD.OVERWHELM)

  if (hasOverwhelm) {
    const neededToKillBlocker = blocker.keywords?.includes(UNIT_KEYWORD.TOUGH)
      ? blocker.health + 1
      : blocker.health

    const excessDamage = Math.max(0, attacker.attack - neededToKillBlocker)
    const damageToBlockerRaw = attacker.attack - excessDamage
    const blockerDamage = calculateDamage(damageToBlockerRaw, blocker)

    return {
      blockerDamage,
      reputationDamage: excessDamage,
    }
  }

  return {
    blockerDamage: calculateDamage(attacker.attack, blocker),
    reputationDamage: 0,
  }
}

function applyReputationDamage(
  state: GameState,
  events: GameEvent[],
  targetPlayer: PlayerState,
  winnerPlayerId: string,
  amount: number,
): boolean {
  if (amount <= 0) return false

  targetPlayer.reputation -= amount

  events.push({
    type: GAME_EVENT_TYPE.DAMAGE_DEALT,
    targetId: targetPlayer.id,
    amount,
    isReputation: true,
  })

  if (targetPlayer.reputation <= 0) {
    state.winnerPlayerId = winnerPlayerId
    events.push({
      type: GAME_EVENT_TYPE.GAME_OVER,
      winnerPlayerId,
    })

    return true
  }

  return false
}

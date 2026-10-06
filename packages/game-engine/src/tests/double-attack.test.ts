import { describe, expect, test } from 'vitest'

import { applyAction } from '../core'
import { battle, createGame, resolveBattle } from './scenario'
import { GAME_ACTION_TYPE, GAME_EVENT_TYPE, KEYWORD, type UnitCard } from '../types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

const createUnit = (overrides: Partial<UnitCard> = {}): UnitCard => ({
  id: 'unit-template',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 3,
  attack: 3,
  maxHealth: 3,
  baseHealth: 3,
  health: 3,
  ...overrides,
})

describe('Keyword: Double Attack', () => {
  test('attacker strikes twice (first strike, then simultaneous strike)', () => {
    const doubleAttacker = createUnit({
      id: 'da-unit',
      attack: 2,
      baseAttack: 2,
      health: 2,
      baseHealth: 2,
      keywords: [KEYWORD.DOUBLE_ATTACK],
    })

    const beefyBlocker = createUnit({
      id: 'beefy-blocker',
      attack: 1,
      baseAttack: 1,
      health: 5,
      baseHealth: 5,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [beefyBlocker, beefyBlocker, beefyBlocker, beefyBlocker, beefyBlocker] },
        {
          id: 'p2',
          cards: [doubleAttacker, doubleAttacker, doubleAttacker, doubleAttacker, doubleAttacker],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // 1. Both players play their units
    const stateAfterP2 = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand[0]!.instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand[0]!.instanceId,
    }).state

    // 2. P2 attacks, P1 blocks
    const attackingUnitId = stateAfterP1.players[attackerId]!.board[0]!.instanceId
    const defendingUnitId = stateAfterP1.players[defenderId]!.board[0]!.instanceId

    const attackState = applyAction(stateAfterP1, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackingUnitId],
    }).state

    const blockResult = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [{ attackerInstanceId: attackingUnitId, defenderInstanceId: defendingUnitId }],
    })

    const strikePass = blockResult.state

    const combatResult = blockResult

    // Strike 1: 5 - 2 = 3 HP
    // Strike 2: 3 - 2 = 1 HP, and blocker deals 1 damage to attacker: 2 - 1 = 1 HP
    expect(combatResult.state.players[defenderId]!.board[0]!.health).toBe(1)
    expect(combatResult.state.players[attackerId]!.board[0]!.health).toBe(1)

    // Events in exact order: 1st strike (2 dmg), retaliation (1 dmg), 2nd strike (2 dmg)
    expect(combatResult.events).toEqual([
      {
        type: GAME_EVENT_TYPE.DAMAGE_DEALT,
        targetId: defendingUnitId,
        amount: 2,
        isReputation: false,
      },
      {
        type: GAME_EVENT_TYPE.DAMAGE_DEALT,
        targetId: attackingUnitId,
        amount: 1,
        isReputation: false,
      },
      {
        type: GAME_EVENT_TYPE.DAMAGE_DEALT,
        targetId: defendingUnitId,
        amount: 2,
        isReputation: false,
      },
    ])
  })
})

describe('Double Attack interactions', () => {
  test('a killed blocker remains a ghost block for the second strike', () => {
    const result = resolveBattle(battle({ attack: 3, keywords: [KEYWORD.DOUBLE_ATTACK] }, { health: 1 }))
    expect(result.state.players.p2!.reputation).toBe(20)
    expect(result.state.players.p1!.board[0]!.health).toBe(4)
  })
  test('Overwhelm hits the Nexus on both strikes after the blocker dies', () => {
    const result = resolveBattle(battle({ attack: 3, keywords: [KEYWORD.DOUBLE_ATTACK, KEYWORD.OVERWHELM] }, { health: 1 }))
    expect(result.state.players.p2!.reputation).toBe(15)
  })
  test('Fury from the first kill increases the second Overwhelm strike', () => {
    const result = resolveBattle(battle({ attack: 3, keywords: [KEYWORD.DOUBLE_ATTACK, KEYWORD.OVERWHELM, KEYWORD.FURY] }, { health: 1 }))
    expect(result.state.players.p2!.reputation).toBe(14)
    expect(result.state.players.p1!.board[0]!.attack).toBe(4)
  })
  test('an Ephemeral double attacker dies after the first strike', () => {
    const result = resolveBattle(battle({ attack: 3, keywords: [KEYWORD.DOUBLE_ATTACK, KEYWORD.EPHEMERAL] }), false)
    expect(result.state.players.p2!.reputation).toBe(17)
    expect(result.state.players.p1!.board).toHaveLength(0)
    expect(result.state.players.p1!.graveyard.filter((unit) => unit.instanceId === 'a')).toHaveLength(1)
  })
})

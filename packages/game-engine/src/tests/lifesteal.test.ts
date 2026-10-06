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

describe('Keyword: Lifesteal', () => {
  test('unit with lifesteal heals allied reputation by damage dealt', () => {
    const lifestealAttacker = createUnit({
      id: 'lifesteal-unit',
      attack: 3,
      baseAttack: 3,
      health: 3,
      baseHealth: 3,
      keywords: [KEYWORD.LIFESTEAL],
    })

    const blocker = createUnit({
      id: 'blocker-unit',
      attack: 1,
      baseAttack: 1,
      health: 5,
      baseHealth: 5,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [blocker, blocker, blocker, blocker, blocker] },
        {
          id: 'p2',
          cards: [
            lifestealAttacker,
            lifestealAttacker,
            lifestealAttacker,
            lifestealAttacker,
            lifestealAttacker,
          ],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // Simulate attacker having taken prior damage to test healing (from 20 down to 15)
    state.players[attackerId]!.reputation = 15

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

    // 2. P2 attacks with lifesteal unit, P1 blocks
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

    // 3. Both players pass consecutively: combat strikes resolve
    const strikePass = blockResult.state

    const combatResult = blockResult

    // Attacker's reputation restored by dealt damage: 15 + 3 = 18
    expect(combatResult.state.players[attackerId]!.reputation).toBe(18)

    // Events contain HEAL_DEALT for attacker player
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.HEAL_DEALT,
      targetId: attackerId,
      amount: 3,
      isReputation: true,
    })
  })
})

describe('Lifesteal interactions', () => {
  test('Barrier prevents unit damage and Lifesteal healing', () => {
    const state = battle({ keywords: [KEYWORD.LIFESTEAL] }, { keywords: [KEYWORD.BARRIER] })
    state.players.p1!.reputation = 15
    const result = resolveBattle(state)
    expect(result.state.players.p1!.reputation).toBe(15)
    expect(result.events.some((event) => event.type === 'HEAL_DEALT')).toBe(false)
  })
  test('Tough reduces healing to damage actually dealt', () => {
    const state = battle({ keywords: [KEYWORD.LIFESTEAL] }, { keywords: [KEYWORD.TOUGH] })
    state.players.p1!.reputation = 15
    expect(resolveBattle(state).state.players.p1!.reputation).toBe(17)
  })
  test('healing events report the actual capped amount', () => {
    const state = battle({ keywords: [KEYWORD.LIFESTEAL] })
    state.players.p1!.reputation = 19
    const result = resolveBattle(state)
    expect(result.state.players.p1!.reputation).toBe(20)
    expect(result.events).toContainEqual({ type: 'HEAL_DEALT', targetId: 'p1', amount: 1, isReputation: true })
  })
  test('Overwhelm through Barrier heals only for Nexus damage', () => {
    const state = battle({ attack: 5, keywords: [KEYWORD.LIFESTEAL, KEYWORD.OVERWHELM] }, { health: 2, keywords: [KEYWORD.BARRIER] })
    state.players.p1!.reputation = 10
    const result = resolveBattle(state)
    expect(result.state.players.p1!.reputation).toBe(13)
    expect(result.state.players.p2!.reputation).toBe(17)
  })
  test('defending Lifesteal and incoming Overwhelm update Reputation simultaneously', () => {
    const state = battle({ attack: 8, keywords: [KEYWORD.OVERWHELM] }, { attack: 3, health: 2, keywords: [KEYWORD.LIFESTEAL] })
    const result = resolveBattle(state)
    expect(result.state.players.p2!.reputation).toBe(17)
    expect(result.events).toContainEqual({ type: 'HEAL_DEALT', targetId: 'p2', amount: 3, isReputation: true })
  })
})

import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
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
    const strikePass = applyAction(blockResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockResult.state.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

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

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
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  ...overrides,
})

describe('Keyword: Tough', () => {
  test('unit with tough takes 1 less damage in combat', () => {
    const normalAttacker = createUnit({
      id: 'attacker-unit',
      attack: 3,
      baseAttack: 3,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
    })

    const toughBlocker = createUnit({
      id: 'tough-blocker',
      attack: 2,
      baseAttack: 2,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
      keywords: [KEYWORD.TOUGH],
    })

    const state = createGame(
      [
        { id: 'p1', cards: [toughBlocker, toughBlocker, toughBlocker, toughBlocker, toughBlocker] },
        {
          id: 'p2',
          cards: [normalAttacker, normalAttacker, normalAttacker, normalAttacker, normalAttacker],
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

    // 3. Both players pass consecutively: combat strikes resolve
    const strikePass = applyAction(blockResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockResult.state.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    // Attacker (without Tough) took full 2 damage -> 3 - 2 = 1 HP
    expect(combatResult.state.players[attackerId]!.board[0]!.health).toBe(1)

    // Blocker (with Tough) took 3 - 1 = 2 damage -> 3 - 2 = 1 HP (would have died at 0 HP without Tough!)
    expect(combatResult.state.players[defenderId]!.board[0]!.health).toBe(1)

    // Damage event to Tough blocker reflects reduced damage (amount: 2)
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: defendingUnitId,
      amount: 2,
      isReputation: false,
    })
  })
})

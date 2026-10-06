import { describe, expect, test } from 'vitest'

import { applyAction } from '../core'
import { createGame } from './scenario'
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

describe('Keyword: Quick Attack', () => {
  test('attacker strikes first and eliminates blocker without taking damage', () => {
    const quickAttacker = createUnit({
      id: 'qa-unit',
      attack: 3,
      baseAttack: 3,
      health: 2,
      baseHealth: 2,
      keywords: [KEYWORD.QUICK_ATTACK],
    })

    const blocker = createUnit({
      id: 'blocker-unit',
      attack: 3,
      baseAttack: 3,
      health: 2,
      baseHealth: 2,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [blocker, blocker, blocker, blocker, blocker] },
        {
          id: 'p2',
          cards: [quickAttacker, quickAttacker, quickAttacker, quickAttacker, quickAttacker],
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

    // Attacker dealt lethal first strike: survives at full HP, blocker dies
    expect(combatResult.state.players[attackerId]!.board[0]!.health).toBe(2)
    expect(combatResult.state.players[attackerId]!.graveyard).toHaveLength(0)
    expect(combatResult.state.players[defenderId]!.board).toHaveLength(0)
    expect(combatResult.state.players[defenderId]!.graveyard).toHaveLength(1)

    expect(combatResult.events).toEqual([
      {
        type: GAME_EVENT_TYPE.DAMAGE_DEALT,
        targetId: defendingUnitId,
        amount: 3,
        isReputation: false,
      },
      {
        type: GAME_EVENT_TYPE.UNIT_DIED,
        unitInstanceId: defendingUnitId,
      },
    ])
  })
})

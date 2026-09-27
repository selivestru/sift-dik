import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, UNIT_KEYWORD, type UnitCard } from '../types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

const createUnit = (overrides: Partial<UnitCard> = {}): UnitCard => ({
  id: 'unit-template',
  name: 'Unit',
  description: 'Test unit',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 3,
  attack: 3,
  maxAttack: 3,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  ...overrides,
})

describe('Keyword: Cannot Block', () => {
  test('should throw error when trying to declare block with a unit that cannot block', () => {
    const normalAttacker = createUnit({
      id: 'attacker-unit',
      attack: 3,
      baseAttack: 3,
      maxAttack: 3,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
    })

    const recklessUnit = createUnit({
      id: 'reckless-unit',
      attack: 4,
      baseAttack: 4,
      maxAttack: 4,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
      keywords: [UNIT_KEYWORD.CANNOT_BLOCK],
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [recklessUnit, recklessUnit, recklessUnit, recklessUnit, recklessUnit],
        },
        {
          id: 'p2',
          cards: [normalAttacker, normalAttacker, normalAttacker, normalAttacker, normalAttacker],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // 1. Both players play their units to the board
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

    // 2. P2 attacks
    const attackingUnitId = stateAfterP1.players[attackerId]!.board[0]!.instanceId
    const defendingUnitId = stateAfterP1.players[defenderId]!.board[0]!.instanceId

    const attackState = applyAction(stateAfterP1, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackingUnitId],
    }).state

    // 3. P1 attempts to block using the unit with cannot_block -> should fail with error
    expect(() => {
      applyAction(attackState, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: defenderId,
        blocks: [{ attackerInstanceId: attackingUnitId, defenderInstanceId: defendingUnitId }],
      })
    }).toThrow('Cannot declare block: one or more defender units have the "cannot_block" keyword')
  })
})

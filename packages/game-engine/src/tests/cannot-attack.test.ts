import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, KEYWORD, type UnitCard } from '../types'
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

describe('Keyword: Cannot Attack', () => {
  test('should throw error when trying to declare attack with a unit that cannot attack', () => {
    const pacifistUnit = createUnit({
      id: 'pacifist-unit',
      attack: 4,
      baseAttack: 4,
      health: 4,
      baseHealth: 4,
      maxHealth: 4,
      keywords: [KEYWORD.CANNOT_ATTACK],
    })

    const dummyCard = createUnit({ id: 'dummy-card' })

    const state = createGame(
      [
        { id: 'p1', cards: [dummyCard, dummyCard, dummyCard, dummyCard, dummyCard] },
        {
          id: 'p2',
          cards: [pacifistUnit, pacifistUnit, pacifistUnit, pacifistUnit, pacifistUnit],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2

    // 1. P2 plays the unit with cannot_attack to the board
    const stateAfterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand[0]!.instanceId,
    }).state

    // Priority passed to P1. P1 passes priority back to P2
    const stateWithP2Priority = applyAction(stateAfterP2Play, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: getNextPlayerId(state),
    }).state

    const attackingUnitId = stateWithP2Priority.players[attackerId]!.board[0]!.instanceId

    // 2. P2 attempts to declare attack with this unit -> should fail with error
    expect(() => {
      applyAction(stateWithP2Priority, {
        type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
        playerId: attackerId,
        attackers: [attackingUnitId],
      })
    }).toThrow('Cannot declare attack: one or more attackers have the "cannot_attack" keyword')
  })
})

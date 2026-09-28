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
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Fury', () => {
  test('surviving unit with fury gains +1|+1 when killing an enemy in combat', () => {
    // Fury Attacker: 3/3 with Fury
    const furyAttacker = createUnit({
      id: 'fury-attacker',
      attack: 3,
      baseAttack: 3,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
      keywords: [UNIT_KEYWORD.FURY],
    })

    // Weak Blocker: 1/2 (will deal 1 damage to attacker and die)
    const weakBlocker = createUnit({
      id: 'weak-blocker',
      attack: 1,
      baseAttack: 1,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [weakBlocker, createUnit(), createUnit(), createUnit(), createUnit()] },
        { id: 'p2', cards: [furyAttacker, createUnit(), createUnit(), createUnit(), createUnit()] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // 1. Both players play their units
    const stateAfterP2 = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'fury-attacker')!
        .instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand.find((c) => c.id === 'weak-blocker')!
        .instanceId,
    }).state

    // 2. P2 attacks with Fury unit, P1 blocks with weak blocker
    const attackingUnitId = stateAfterP1.players[attackerId]!.board[0]!.instanceId
    const defendingUnitId = stateAfterP1.players[defenderId]!.board[0]!.instanceId

    const attackState = applyAction(stateAfterP1, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackingUnitId],
    }).state

    const combatResult = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [{ attackerInstanceId: attackingUnitId, defenderInstanceId: defendingUnitId }],
    })

    // Blocker died and moved to graveyard
    expect(combatResult.state.players[defenderId]!.board).toHaveLength(0)
    expect(combatResult.state.players[defenderId]!.graveyard).toHaveLength(1)

    // Attacker took 1 damage (3 - 1 = 2 HP), then killed blocker and gained +1|+1 from Fury!
    // Health: 2 + 1 = 3 HP
    // MaxHealth: 3 + 1 = 4 HP
    // Attack: 3 + 1 = 4 Attack
    const survivorOnBoard = combatResult.state.players[attackerId]!.board[0]!
    expect(survivorOnBoard.health).toBe(3)
    expect(survivorOnBoard.maxHealth).toBe(4)
    expect(survivorOnBoard.attack).toBe(4)
  })
})

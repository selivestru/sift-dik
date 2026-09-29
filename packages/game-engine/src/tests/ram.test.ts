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
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Ram', () => {
  test('unit with ram deals 1 damage to opponent reputation when blocked by a surviving blocker', () => {
    // Ram Attacker: 2/2 with Ram
    const ramAttacker = createUnit({
      id: 'ram-attacker',
      attack: 2,
      baseAttack: 2,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
      keywords: [KEYWORD.RAM],
    })

    // Big Blocker: 1/5 (will easily survive 2 damage)
    const bigBlocker = createUnit({
      id: 'big-blocker',
      attack: 1,
      baseAttack: 1,
      health: 5,
      baseHealth: 5,
      maxHealth: 5,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [bigBlocker, createUnit(), createUnit(), createUnit(), createUnit()] },
        { id: 'p2', cards: [ramAttacker, createUnit(), createUnit(), createUnit(), createUnit()] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // 1. Both players play their units
    const stateAfterP2 = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'ram-attacker')!
        .instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand.find((c) => c.id === 'big-blocker')!
        .instanceId,
    }).state

    // 2. P2 attacks with Ram unit, P1 blocks with big blocker
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

    // Blocker took 2 damage -> 5 - 2 = 3 HP (survived)
    expect(combatResult.state.players[defenderId]!.board[0]!.health).toBe(3)

    // Attacker took 1 damage -> 2 - 1 = 1 HP (survived)
    expect(combatResult.state.players[attackerId]!.board[0]!.health).toBe(1)

    // Despite being blocked, Ram dealt 1 damage to defender reputation: 20 - 1 = 19
    expect(combatResult.state.players[defenderId]!.reputation).toBe(19)

    // Event emitted for reputation damage
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: defenderId,
      amount: 1,
      isReputation: true,
    })
  })
})

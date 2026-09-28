import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, GAME_EVENT_TYPE, KEYWORD, type UnitCard } from '../types'
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
  baseHealth: 3,
  maxHealth: 3,
  health: 3,
  ...overrides,
})

describe('Keyword: Regeneration', () => {
  test('damaged unit with regeneration heals to max health at round end', () => {
    const regenUnit = createUnit({
      id: 'regen-unit',
      attack: 3,
      baseAttack: 3,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
      keywords: [KEYWORD.REGENERATION],
    })

    const blocker = createUnit({
      id: 'blocker-unit',
      attack: 1,
      baseAttack: 1,
      health: 5,
      baseHealth: 5,
      maxHealth: 5,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [blocker, blocker, blocker, blocker, blocker] },
        { id: 'p2', cards: [regenUnit, regenUnit, regenUnit, regenUnit, regenUnit] },
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

    // 2. P2 attacks with regen unit, P1 blocks with 1-attack blocker
    const attackingUnitId = stateAfterP1.players[attackerId]!.board[0]!.instanceId
    const defendingUnitId = stateAfterP1.players[defenderId]!.board[0]!.instanceId

    const attackState = applyAction(stateAfterP1, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackingUnitId],
    }).state

    const combatState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [{ attackerInstanceId: attackingUnitId, defenderInstanceId: defendingUnitId }],
    }).state

    // Regen unit took 1 damage in combat -> 3 - 1 = 2 HP
    expect(combatState.players[attackerId]!.board[0]!.health).toBe(2)

    // 3. Both players pass to end Round 1
    const pass1 = applyAction(combatState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: combatState.turnPlayerId,
    }).state

    const round2Result = applyAction(pass1, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: pass1.turnPlayerId,
    })

    // At round end, regen unit on the board is fully restored from 2 to 3 maxHealth
    expect(round2Result.state.players[attackerId]!.board[0]!.health).toBe(3)

    // HEAL_DEALT event was emitted for the unit with delta = 1
    expect(round2Result.events).toContainEqual({
      type: GAME_EVENT_TYPE.HEAL_DEALT,
      targetId: attackingUnitId,
      amount: 1,
      isReputation: false,
    })
  })
})

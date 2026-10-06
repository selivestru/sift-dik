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
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Ephemeral', () => {
  test('ephemeral unit dies immediately after striking in combat', () => {
    // Ephemeral Attacker: 4/4 with Ephemeral
    const ephemeralAttacker = createUnit({
      id: 'ephemeral-attacker',
      attack: 4,
      baseAttack: 4,
      health: 4,
      baseHealth: 4,
      maxHealth: 4,
      keywords: [KEYWORD.EPHEMERAL],
    })

    // Weak Blocker: 1/1 (attacker survives damage with 3 HP, but should die anyway because of Ephemeral)
    const weakBlocker = createUnit({
      id: 'weak-blocker',
      attack: 1,
      baseAttack: 1,
      health: 1,
      baseHealth: 1,
      maxHealth: 1,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [weakBlocker, createUnit(), createUnit(), createUnit(), createUnit()] },
        {
          id: 'p2',
          cards: [ephemeralAttacker, createUnit(), createUnit(), createUnit(), createUnit()],
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
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'ephemeral-attacker')!
        .instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand.find((c) => c.id === 'weak-blocker')!
        .instanceId,
    }).state

    // 2. P2 attacks with Ephemeral unit, P1 blocks
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

    // Both units should be dead and in graveyard
    expect(combatResult.state.players[defenderId]!.board).toHaveLength(0)
    expect(combatResult.state.players[defenderId]!.graveyard).toHaveLength(1)

    // Attacker took only 1 damage (4 - 1 = 3 HP), but died because of Ephemeral!
    expect(combatResult.state.players[attackerId]!.board).toHaveLength(0)
    expect(combatResult.state.players[attackerId]!.graveyard).toHaveLength(1)
    expect(combatResult.state.players[attackerId]!.graveyard[0]!.instanceId).toBe(attackingUnitId)

    // UNIT_DIED event emitted for ephemeral attacker
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.UNIT_DIED,
      unitInstanceId: attackingUnitId,
    })
  })

  test('ephemeral unit on board dies at round end if it did not strike', () => {
    const ephemeralUnit = createUnit({
      id: 'ephemeral-bench',
      keywords: [KEYWORD.EPHEMERAL],
    })

    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        {
          id: 'p2',
          cards: [ephemeralUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    // Play ephemeral unit to bench
    const afterPlayState = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'ephemeral-bench')!.instanceId,
    }).state

    const ephemeralInstanceId = afterPlayState.players[p2Id]!.board[0]!.instanceId
    expect(afterPlayState.players[p2Id]!.board).toHaveLength(1)

    // P1 passes, P2 passes to end Round 1
    const p1Pass = applyAction(afterPlayState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const round2Result = applyAction(p1Pass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    })

    // In Round 2, ephemeral unit on board died
    expect(round2Result.state.players[p2Id]!.board).toHaveLength(0)
    expect(round2Result.state.players[p2Id]!.graveyard).toContainEqual(
      expect.objectContaining({ instanceId: ephemeralInstanceId }),
    )

    expect(round2Result.events).toContainEqual({
      type: GAME_EVENT_TYPE.UNIT_DIED,
      unitInstanceId: ephemeralInstanceId,
    })
  })
})

describe('Ephemeral strike eligibility', () => {
  test('a zero-power Ephemeral unit does not strike or die during combat', () => {
    const result = resolveBattle(battle({ attack: 0, keywords: [KEYWORD.EPHEMERAL] }))
    expect(result.state.players.p1!.board[0]!.health).toBe(3)
    expect(result.state.players.p1!.graveyard).toHaveLength(0)
  })
  test('an Ephemeral blocker cannot strike after its Quick Attack opponent dies', () => {
    const result = resolveBattle(battle({ keywords: [KEYWORD.QUICK_ATTACK, KEYWORD.EPHEMERAL] }, { health: 10, keywords: [KEYWORD.EPHEMERAL] }))
    expect(result.state.players.p1!.graveyard.some((unit) => unit.instanceId === 'a')).toBe(true)
    expect(result.state.players.p2!.board[0]!.instanceId).toBe('b')
  })
})

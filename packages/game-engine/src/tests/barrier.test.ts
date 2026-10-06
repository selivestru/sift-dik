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
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Barrier', () => {
  test('barrier negates the next incoming damage and is consumed', () => {
    const hugeAttacker = createUnit({
      id: 'huge-attacker',
      attack: 10,
      baseAttack: 10,
      health: 10,
      baseHealth: 10,
      maxHealth: 10,
    })

    const barrierBlocker = createUnit({
      id: 'barrier-blocker',
      attack: 2,
      baseAttack: 2,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
      keywords: [KEYWORD.BARRIER],
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [barrierBlocker, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [hugeAttacker, createUnit(), createUnit(), createUnit(), createUnit()],
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
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'huge-attacker')!
        .instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand.find(
        (c) => c.id === 'barrier-blocker',
      )!.instanceId,
    }).state

    // 2. Huge attacker attacks, barrier unit blocks
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

    // Blocker survived 10 damage without a scratch (health is still 2)
    const blockerOnBoard = combatResult.state.players[defenderId]!.board[0]!
    expect(blockerOnBoard.health).toBe(2)
    expect(combatResult.state.players[defenderId]!.graveyard).toHaveLength(0)

    // Barrier keyword was consumed and removed
    expect(blockerOnBoard.keywords).not.toContain(KEYWORD.BARRIER)

    // Damage event to blocker was 0
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: defendingUnitId,
      amount: 0,
      isReputation: false,
    })
  })

  test('unconsumed barrier expires at round end', () => {
    const barrierUnit = createUnit({
      id: 'barrier-bench',
      keywords: [KEYWORD.BARRIER],
    })

    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        { id: 'p2', cards: [barrierUnit, createUnit(), createUnit(), createUnit(), createUnit()] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    // Play unit to board
    const afterPlayState = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'barrier-bench')!.instanceId,
    }).state

    expect(afterPlayState.players[p2Id]!.board[0]!.keywords).toContain(KEYWORD.BARRIER)

    // Both pass to advance round
    const p1Pass = applyAction(afterPlayState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const round2Result = applyAction(p1Pass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    })

    // In Round 2, barrier expired
    const unitInRound2 = round2Result.state.players[p2Id]!.board[0]!
    expect(unitInRound2.keywords).not.toContain(KEYWORD.BARRIER)
  })
})

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
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Elusive', () => {
  test('non-elusive blocker cannot block elusive attacker, but elusive blocker can', () => {
    const elusiveAttacker = createUnit({
      id: 'elusive-attacker',
      keywords: [KEYWORD.ELUSIVE],
    })

    const normalBlocker = createUnit({
      id: 'normal-blocker',
    })

    const elusiveBlocker = createUnit({
      id: 'elusive-blocker',
      keywords: [KEYWORD.ELUSIVE],
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [normalBlocker, elusiveBlocker, createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [elusiveAttacker, createUnit(), createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // Step 1: P2 plays elusive attacker
    const elusiveCardInHand = state.players[attackerId]!.hand.find(
      (c) => c.id === 'elusive-attacker',
    )!
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: elusiveCardInHand.instanceId,
    }).state

    // P1 plays normal blocker
    const normalInHand = afterP2Play.players[defenderId]!.hand.find(
      (c) => c.id === 'normal-blocker',
    )!
    const afterP1NormalPlay = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: normalInHand.instanceId,
    }).state

    // P2 passes priority back to P1
    const p2Pass = applyAction(afterP1NormalPlay, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: attackerId,
    }).state

    // P1 plays elusive blocker (needs energy)
    p2Pass.players[defenderId]!.energy = 10
    const elusiveInDefenderHand = p2Pass.players[defenderId]!.hand.find(
      (c) => c.id === 'elusive-blocker',
    )!
    const afterP1ElusivePlay = applyAction(p2Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: elusiveInDefenderHand.instanceId,
    }).state

    // P2 attacks with elusive unit
    const attackingUnit = afterP1ElusivePlay.players[attackerId]!.board.find(
      (u) => u.id === 'elusive-attacker',
    )!
    const attackState = applyAction(afterP1ElusivePlay, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackingUnit.instanceId],
    }).state

    const normalDefenderUnit = attackState.players[defenderId]!.board.find(
      (u) => u.id === 'normal-blocker',
    )!
    const elusiveDefenderUnit = attackState.players[defenderId]!.board.find(
      (u) => u.id === 'elusive-blocker',
    )!

    // 1. Normal unit tries to block elusive attacker -> throws error
    expect(() => {
      applyAction(attackState, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: defenderId,
        blocks: [
          {
            attackerInstanceId: attackingUnit.instanceId,
            defenderInstanceId: normalDefenderUnit.instanceId,
          },
        ],
      })
    }).toThrow(
      `Cannot declare block: unit "${normalDefenderUnit.instanceId}" cannot block elusive attacker "${attackingUnit.instanceId}"`,
    )

    // 2. Elusive unit blocks elusive attacker -> success
    const validBlockResult = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [
        {
          attackerInstanceId: attackingUnit.instanceId,
          defenderInstanceId: elusiveDefenderUnit.instanceId,
        },
      ],
    })

    // Both players pass consecutively to resolve the combat strikes
    const strikePass = applyAction(validBlockResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: validBlockResult.state.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    expect(combatResult.state.combat).toBeNull()
  })
})

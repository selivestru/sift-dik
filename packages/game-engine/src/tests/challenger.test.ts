import { describe, expect, test } from 'vitest'

import { applyAction } from '../core'
import { createGame } from './scenario'
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

const setupCombat = (attacker: UnitCard, victim: UnitCard) => {
  const state = createGame(
    [
      { id: 'p1', cards: [victim, createUnit(), createUnit(), createUnit(), createUnit()] },
      { id: 'p2', cards: [attacker, createUnit(), createUnit(), createUnit(), createUnit()] },
    ],
    { seed: 42 }, // p2 has initiative
  )

  const p2Id = state.turnPlayerId // p2
  const p1Id = getNextPlayerId(state) // p1

  const afterP2Play = applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p2Id,
    cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === attacker.id)!.instanceId,
  }).state

  const afterP1Play = applyAction(afterP2Play, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p1Id,
    cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === victim.id)!.instanceId,
  }).state

  return {
    state: afterP1Play,
    p1Id,
    p2Id,
    attacker: afterP1Play.players[p2Id]!.board.find((u) => u.id === attacker.id)!,
    victim: afterP1Play.players[p1Id]!.board.find((u) => u.id === victim.id)!,
  }
}

describe('Keyword: Challenger', () => {
  test('challenger forces the chosen enemy to block and combat resolves normally', () => {
    const challengerUnit = createUnit({ id: 'challenger-unit', keywords: [KEYWORD.CHALLENGER] })
    const victimUnit = createUnit({ id: 'victim-unit' })

    const setup = setupCombat(challengerUnit, victimUnit)

    const attackState = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: setup.p2Id,
      attackers: [setup.attacker.instanceId],
      forcedBlockers: [
        {
          attackerInstanceId: setup.attacker.instanceId,
          defenderInstanceId: setup.victim.instanceId,
        },
      ],
    }).state

    expect(attackState.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
    expect(
      attackState.players[setup.p1Id]!.board.find((u) => u.id === 'victim-unit'),
    ).toBeUndefined()

    const blockStateOutcome = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: setup.p1Id,
      blocks: [],
    })
    const blockState = blockStateOutcome.state

    const strikePass = blockStateOutcome.state

    const combatResult = blockStateOutcome

    expect(combatResult.state.combat).toBeNull()
    expect(
      combatResult.state.players[setup.p1Id]!.graveyard.find((u) => u.id === 'victim-unit'),
    ).toBeDefined()
    expect(
      combatResult.state.players[setup.p2Id]!.graveyard.find((u) => u.id === 'challenger-unit'),
    ).toBeDefined()
  })

  test('attacker without challenger cannot force a regular enemy to block', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })
    const victimUnit = createUnit({ id: 'victim-unit' })

    const setup = setupCombat(attackerUnit, victimUnit)

    expect(() => {
      applyAction(setup.state, {
        type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
        playerId: setup.p2Id,
        attackers: [setup.attacker.instanceId],
        forcedBlockers: [
          {
            attackerInstanceId: setup.attacker.instanceId,
            defenderInstanceId: setup.victim.instanceId,
          },
        ],
      })
    }).toThrow(
      `Cannot declare attack: unit "${setup.victim.instanceId}" can only be forced to block by a "challenger" attacker or while having the "vulnerable" keyword`,
    )
  })

  test('challenger can force a unit with cannot_block to block', () => {
    const setup = setupCombat(createUnit({ keywords: [KEYWORD.CHALLENGER] }), createUnit({ keywords: [KEYWORD.CANNOT_BLOCK] }))
    const result = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: setup.p2Id,
      attackers: [setup.attacker.instanceId],
      forcedBlockers: [{ attackerInstanceId: setup.attacker.instanceId, defenderInstanceId: setup.victim.instanceId }],
    })
    expect(result.state.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })

  test('challenger can force a non-elusive unit to block an elusive attacker', () => {
    const setup = setupCombat(createUnit({ keywords: [KEYWORD.CHALLENGER, KEYWORD.ELUSIVE] }), createUnit())
    const result = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: setup.p2Id,
      attackers: [setup.attacker.instanceId],
      forcedBlockers: [{ attackerInstanceId: setup.attacker.instanceId, defenderInstanceId: setup.victim.instanceId }],
    })
    expect(result.state.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })

  test('challenger overrides pressure when forcing a blocker', () => {
    const setup = setupCombat(createUnit({ keywords: [KEYWORD.CHALLENGER, KEYWORD.PRESSURE] }), createUnit({ attack: 1 }))
    const result = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: setup.p2Id,
      attackers: [setup.attacker.instanceId],
      forcedBlockers: [{ attackerInstanceId: setup.attacker.instanceId, defenderInstanceId: setup.victim.instanceId }],
    })
    expect(result.state.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })

  test('defender cannot assign a blocker to a slot that already has a forced blocker', () => {
    const challengerUnit = createUnit({ id: 'challenger-unit', keywords: [KEYWORD.CHALLENGER] })
    const victimUnit = createUnit({ id: 'victim-unit' })

    const setup = setupCombat(challengerUnit, victimUnit)

    setup.state.players[setup.p1Id]!.energy = 10

    const p2Pass = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: setup.p2Id,
    }).state

    const secondPlay = applyAction(p2Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: setup.p1Id,
      cardInstanceId: p2Pass.players[setup.p1Id]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    const attackerOnBoard = secondPlay.players[setup.p2Id]!.board.find(
      (u) => u.id === 'challenger-unit',
    )!
    const victimOnBoard = secondPlay.players[setup.p1Id]!.board.find((u) => u.id === 'victim-unit')!
    const secondDefender = secondPlay.players[setup.p1Id]!.board.find(
      (u) => u.id === 'unit-template',
    )!

    const attackState = applyAction(secondPlay, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: setup.p2Id,
      attackers: [attackerOnBoard.instanceId],
      forcedBlockers: [
        {
          attackerInstanceId: attackerOnBoard.instanceId,
          defenderInstanceId: victimOnBoard.instanceId,
        },
      ],
    }).state

    expect(() => {
      applyAction(attackState, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: setup.p1Id,
        blocks: [
          {
            attackerInstanceId: attackerOnBoard.instanceId,
            defenderInstanceId: secondDefender.instanceId,
          },
        ],
      })
    }).toThrow('Cannot declare block: one or more attackers already have a forced blocker')
  })

  test('challenger can attack without forcing a blocker', () => {
    const challengerUnit = createUnit({ id: 'challenger-unit', keywords: [KEYWORD.CHALLENGER] })
    const victimUnit = createUnit({ id: 'victim-unit' })

    const setup = setupCombat(challengerUnit, victimUnit)

    const attackState = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: setup.p2Id,
      attackers: [setup.attacker.instanceId],
    })

    expect(attackState.state.combat!.slots[0]!.blocker).toBeNull()
    expect(attackState.state.combat!.slots[0]!.attacker.instanceId).toBe(setup.attacker.instanceId)
  })
})

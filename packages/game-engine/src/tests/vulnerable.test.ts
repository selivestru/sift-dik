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

const forceBlock = (setup: ReturnType<typeof setupCombat>) =>
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

describe('Keyword: Vulnerable', () => {
  test('any attacker can force a vulnerable enemy to block without challenger', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })
    const vulnerableUnit = createUnit({ id: 'vulnerable-unit', keywords: [KEYWORD.VULNERABLE] })

    const setup = setupCombat(attackerUnit, vulnerableUnit)
    const attackState = forceBlock(setup).state

    expect(attackState.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
    expect(
      attackState.players[setup.p1Id]!.board.find((u) => u.id === 'vulnerable-unit'),
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
      combatResult.state.players[setup.p1Id]!.graveyard.find((u) => u.id === 'vulnerable-unit'),
    ).toBeDefined()
  })

  test('vulnerable ignores cannot_block when being forced to block', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })
    const vulnerableUnit = createUnit({
      id: 'vulnerable-unit',
      keywords: [KEYWORD.VULNERABLE, KEYWORD.CANNOT_BLOCK],
    })

    const setup = setupCombat(attackerUnit, vulnerableUnit)
    const attackState = forceBlock(setup).state

    expect(attackState.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })

  test('vulnerable ignores elusive when being forced to block', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })
    const vulnerableUnit = createUnit({
      id: 'vulnerable-unit',
      keywords: [KEYWORD.VULNERABLE, KEYWORD.ELUSIVE],
    })

    const setup = setupCombat(attackerUnit, vulnerableUnit)
    const attackState = forceBlock(setup).state

    expect(attackState.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })

  test('vulnerable ignores pressure when being forced to block', () => {
    const pressureAttacker = createUnit({
      id: 'attacker-unit',
      attack: 5,
      baseAttack: 5,
      keywords: [KEYWORD.PRESSURE],
    })
    const vulnerableUnit = createUnit({
      id: 'vulnerable-unit',
      attack: 2,
      keywords: [KEYWORD.VULNERABLE],
    })

    const setup = setupCombat(pressureAttacker, vulnerableUnit)
    const attackState = forceBlock(setup).state

    expect(attackState.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })

  test('stunned vulnerable unit can be forced to block', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })
    const vulnerableUnit = createUnit({
      id: 'vulnerable-unit',
      keywords: [KEYWORD.VULNERABLE, KEYWORD.STUNNED],
    })

    const setup = setupCombat(attackerUnit, vulnerableUnit)

    const result = forceBlock(setup)
    expect(result.state.combat!.slots[0]!.blocker!.instanceId).toBe(setup.victim.instanceId)
  })
})

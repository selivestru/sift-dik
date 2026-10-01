import { describe, expect, test } from 'vitest'

import { tempBurst } from '../catalog/spells/temp-burst'
import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, type UnitCard } from '../types'
import { SPELL_TYPES } from '../types/spells.types'
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

describe('Spell speed: Burst', () => {
  test('burst spell resolves instantly, keeps priority and never enters the spell stack', () => {
    const buffTarget = createUnit({ id: 'burst-target' })

    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        {
          id: 'p2',
          cards: [tempBurst, buffTarget, createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    state.players[p2Id]!.energy = 2
    state.players[p2Id]!.reservedEnergy = 2

    // Step 1: P2 plays the target, P1 plays a dummy unit
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'burst-target')!.instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    // Step 2: P2 casts the burst spell on his own unit
    const burstResult = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: afterP1Play.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_BURST)!
        .instanceId,
      targetUnitInstanceId: afterP1Play.players[p2Id]!.board.find((u) => u.id === 'burst-target')!
        .instanceId,
    })

    // Effect applied immediately, nothing on the stack
    expect(burstResult.state.spellStack).toHaveLength(0)
    const buffedUnit = burstResult.state.players[p2Id]!.board.find((u) => u.id === 'burst-target')!
    expect(buffedUnit.attack).toBe(3)
    expect(buffedUnit.tempAttack).toBe(1)

    // Spell moved straight to the graveyard
    expect(burstResult.state.players[p2Id]!.graveyard).toContainEqual(
      expect.objectContaining({ id: SPELL_TYPES.TEMP_BURST }),
    )
    expect(burstResult.state.players[p2Id]!.hand.some((c) => c.id === SPELL_TYPES.TEMP_BURST)).toBe(
      false,
    )

    // The caster keeps priority: the opponent never got a reaction window
    expect(burstResult.state.turnPlayerId).toBe(p2Id)

    // Cost paid from reserved energy first (unit play already spent 1 base energy)
    expect(burstResult.state.players[p2Id]!.reservedEnergy).toBe(1)
    expect(burstResult.state.players[p2Id]!.energy).toBe(1)
  })

  test('burst spell can be cast after blocks are declared and applies before strikes', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit', baseHealth: 3, health: 3, maxHealth: 3 })
    const blockerUnit = createUnit({ id: 'blocker-unit' })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [blockerUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [attackerUnit, tempBurst, createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    state.players[p2Id]!.energy = 10

    // Step 1: P2 plays the attacker, P1 plays the blocker
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'attacker-unit')!.instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'blocker-unit')!
        .instanceId,
    }).state

    // Step 2: P2 attacks, P1 blocks
    const attackerOnBoard = afterP1Play.players[p2Id]!.board.find((u) => u.id === 'attacker-unit')!
    const attackState = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [attackerOnBoard.instanceId],
    }).state

    const blockerOnBoard = attackState.players[p1Id]!.board.find((u) => u.id === 'blocker-unit')!
    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [
        {
          attackerInstanceId: attackerOnBoard.instanceId,
          defenderInstanceId: blockerOnBoard.instanceId,
        },
      ],
    }).state

    // Step 3: P2 buffs the blocked attacker at burst speed — instant, no reaction window
    const burstResult = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: blockState.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_BURST)!
        .instanceId,
      targetUnitInstanceId: attackerOnBoard.instanceId,
    })

    expect(burstResult.state.spellStack).toHaveLength(0)
    expect(burstResult.state.turnPlayerId).toBe(p2Id)
    expect(burstResult.state.combat!.slots[0]!.attacker.attack).toBe(3)

    // Step 4: Both players pass -> strikes resolve with the buff applied
    const strikePass = applyAction(burstResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: burstResult.state.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    expect(combatResult.state.combat).toBeNull()
    expect(
      combatResult.state.players[p1Id]!.graveyard.find((u) => u.id === 'blocker-unit'),
    ).toBeDefined()
    const attackerAfterCombat = combatResult.state.players[p2Id]!.board.find(
      (u) => u.id === 'attacker-unit',
    )!
    expect(attackerAfterCombat.health).toBe(1)
    expect(attackerAfterCombat.attack).toBe(3)
    expect(combatResult.state.players[p1Id]!.reputation).toBe(20)
  })

  test('burst spell cannot be cast out of turn', () => {
    const state = createGame(
      [
        { id: 'p1', cards: [tempBurst, createUnit(), createUnit(), createUnit()] },
        { id: 'p2', cards: [createUnit(), createUnit(), createUnit(), createUnit()] },
      ],
      { seed: 42 }, // p2 has initiative, p1 cannot act yet
    )

    const p1Id = getNextPlayerId(state)

    expect(() => {
      applyAction(state, {
        type: GAME_ACTION_TYPE.PLAY_SPELL,
        playerId: p1Id,
        cardInstanceId: state.players[p1Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_BURST)!
          .instanceId,
      })
    }).toThrow(`It is not player "${p1Id}" turn to act`)
  })
})

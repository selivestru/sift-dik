import { describe, expect, test } from 'vitest'

import { preemptiveStrike } from '../catalog/spells/preemptive-strike'
import { applyAction, createGame } from '../core'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
  type UnitCard,
} from '../types'
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

describe('Spell: Preemptive Strike', () => {
  test('should go to spell stack, resolve on pass, grant +0|+2 and quick_attack, and expire at round end', () => {
    const vanillaUnit = createUnit({
      id: 'target-unit',
      name: 'Target Ally',
      attack: 2,
      baseAttack: 2,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        { id: 'p2', cards: [vanillaUnit, preemptiveStrike, createUnit(), createUnit(), createUnit()] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    // Setup energy: 2 base energy, 2 reserved energy (total 4, spell costs 3)
    state.players[p2Id]!.energy = 2
    state.players[p2Id]!.reservedEnergy = 2

    const targetCardInHand = state.players[p2Id]!.hand.find((c) => c.id === 'target-unit')!
    const spellCardInHand = state.players[p2Id]!.hand.find((c) => c.id === 'preemptive-strike')!

    // Step 1: P2 plays unit to board
    const afterPlayUnit = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: targetCardInHand.instanceId,
    }).state

    // P1 passes priority back to P2
    const p2TurnAgain = applyAction(afterPlayUnit, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const targetUnitOnBoard = p2TurnAgain.players[p2Id]!.board.find((u) => u.id === 'target-unit')!

    // Step 2: P2 casts Preemptive Strike targeting the ally
    const spellResult = applyAction(p2TurnAgain, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: spellCardInHand.instanceId,
      targetUnitInstanceId: targetUnitOnBoard.instanceId,
    })

    // Cost paid: 2 from reserved energy, 1 from base energy
    expect(spellResult.state.players[p2Id]!.reservedEnergy).toBe(0)
    expect(spellResult.state.players[p2Id]!.energy).toBe(0)

    // Spell is in stack, not yet resolved
    expect(spellResult.state.spellStack).toHaveLength(1)
    expect(spellResult.state.spellStack[0]!.spell.id).toBe('preemptive-strike')

    // Turn passed to P1 to react
    expect(spellResult.state.turnPlayerId).toBe(p1Id)

    // Step 3: P1 passes -> Spell stack resolves!
    const passResult = applyAction(spellResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })

    // Stack is empty, spell moved to graveyard
    expect(passResult.state.spellStack).toHaveLength(0)
    expect(passResult.state.players[p2Id]!.graveyard).toContainEqual(
      expect.objectContaining({ id: 'preemptive-strike' }),
    )

    // Target ally received +0|+2 and quick_attack!
    const buffedUnit = passResult.state.players[p2Id]!.board.find((u) => u.id === 'target-unit')!
    expect(buffedUnit.health).toBe(4)
    expect(buffedUnit.maxHealth).toBe(4)
    expect(buffedUnit.attack).toBe(2)
    expect(buffedUnit.keywords).toContain(KEYWORD.QUICK_ATTACK)
    expect(buffedUnit.tempKeywords).toContain(KEYWORD.QUICK_ATTACK)

    // Step 4: Both players pass to finish Round 1 -> temporary buff and keyword expire
    const passToRound2_1 = applyAction(passResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: passResult.state.turnPlayerId,
    }).state

    const passToRound2_2 = applyAction(passToRound2_1, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: passToRound2_1.turnPlayerId,
    }).state

    // Round 2: Health reverted to 2, Quick Attack removed!
    const revertedUnit = passToRound2_2.players[p2Id]!.board.find((u) => u.id === 'target-unit')!
    expect(revertedUnit.health).toBe(2)
    expect(revertedUnit.maxHealth).toBe(2)
    expect(revertedUnit.keywords).not.toContain(KEYWORD.QUICK_ATTACK)
    expect(revertedUnit.tempKeywords).toHaveLength(0)
  })
})

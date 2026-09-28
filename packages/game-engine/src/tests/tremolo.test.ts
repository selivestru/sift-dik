import { describe, expect, test } from 'vitest'

import { tremoloCard } from '../catalog/characters/tremolo'
import { applyAction, createGame } from '../core'
import {
  GAME_ACTION_TYPE,
  GAME_EVENT_TYPE,
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

describe('Character: Tremolo', () => {
  test('Support: should grant +1|+1 to supported ally on attack, and buff should expire at round end', () => {
    const allyCard = createUnit({
      id: 'freshman-ally',
      name: 'Freshman Ally',
      attack: 2,
      baseAttack: 2,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        { id: 'p2', cards: [tremoloCard, allyCard, tremoloCard, allyCard, tremoloCard] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // Step 1: P2 plays Tremolo (cost 3, energy 1 -> set energy to 10 for test)
    state.players[attackerId]!.energy = 10
    state.players[attackerId]!.maxEnergy = 10

    const tremoloInHand = state.players[attackerId]!.hand.find((c) => c.id === 'tremolo')!
    const allyInHand = state.players[attackerId]!.hand.find((c) => c.id === 'freshman-ally')!

    const afterTremoloPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: tremoloInHand.instanceId,
    }).state

    // P1 passes priority back to P2
    const p1Pass1 = applyAction(afterTremoloPlay, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: defenderId,
    }).state

    // P2 plays Ally
    const afterAllyPlay = applyAction(p1Pass1, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: allyInHand.instanceId,
    }).state

    // P1 passes priority back to P2
    const p1Pass2 = applyAction(afterAllyPlay, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: defenderId,
    }).state

    const tremoloUnit = p1Pass2.players[attackerId]!.board.find((u) => u.id === 'tremolo')!
    const allyUnit = p1Pass2.players[attackerId]!.board.find((u) => u.id === 'freshman-ally')!

    // Step 2: P2 declares attack: [Tremolo, Ally] -> Tremolo supports Ally to his right
    const attackResult = applyAction(p1Pass2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [tremoloUnit.instanceId, allyUnit.instanceId],
    })

    const slotAlly = attackResult.state.combat!.slots[1]!.attacker
    // Ally received +1|+1 in combat
    expect(slotAlly.attack).toBe(3)
    expect(slotAlly.health).toBe(3)
    expect(slotAlly.tempAttack).toBe(1)
    expect(slotAlly.tempHealth).toBe(1)

    // Step 3: P1 declares no blocks
    const combatResult = applyAction(attackResult.state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [],
    })

    // Both survived and returned to board
    const allyOnBoard = combatResult.state.players[attackerId]!.board.find(
      (u) => u.id === 'freshman-ally',
    )!
    expect(allyOnBoard.attack).toBe(3)
    expect(allyOnBoard.health).toBe(3)

    // Tremolo hit reputation -> Reputation Strike triggered!
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: attackerId,
      energy: 1,
      isReserved: true,
    })

    // Step 4: End round -> Temporary buffs expire
    const pass1 = applyAction(combatResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: combatResult.state.turnPlayerId,
    }).state

    const nextRoundState = applyAction(pass1, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: pass1.turnPlayerId,
    }).state

    // In Round 2, Ally reverted back to 2/2
    const allyRound2 = nextRoundState.players[attackerId]!.board.find(
      (u) => u.id === 'freshman-ally',
    )!
    expect(allyRound2.attack).toBe(2)
    expect(allyRound2.health).toBe(2)
    expect(allyRound2.tempAttack).toBe(0)
    expect(allyRound2.tempHealth).toBe(0)
  })
})

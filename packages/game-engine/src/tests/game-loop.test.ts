import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import type { CardDefinition } from '../types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

const mockUnit: CardDefinition = {
  id: 'test-unit',
  name: 'Test Unit',
  description: 'Vanilla unit',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 2,
  attack: 2,
  baseHealth: 3,
  health: 3,
}

const createTestPlayers = (): [
  { id: string; cards: CardDefinition[] },
  { id: string; cards: CardDefinition[] },
] => [
  { id: 'p1', cards: [mockUnit, mockUnit, mockUnit, mockUnit, mockUnit] },
  { id: 'p2', cards: [mockUnit, mockUnit, mockUnit, mockUnit, mockUnit] },
]

describe('Game Engine - Layer 0', () => {
  test('should initialize game with valid default state', () => {
    const [p1, p2] = createTestPlayers()
    const state = createGame([p1, p2], { seed: 42 })

    expect(state.round).toBe(1)
    expect(state.combat).toBeNull()
    expect(state.winnerPlayerId).toBeNull()
    expect(state.consecutivePasses).toBe(0)

    const player1 = state.players[p1.id]!
    expect(player1.reputation).toBe(20)
    expect(player1.energy).toBe(1)
    expect(player1.maxEnergy).toBe(1)
    expect(player1.reservedEnergy).toBe(0)
    expect(player1.hand).toHaveLength(4)
    expect(player1.deck).toHaveLength(1)
    expect(player1.board).toHaveLength(0)

    const activeId = state.initiativePlayerId
    const inactiveId = activeId === p1.id ? p2.id : p1.id

    expect(state.players[activeId]!.hasAttackToken).toBe(true)
    expect(state.players[inactiveId]!.hasAttackToken).toBe(false)
    expect(state.turnPlayerId).toBe(activeId)
  })

  test('should allow active player to play a unit card', () => {
    const [p1, p2] = createTestPlayers()
    const state = createGame([p1, p2], { seed: 42 })

    const activePlayerId = state.turnPlayerId
    const activePlayer = state.players[activePlayerId]!
    const cardToPlay = activePlayer.hand[0]!

    const result = applyAction(state, {
      type: 'PLAY_UNIT',
      playerId: activePlayerId,
      cardInstanceId: cardToPlay.instanceId,
    })

    const updatedPlayer = result.state.players[activePlayerId]!

    expect(updatedPlayer.energy).toBe(0)
    expect(updatedPlayer.hand).toHaveLength(3)
    expect(updatedPlayer.board).toHaveLength(1)
    expect(updatedPlayer.board[0]!.instanceId).toBe(cardToPlay.instanceId)
    expect(result.state.turnPlayerId).toBe(getNextPlayerId(state))

    expect(result.events).toEqual([
      {
        type: 'ENERGY_CHANGED',
        energy: 0,
        playerId: activePlayerId,
      },
      {
        type: 'UNIT_SPAWNED',
        playerId: activePlayerId,
        unit: cardToPlay,
      },
    ])
  })

  test('should resolve combat when attacking and blocking', () => {
    const [p1, p2] = createTestPlayers()
    const state = createGame([p1, p2], { seed: 42 }) // seed 42 sets p2 as initiative player

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    const p2Card = state.players[attackerId]!.hand[0]!
    const stateAfterP2Play = applyAction(state, {
      type: 'PLAY_UNIT',
      playerId: attackerId,
      cardInstanceId: p2Card.instanceId,
    }).state

    const p1Card = stateAfterP2Play.players[defenderId]!.hand[0]!
    const stateAfterP1Play = applyAction(stateAfterP2Play, {
      type: 'PLAY_UNIT',
      playerId: defenderId,
      cardInstanceId: p1Card.instanceId,
    }).state

    const attackingUnitId = stateAfterP1Play.players[attackerId]!.board[0]!.instanceId
    const attackResult = applyAction(stateAfterP1Play, {
      type: 'DECLARE_ATTACKS',
      playerId: attackerId,
      attackers: [attackingUnitId],
    })

    expect(attackResult.state.combat).not.toBeNull()
    expect(attackResult.state.players[attackerId]!.hasAttackToken).toBe(false)
    expect(attackResult.state.combat!.slots[0]!.attacker.instanceId).toBe(attackingUnitId)
    expect(attackResult.state.turnPlayerId).toBe(defenderId)

    const defendingUnitId = attackResult.state.players[defenderId]!.board[0]!.instanceId
    const combatResult = applyAction(attackResult.state, {
      type: 'DECLARE_BLOCKS',
      playerId: defenderId,
      blocks: [{ attackerInstanceId: attackingUnitId, defenderInstanceId: defendingUnitId }],
    })

    // Both units dealt 2 damage to each other (3 - 2 = 1 health)
    expect(combatResult.state.players[attackerId]!.board[0]!.health).toBe(1)
    expect(combatResult.state.players[defenderId]!.board[0]!.health).toBe(1)
    expect(combatResult.state.players[attackerId]!.board).toHaveLength(1)
    expect(combatResult.state.players[defenderId]!.board).toHaveLength(1)

    expect(combatResult.state.combat).toBeNull()
    expect(combatResult.state.players[attackerId]!.reputation).toBe(20)
    expect(combatResult.state.players[defenderId]!.reputation).toBe(20)
    expect(combatResult.state.turnPlayerId).toBe(defenderId)
  })

  test('should advance to next round after two consecutive passes', () => {
    const [p1, p2] = createTestPlayers()
    const state = createGame([p1, p2], { seed: 42 }) // round 1 initiative: p2

    const firstPassResult = applyAction(state, {
      type: 'PASS',
      playerId: state.turnPlayerId,
    })

    expect(firstPassResult.state.consecutivePasses).toBe(1)
    expect(firstPassResult.state.round).toBe(1)
    expect(firstPassResult.state.turnPlayerId).toBe(p1.id)

    const secondPassResult = applyAction(firstPassResult.state, {
      type: 'PASS',
      playerId: firstPassResult.state.turnPlayerId,
    })

    expect(secondPassResult.state.consecutivePasses).toBe(0)
    expect(secondPassResult.state.round).toBe(2)
    expect(secondPassResult.state.initiativePlayerId).toBe(p1.id)
    expect(secondPassResult.state.turnPlayerId).toBe(p1.id)

    for (const player of Object.values(secondPassResult.state.players)) {
      expect(player.maxEnergy).toBe(2)
      expect(player.energy).toBe(2)
      expect(player.reservedEnergy).toBe(1)
      expect(player.deck).toHaveLength(0)
      expect(player.hand).toHaveLength(5)
    }
  })
})

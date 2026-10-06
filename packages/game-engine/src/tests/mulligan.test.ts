import { describe, expect, test } from 'vitest'
import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, type GameState, type UnitCard } from '../types'

const card: UnitCard = {
  id: 'unit', type: 'unit', faction: 'dik', baseCost: 1, cost: 1,
  baseAttack: 1, attack: 1, baseHealth: 1, health: 1, maxHealth: 1,
}
const players = () => ['p1', 'p2'].map((id) => ({ id, cards: Array.from({ length: 20 }, () => card) })) as [
  { id: string; cards: UnitCard[] }, { id: string; cards: UnitCard[] },
]
const confirm = (state: GameState, playerId: string, cardInstanceIds: string[] = []) =>
  applyAction(state, { type: GAME_ACTION_TYPE.MULLIGAN, playerId, cardInstanceIds })

describe('Opening mulligan', () => {
  test('deals four cards before round one, with no energy or attack token', () => {
    const state = createGame(players(), { seed: 0 })
    expect(state.phase).toBe('mulligan')
    expect(state.round).toBe(0)
    for (const player of Object.values(state.players)) {
      expect(player.hand).toHaveLength(4)
      expect(player.deck).toHaveLength(16)
      expect(player.energy).toBe(0)
      expect(player.hasAttackToken).toBe(false)
    }
  })

  test('either player can confirm first; gameplay waits for both', () => {
    const state = createGame(players(), { seed: 42 })
    const first = confirm(state, 'p1')
    expect(first.state.phase).toBe('mulligan')
    expect(first.events).toEqual([])
    expect(() => applyAction(first.state, { type: GAME_ACTION_TYPE.PASS, playerId: first.state.turnPlayerId })).toThrow('mulligan')
    expect(() => confirm(first.state, 'p1')).toThrow('already confirmed')
    const second = confirm(first.state, 'p2')
    expect(second.state.phase).toBe('playing')
    expect(second.state.round).toBe(1)
    expect(second.state.turnPlayerId).toBe(second.state.initiativePlayerId)
    for (const player of Object.values(second.state.players)) {
      expect(player.hand).toHaveLength(5)
      expect(player.deck).toHaveLength(15)
      expect(player.energy).toBe(1)
      expect(player.hasAttackToken).toBe(player.id === second.state.initiativePlayerId)
    }
    expect(second.events.filter((event) => event.type === 'CARD_DRAWN')).toHaveLength(2)
  })

  test('replacements exclude the selected instances and preserve kept slots', () => {
    const state = createGame(players(), { seed: 5 })
    const original = state.players.p1!.hand.map((item) => item.instanceId)
    const choices = [original[1]!, original[3]!]
    const replacementIds = state.players.p1!.deck.slice(0, 2).map((item) => item.instanceId)
    const after = confirm(confirm(state, 'p1', choices).state, 'p2').state
    expect(after.players.p1!.hand.slice(0, 4).map((item) => item.instanceId)).toEqual([
      original[0], replacementIds[0], original[2], replacementIds[1],
    ])
    const allIds = [...after.players.p1!.hand, ...after.players.p1!.deck].map((item) => item.instanceId)
    expect(new Set(allIds).size).toBe(20)
    expect(allIds).toEqual(expect.arrayContaining(choices))
  })

  test('all four cards can be replaced without losing hand size', () => {
    const state = createGame(players(), { seed: 8 })
    const ids = state.players.p2!.hand.map((item) => item.instanceId)
    const result = confirm(confirm(state, 'p2', ids).state, 'p1').state
    expect(result.players.p2!.hand).toHaveLength(5)
    expect(result.players.p2!.hand.slice(0, 4).some((item) => ids.includes(item.instanceId))).toBe(false)
  })

  test('confirmation order and JSON replay do not change random outcomes', () => {
    const initial = createGame(players(), { seed: 0 })
    const choices1 = initial.players.p1!.hand.slice(0, 2).map((item) => item.instanceId)
    const choices2 = initial.players.p2!.hand.slice(0, 3).map((item) => item.instanceId)
    const first = confirm(initial, 'p1', choices1).state
    const replay = JSON.parse(JSON.stringify(first)) as GameState
    const forward = confirm(replay, 'p2', choices2).state
    const reverse = confirm(confirm(initial, 'p2', choices2).state, 'p1', choices1).state
    expect(forward).toEqual(reverse)
    expect(createGame(players(), { seed: 0 })).toEqual(initial)
  })

  test('rejects foreign, unknown and duplicate choices without mutating input', () => {
    const state = createGame(players(), { seed: 2 })
    const before = structuredClone(state)
    for (const ids of [['missing'], [state.players.p2!.hand[0]!.instanceId], [state.players.p1!.hand[0]!.instanceId, state.players.p1!.hand[0]!.instanceId]]) {
      expect(() => confirm(state, 'p1', ids)).toThrow()
      expect(state).toEqual(before)
    }
  })

  test('successful replacement leaves the original state and card template intact', () => {
    const state = createGame(players(), { seed: 12 })
    const before = structuredClone(state)
    const first = confirm(state, 'p1', [state.players.p1!.hand[0]!.instanceId]).state
    confirm(first, 'p2')
    expect(state).toEqual(before)
    expect(card).not.toHaveProperty('instanceId')
  })

  test('rejects confirmations after round one has started', () => {
    const state = createGame(players())
    const started = confirm(confirm(state, 'p1').state, 'p2').state
    expect(() => confirm(started, 'p1')).toThrow('already over')
  })
})

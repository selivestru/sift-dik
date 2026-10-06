import { describe, expect, test } from 'vitest'

import { jacobCard } from '../catalog/characters/jacob'
import { portrait } from '../catalog/spells/portrait'
import { willBloomAgain } from '../catalog/spells/will-bloom-again'
import { applyAction } from '../core'
import { createGame } from './scenario'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type UnitCard,
} from '../types'
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

const p1Cards = (...cards: UnitCard[]): { id: string; cards: UnitCard[] } => ({
  id: 'p1',
  cards: [...cards, createUnit(), createUnit(), createUnit(), createUnit(), createUnit()],
})

const p2Cards = (...cards: CardDefinition[]): { id: string; cards: CardDefinition[] } => ({
  id: 'p2',
  cards,
})

const arrangeZones = (
  state: GameState,
  playerId: string,
  handIds: string[],
  deckIds: string[],
): void => {
  const player = state.players[playerId]!
  const cards: CardInstance[] = [...player.hand, ...player.deck]

  const pool = [...cards]

  const take = (id: string): CardInstance => {
    const index = pool.findIndex((c) => c.id === id)

    return pool.splice(index, 1)[0]!
  }

  player.hand = handIds.map(take)
  player.deck = deckIds.map(take)
}

describe('Character: Jacob', () => {
  test('summon restores 2 health to all own board units except himself', () => {
    const woundedAlly = createUnit({ id: 'wounded-ally', baseHealth: 3, health: 3, maxHealth: 3 })
    const barelyHurt = createUnit({ id: 'barely-hurt' })
    const healthyAlly = createUnit({ id: 'healthy-ally' })

    const state = createGame(
      [p1Cards(), p2Cards(jacobCard, woundedAlly, barelyHurt, healthyAlly)],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterAlly = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'wounded-ally')!.instanceId,
    }).state

    const afterP1 = applyAction(afterAlly, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterAlly.players[p1Id]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    afterP1.players[p2Id]!.board.find((u) => u.id === 'wounded-ally')!.health = 1

    const afterJacob = applyAction(afterP1, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterP1.players[p2Id]!.hand.find((c) => c.id === 'jacob')!.instanceId,
    })

    const healed = afterJacob.state.players[p2Id]!.board.find((u) => u.id === 'wounded-ally')!

    expect(healed.health).toBe(3)
    expect(afterJacob.events).toContainEqual(
      expect.objectContaining({ type: 'HEAL_DEALT', targetId: healed.instanceId, amount: 2 }),
    )
    expect(afterJacob.events.filter((e) => e.type === 'HEAL_DEALT')).toHaveLength(1)
  })

  test('healing is capped at missing health', () => {
    const barelyHurt = createUnit({ id: 'barely-hurt' })

    const state = createGame([p1Cards(), p2Cards(jacobCard, barelyHurt)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterAlly = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'barely-hurt')!.instanceId,
    }).state

    const backToP2 = applyAction(afterAlly, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    backToP2.players[p2Id]!.board.find((u) => u.id === 'barely-hurt')!.health = 1

    const afterJacob = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === 'jacob')!.instanceId,
    }).state

    expect(afterJacob.players[p2Id]!.board.find((u) => u.id === 'barely-hurt')!.health).toBe(2)
  })

  const setupPortrait = (target: CardDefinition) => {
    const state = createGame(
      [p1Cards(), p2Cards(jacobCard, portrait, target, createUnit(), createUnit(), createUnit())],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['jacob', 'portrait', target.id],
      ['unit-template', 'unit-template', 'unit-template'],
    )
    arrangeZones(
      state,
      p1Id,
      ['unit-template'],
      ['unit-template', 'unit-template', 'unit-template', 'unit-template'],
    )

    const afterJacob = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'jacob')!.instanceId,
    }).state

    const afterP1 = applyAction(afterJacob, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterJacob.players[p1Id]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    const jacobOnBoard = afterP1.players[p2Id]!.board.find((u) => u.id === 'jacob')!
    const unitOnBoard = afterP1.players[p1Id]!.board.find((u) => u.id === 'unit-template')!

    return { state: afterP1, p1Id, p2Id, jacobOnBoard, unitOnBoard }
  }

  const castPortrait = (setup: ReturnType<typeof setupPortrait>, targetInstanceId: string) => {
    const castResult = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: setup.p2Id,
      cardInstanceId: setup.state.players[setup.p2Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.PORTRAIT,
      )!.instanceId,
      targets: [targetInstanceId],
    })

    expect(castResult.state.spellStack).toHaveLength(0)

    return castResult
  }

  test('Portrait creates a discounted fleeting copy of a hand card', () => {
    const rewardUnit = createUnit({ id: 'reward-unit', baseCost: 2, cost: 2 })
    const setup = setupPortrait(rewardUnit)

    const originalInstanceId = setup.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === 'reward-unit',
    )!.instanceId

    const castResult = castPortrait(setup, originalInstanceId)

    const hand = castResult.state.players[setup.p2Id]!.hand
    const copy = hand.find((c) => c.id === 'reward-unit' && c.instanceId !== originalInstanceId)!

    expect(hand).toHaveLength(2)
    expect(copy.cost).toBe(1)
    expect(copy.keywords).toContain(KEYWORD.FLEETING)
  })

  test('Portrait copy cost cannot go below 0', () => {
    const cheapUnit = createUnit({ id: 'cheap-unit', baseCost: 1, cost: 1 })
    const setup = setupPortrait(cheapUnit)

    const originalInstanceId = setup.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === 'cheap-unit',
    )!.instanceId

    const castResult = castPortrait(setup, originalInstanceId)

    const copy = castResult.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === 'cheap-unit' && c.instanceId !== originalInstanceId,
    )!

    expect(copy.cost).toBe(0)
    expect(copy.keywords).toContain(KEYWORD.FLEETING)
  })

  test('Portrait copy is discarded at round end while the original stays', () => {
    const rewardUnit = createUnit({ id: 'reward-unit', baseCost: 2, cost: 2 })
    const setup = setupPortrait(rewardUnit)

    const originalInstanceId = setup.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === 'reward-unit',
    )!.instanceId

    const castResult = castPortrait(setup, originalInstanceId)

    const copyInstanceId = castResult.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === 'reward-unit' && c.instanceId !== originalInstanceId,
    )!.instanceId

    const pass1 = applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: castResult.state.turnPlayerId,
    }).state

    const round2 = applyAction(pass1, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: pass1.turnPlayerId,
    })

    const hand = round2.state.players[setup.p2Id]!.hand
    const graveyard = round2.state.players[setup.p2Id]!.graveyard

    expect(hand.some((c) => c.instanceId === originalInstanceId)).toBe(true)
    expect(hand.some((c) => c.instanceId === copyInstanceId)).toBe(false)
    expect(graveyard.some((c) => c.instanceId === copyInstanceId)).toBe(true)
    expect(round2.events).toContainEqual(
      expect.objectContaining({ type: 'CARD_DISCARDED', cardInstanceId: copyInstanceId }),
    )
  })

  test('Portrait can copy a spell card', () => {
    const setup = setupPortrait(willBloomAgain)

    const originalInstanceId = setup.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === SPELL_TYPES.WILL_BLOOM_AGAIN,
    )!.instanceId

    const castResult = castPortrait(setup, originalInstanceId)

    const copy = castResult.state.players[setup.p2Id]!.hand.find(
      (c) => c.id === SPELL_TYPES.WILL_BLOOM_AGAIN && c.instanceId !== originalInstanceId,
    )!

    expect(copy.cost).toBe(1)
    expect(copy.keywords).toContain(KEYWORD.FLEETING)
  })

  test('Portrait cannot target a unit on the board', () => {
    const setup = setupPortrait(createUnit({ id: 'reward-unit' }))

    expect(() => {
      castPortrait(setup, setup.jacobOnBoard.instanceId)
    }).toThrow('Target must be another card in your hand')
  })

  test('Portrait cannot target a card in the enemy hand', () => {
    const setup = setupPortrait(createUnit({ id: 'reward-unit' }))

    const enemyCard = setup.state.players[setup.p1Id]!.deck[0]!

    expect(() => {
      castPortrait(setup, enemyCard.instanceId)
    }).toThrow(
      'Target must be another card in your hand',
    )
  })
})

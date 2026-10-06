import { describe, expect, test } from 'vitest'

import { jamieCard } from '../catalog/characters/jamie'
import { willBloomAgain } from '../catalog/spells/will-bloom-again'
import { applyAction } from '../core'
import { createGame } from './scenario'
import {
  GAME_ACTION_TYPE,
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
  cards: [
    ...cards,
    createUnit(),
    createUnit(),
    createUnit(),
    createUnit(),
    createUnit(),
    createUnit(),
  ],
})

const p2Cards = (...cards: CardDefinition[]): { id: string; cards: CardDefinition[] } => ({
  id: 'p2',
  cards: [...cards, createUnit(), createUnit(), createUnit()],
})

const arrangeZones = (
  state: GameState,
  playerId: string,
  handIds: string[],
  deckIds: string[],
): void => {
  const player = state.players[playerId]!
  const cards: CardInstance[] = [...player.hand, ...player.deck]

  player.hand = handIds.map((id) => cards.find((c) => c.id === id)!)
  player.deck = deckIds.map((id) => cards.find((c) => c.id === id)!)
}

const finishRound = (state: GameState): GameState => {
  const pass1 = applyAction(state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: state.turnPlayerId,
  }).state

  return applyAction(pass1, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: pass1.turnPlayerId,
  }).state
}

const setupBoard = (state: GameState, p1Id: string, p2Id: string, ally: UnitCard) => {
  const afterJamie = applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p2Id,
    cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'jamie')!.instanceId,
  }).state

  const backToP2 = applyAction(afterJamie, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: p1Id,
  }).state

  const afterAlly = applyAction(backToP2, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p2Id,
    cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === ally.id)!.instanceId,
  }).state

  return applyAction(afterAlly, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: p1Id,
  }).state
}

describe('Character: Jamie', () => {
  test('impulse restores 1 Reserved Energy on summon', () => {
    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        p2Cards(jamieCard),
      ],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'jamie')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.reservedEnergy).toBe(1)
  })

  test('round end restores 1 Reserved Energy when it is not full', () => {
    const ally = createUnit({ id: 'ally' })
    const state = createGame([p1Cards(), p2Cards(jamieCard, ally)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['jamie', 'ally'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const boardState = setupBoard(state, p1Id, p2Id, ally)

    boardState.players[p2Id]!.reservedEnergy = 1
    boardState.players[p2Id]!.energy = 0

    const round2 = finishRound(boardState)

    expect(round2.players[p2Id]!.reservedEnergy).toBe(2)

    const allyAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'ally')!

    expect(allyAfterRound.attack).toBe(2)
    expect(allyAfterRound.health).toBe(2)
  })

  test('round end with full Reserved Energy grants the weakest ally +1|+1 permanently', () => {
    const weakAlly = createUnit({ id: 'weak-ally', attack: 1, baseAttack: 1 })
    const strongAlly = createUnit({ id: 'strong-ally' })
    const state = createGame([p1Cards(), p2Cards(jamieCard, weakAlly, strongAlly)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['jamie', 'weak-ally', 'strong-ally'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const boardState = setupBoard(state, p1Id, p2Id, weakAlly)

    const afterStrong = applyAction(boardState, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: boardState.players[p2Id]!.hand.find((c) => c.id === 'strong-ally')!
        .instanceId,
    }).state

    afterStrong.players[p2Id]!.reservedEnergy = 3
    afterStrong.players[p2Id]!.energy = 0

    const round2 = finishRound(afterStrong)

    const weakAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'weak-ally')!
    const strongAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'strong-ally')!
    const jamieAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'jamie')!

    expect(weakAfterRound.attack).toBe(2)
    expect(weakAfterRound.health).toBe(3)
    expect(weakAfterRound.maxHealth).toBe(3)
    expect(strongAfterRound.attack).toBe(2)
    expect(jamieAfterRound.attack).toBe(1)

    const round3 = finishRound(round2)

    const weakAfterTwoRounds = round3.players[p2Id]!.board.find((u) => u.id === 'weak-ally')!

    expect(weakAfterTwoRounds.attack).toBe(3)
    expect(weakAfterTwoRounds.health).toBe(4)
  })

  test('Jamie alone never grants the buff to himself', () => {
    const state = createGame([p1Cards(), p2Cards(jamieCard)], { seed: 42 })

    const p2Id = state.turnPlayerId

    state.players[p2Id]!.energy = 10
    arrangeZones(state, p2Id, ['jamie'], ['unit-template', 'unit-template', 'unit-template'])

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'jamie')!.instanceId,
    }).state

    afterPlay.players[p2Id]!.reservedEnergy = 3

    const round2 = finishRound(afterPlay)

    const jamieAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'jamie')!

    expect(jamieAfterRound.attack).toBe(1)
    expect(jamieAfterRound.health).toBe(2)
    expect(jamieAfterRound.maxHealth).toBe(2)
  })

  const setupWillBloomAgain = (target: UnitCard) => {
    const state = createGame(
      [p1Cards(createUnit({ id: 'enemy-unit' })), p2Cards(jamieCard, willBloomAgain, target)],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['jamie', 'will-bloom-again', target.id],
      ['unit-template', 'unit-template', 'unit-template'],
    )
    arrangeZones(
      state,
      p1Id,
      ['enemy-unit'],
      ['unit-template', 'unit-template', 'unit-template', 'unit-template'],
    )

    const afterJamie = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'jamie')!.instanceId,
    }).state

    const afterEnemy = applyAction(afterJamie, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterJamie.players[p1Id]!.hand.find((c) => c.id === 'enemy-unit')!.instanceId,
    }).state

    const afterTarget = applyAction(afterEnemy, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterEnemy.players[p2Id]!.hand.find((c) => c.id === target.id)!.instanceId,
    }).state

    const backToP2 = applyAction(afterTarget, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const enemyOnBoard = backToP2.players[p1Id]!.board.find((u) => u.id === 'enemy-unit')!
    const targetOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === target.id)!

    return { state: backToP2, p1Id, p2Id, enemyOnBoard, targetOnBoard }
  }

  const castWillBloomAgain = (
    setup: ReturnType<typeof setupWillBloomAgain>,
    targetInstanceId: string,
  ) => {
    const castResult = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: setup.p2Id,
      cardInstanceId: setup.state.players[setup.p2Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.WILL_BLOOM_AGAIN,
      )!.instanceId,
      targets: [targetInstanceId],
    })

    return applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: castResult.state.turnPlayerId,
    })
  }

  test('Will Bloom Again fully heals a damaged ally', () => {
    const setup = setupWillBloomAgain(
      createUnit({ id: 'wounded', baseHealth: 5, health: 5, maxHealth: 5 }),
    )

    setup.state.players[setup.p2Id]!.board.find((u) => u.id === 'wounded')!.health = 2

    const resolved = castWillBloomAgain(setup, setup.targetOnBoard.instanceId)

    const healed = resolved.state.players[setup.p2Id]!.board.find((u) => u.id === 'wounded')!

    expect(healed.health).toBe(5)
    expect(resolved.events).toContainEqual(
      expect.objectContaining({
        type: 'HEAL_DEALT',
        targetId: setup.targetOnBoard.instanceId,
        amount: 3,
      }),
    )
  })

  test('Will Bloom Again cannot target an enemy unit', () => {
    const setup = setupWillBloomAgain(createUnit({ id: 'friendly' }))

    expect(() => {
      castWillBloomAgain(setup, setup.enemyOnBoard.instanceId)
    }).toThrow('Target must be a live ally unit')
  })

  test('Will Bloom Again does nothing for a full-health ally', () => {
    const setup = setupWillBloomAgain(createUnit({ id: 'healthy' }))
    const resolved = castWillBloomAgain(setup, setup.targetOnBoard.instanceId)

    const healthy = resolved.state.players[setup.p2Id]!.board.find((u) => u.id === 'healthy')!

    expect(healthy.health).toBe(2)
    expect(resolved.events.filter((e) => e.type === 'HEAL_DEALT')).toHaveLength(0)
  })
})

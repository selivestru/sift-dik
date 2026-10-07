import { describe, expect, it } from 'vitest'

import {
  applyAction,
  CARD_FACTION,
  CARD_TYPE,
  COMBAT_STAGE,
  createGame,
  GAME_ACTION_TYPE,
  GAME_EVENT_TYPE,
  PHASE,
  type CardDefinition,
  type GameAction,
  type GameEvent,
  type GameState,
} from '../index'

interface FullMatchFixture {
  seed: number
  firstPlayerId: 'a' | 'b'
  wallIndex: number
  duelistIndex: number
}

const fullMatchFixtures: FullMatchFixture[] = [
  { seed: 0, firstPlayerId: 'a', wallIndex: 28, duelistIndex: 8 },
  { seed: 123, firstPlayerId: 'b', wallIndex: 25, duelistIndex: 22 },
]

function makeDeck(prefix: 'soldier' | 'guard', specialIndex: number): CardDefinition[] {
  return Array.from({ length: 40 }, (_, index) => {
    if (index === specialIndex && prefix === 'soldier') {
      return {
        id: 'wall',
        type: CARD_TYPE.UNIT,
        faction: CARD_FACTION.OTHER,
        cost: 0,
        attack: 0,
        baseHealth: 2,
        health: 2,
      }
    }

    if (index === specialIndex && prefix === 'guard') {
      return {
        id: 'duelist',
        type: CARD_TYPE.UNIT,
        faction: CARD_FACTION.OTHER,
        cost: 2,
        attack: 2,
        baseHealth: 2,
        health: 2,
      }
    }

    return {
      id: `${prefix}-${index}`,
      type: CARD_TYPE.UNIT,
      faction: CARD_FACTION.OTHER,
      cost: 1,
      attack: prefix === 'soldier' ? 2 : 1,
      baseHealth: 3,
      health: 3,
    }
  })
}

interface MatchRun {
  state: GameState
  actions: GameAction[]
  events: GameEvent[]
  statesAfterActions: GameState[]
}

function simulateFullMatch(fixture: FullMatchFixture): MatchRun {
  const firstDeck = makeDeck('soldier', fixture.wallIndex)
  const secondDeck = makeDeck('guard', fixture.duelistIndex)
  const decks =
    fixture.firstPlayerId === 'a'
      ? { a: firstDeck, b: secondDeck }
      : { a: secondDeck, b: firstDeck }

  let state = createGame(
    [
      { id: 'a', cards: decks.a },
      { id: 'b', cards: decks.b },
    ],
    { seed: fixture.seed },
  )

  const firstPlayerId = state.initiativePlayerId
  const secondPlayerId = firstPlayerId === 'a' ? 'b' : 'a'
  expect(firstPlayerId).toBe(fixture.firstPlayerId)
  expect(state.players[firstPlayerId].hand.some((card) => card.id === 'wall')).toBe(true)
  expect(state.players[secondPlayerId].hand.some((card) => card.id === 'duelist')).toBe(true)

  const actions: GameAction[] = []
  const events: GameEvent[] = []
  const statesAfterActions: GameState[] = []
  const obliteratedCardInstanceIds = new Set<string>()

  function assertStateInvariants() {
    const players = Object.values(state.players)
    const cards = players.flatMap((player) => [
      ...player.deck,
      ...player.hand,
      ...player.board,
      ...player.graveyard,
    ])
    const cardInstanceIds = cards.map((card) => card.instanceId)

    expect(players).toHaveLength(2)
    expect(cardInstanceIds.length + obliteratedCardInstanceIds.size).toBe(80)
    expect(new Set([...cardInstanceIds, ...obliteratedCardInstanceIds]).size).toBe(80)

    for (const player of players) {
      expect(player.energy).toBeGreaterThanOrEqual(0)
      expect(player.energy).toBeLessThanOrEqual(player.maxEnergy)
      expect(player.maxEnergy).toBeLessThanOrEqual(10)
      expect(player.reservedEnergy).toBeGreaterThanOrEqual(0)
      expect(player.reservedEnergy).toBeLessThanOrEqual(3)
      expect(player.hand.length).toBeLessThanOrEqual(10)
      expect(player.board.length).toBeLessThanOrEqual(6)
      expect(
        [...player.deck, ...player.hand, ...player.board, ...player.graveyard].every(
          (card) => card.ownerId === player.id,
        ),
      ).toBe(true)
      expect(player.board.every((unit) => unit.health > 0)).toBe(true)
    }
  }

  function expectCheckpoint(
    first: { reputation: number; board: number; graveyard: number },
    second: { reputation: number; board: number; graveyard: number },
  ) {
    expect([
      state.players[firstPlayerId].reputation,
      state.players[secondPlayerId].reputation,
    ]).toEqual([first.reputation, second.reputation])
    expect([
      state.players[firstPlayerId].board.length,
      state.players[secondPlayerId].board.length,
    ]).toEqual([first.board, second.board])
    expect([
      state.players[firstPlayerId].graveyard.length,
      state.players[secondPlayerId].graveyard.length,
    ]).toEqual([first.graveyard, second.graveyard])
  }

  function act(action: GameAction) {
    const before = structuredClone(state)
    const result = applyAction(state, action)

    expect(state).toEqual(before)
    state = result.state
    actions.push(action)
    events.push(...result.events)

    for (const event of result.events) {
      if (
        event.type === GAME_EVENT_TYPE.UNIT_OBLITERATED ||
        event.type === GAME_EVENT_TYPE.CARD_OBLITERATED
      ) {
        obliteratedCardInstanceIds.add(event.cardInstanceId)
      }
    }

    assertStateInvariants()
    statesAfterActions.push(structuredClone(state))

    return result
  }

  function playCard(playerId: string, cardId: string, replaceInstanceId?: string) {
    const card = state.players[playerId].hand.find((candidate) => candidate.id === cardId)
    expect(card, `Expected ${playerId} to hold ${cardId}`).toBeDefined()

    return act({
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId,
      cardInstanceId: card!.instanceId,
      ...(replaceInstanceId === undefined ? {} : { replaceInstanceId }),
    })
  }

  function playFirstMatching(playerId: string, prefix: string, replaceInstanceId?: string) {
    const card = state.players[playerId].hand.find((candidate) => candidate.id.startsWith(prefix))
    expect(card, `Expected ${playerId} to hold a ${prefix} card`).toBeDefined()

    return act({
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId,
      cardInstanceId: card!.instanceId,
      ...(replaceInstanceId === undefined ? {} : { replaceInstanceId }),
    })
  }

  function pass(playerId: string) {
    return act({ type: GAME_ACTION_TYPE.PASS, playerId })
  }

  function attack(playerId: string) {
    return act({
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId,
      attackers: state.players[playerId].board.map((unit) => unit.instanceId),
    })
  }

  function declareBlocks(
    playerId: string,
    assignments: Array<{ attackerInstanceId: string; defenderInstanceId: string }>,
  ) {
    return act({ type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId, blocks: assignments })
  }

  function mulligan(playerId: string, indexes: number[]) {
    const cardInstanceIds = indexes.map((index) => state.players[playerId].hand[index]!.instanceId)
    return act({
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId,
      cardInstanceIds,
    })
  }

  assertStateInvariants()
  mulligan(firstPlayerId, [0, 2])
  mulligan(secondPlayerId, [])

  // Round 1: play several units, make a partial block, then pass twice to end the round.
  playCard(firstPlayerId, 'wall')
  playFirstMatching(secondPlayerId, 'guard-')
  playFirstMatching(firstPlayerId, 'soldier-')
  pass(secondPlayerId)
  const roundOneAttack = attack(firstPlayerId)
  expect(roundOneAttack.state.combat?.stage).toBe(COMBAT_STAGE.AWAITING_BLOCKS)
  expect(roundOneAttack.state.turnPlayerId).toBe(secondPlayerId)
  const roundOneCombat = roundOneAttack.state.combat!
  declareBlocks(secondPlayerId, [
    {
      attackerInstanceId: roundOneCombat.slots[1]!.attackerId,
      defenderInstanceId: state.players[secondPlayerId].board[0]!.instanceId,
    },
  ])
  expect(state.combat?.stage).toBe(COMBAT_STAGE.AWAITING_RESPONSE)
  pass(firstPlayerId)
  expectCheckpoint(
    { reputation: 20, board: 2, graveyard: 0 },
    { reputation: 20, board: 1, graveyard: 0 },
  )
  pass(secondPlayerId)
  pass(firstPlayerId)
  expect(state.round).toBe(2)

  // Round 2: attack with a damaged unit; the zero-attack wall absorbs its strike.
  const roundTwoAttack = attack(secondPlayerId)
  expect(roundTwoAttack.state.combat?.stage).toBe(COMBAT_STAGE.AWAITING_BLOCKS)
  declareBlocks(firstPlayerId, [
    {
      attackerInstanceId: roundTwoAttack.state.combat!.slots[0]!.attackerId,
      defenderInstanceId: state.players[firstPlayerId].board[0]!.instanceId,
    },
  ])
  pass(secondPlayerId)
  expectCheckpoint(
    { reputation: 20, board: 2, graveyard: 0 },
    { reputation: 20, board: 1, graveyard: 0 },
  )
  pass(firstPlayerId)
  pass(secondPlayerId)
  expect(state.round).toBe(3)

  // Round 3: a blocker and attacker die together; two unblocked attackers hit the Nexus.
  playFirstMatching(firstPlayerId, 'soldier-')
  playCard(secondPlayerId, 'duelist')
  playFirstMatching(firstPlayerId, 'soldier-')
  pass(secondPlayerId)
  const roundThreeAttack = attack(firstPlayerId)
  const roundThreeCombat = roundThreeAttack.state.combat!
  declareBlocks(secondPlayerId, [
    {
      attackerInstanceId: roundThreeCombat.slots[1]!.attackerId,
      defenderInstanceId: state.players[secondPlayerId].board[1]!.instanceId,
    },
  ])
  const roundThreeResolution = pass(firstPlayerId)
  expect(
    roundThreeResolution.events.filter((event) => event.type === GAME_EVENT_TYPE.UNIT_DIED),
  ).toHaveLength(2)
  expectCheckpoint(
    { reputation: 20, board: 3, graveyard: 1 },
    { reputation: 16, board: 1, graveyard: 1 },
  )
  pass(secondPlayerId)
  pass(firstPlayerId)
  expect(state.round).toBe(4)

  // Round 4: an unblocked attack, followed by a play that resets the pass count.
  attack(secondPlayerId)
  pass(firstPlayerId)
  expectCheckpoint(
    { reputation: 19, board: 3, graveyard: 1 },
    { reputation: 16, board: 1, graveyard: 1 },
  )
  pass(firstPlayerId)
  playFirstMatching(secondPlayerId, 'guard-')
  pass(firstPlayerId)
  pass(secondPlayerId)
  expect(state.round).toBe(5)
  expectCheckpoint(
    { reputation: 19, board: 3, graveyard: 1 },
    { reputation: 16, board: 2, graveyard: 1 },
  )

  // Round 5: fill both boards, replace one unit on each full board, then partially block.
  for (let index = 0; index < 3; index += 1) {
    playFirstMatching(firstPlayerId, 'soldier-')
    playFirstMatching(secondPlayerId, 'guard-')
  }
  expect(state.players[firstPlayerId].board).toHaveLength(6)
  expect(state.players[secondPlayerId].board).toHaveLength(5)
  const wall = state.players[firstPlayerId].board.find((unit) => unit.id === 'wall')!
  act({
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: firstPlayerId,
    cardInstanceId: state.players[firstPlayerId].hand.find((card) =>
      card.id.startsWith('soldier-'),
    )!.instanceId,
    replaceInstanceId: wall.instanceId,
  })
  playFirstMatching(secondPlayerId, 'guard-')
  pass(firstPlayerId)
  const woundedGuard = state.players[secondPlayerId].board.find(
    (unit) => unit.health < unit.baseHealth,
  )!
  playFirstMatching(secondPlayerId, 'guard-', woundedGuard.instanceId)
  const roundFiveAttack = attack(firstPlayerId)
  const roundFiveCombat = roundFiveAttack.state.combat!
  declareBlocks(
    secondPlayerId,
    roundFiveCombat.slots.slice(0, 2).map((slot, index) => ({
      attackerInstanceId: slot.attackerId,
      defenderInstanceId: state.players[secondPlayerId].board[index]!.instanceId,
    })),
  )
  pass(firstPlayerId)
  expectCheckpoint(
    { reputation: 19, board: 6, graveyard: 1 },
    { reputation: 8, board: 6, graveyard: 1 },
  )
  pass(secondPlayerId)
  pass(firstPlayerId)
  expect(state.round).toBe(6)

  // Round 6: all attackers are blocked; weakened blockers die while the attackers survive.
  const roundSixAttack = attack(secondPlayerId)
  const roundSixCombat = roundSixAttack.state.combat!
  declareBlocks(
    firstPlayerId,
    roundSixCombat.slots.map((slot, index) => ({
      attackerInstanceId: slot.attackerId,
      defenderInstanceId: state.players[firstPlayerId].board[index]!.instanceId,
    })),
  )
  const roundSixResolution = pass(secondPlayerId)
  expect(
    roundSixResolution.events.filter((event) => event.type === GAME_EVENT_TYPE.UNIT_DIED),
  ).toHaveLength(2)
  expectCheckpoint(
    { reputation: 19, board: 6, graveyard: 1 },
    { reputation: 8, board: 4, graveyard: 3 },
  )
  pass(firstPlayerId)
  pass(secondPlayerId)
  expect(state.round).toBe(7)

  // Round 7: the defender takes lethal damage during an unblocked attack.
  attack(firstPlayerId)
  const lethalResult = pass(secondPlayerId)
  expect(lethalResult.state.phase).toBe(PHASE.FINISHED)
  expect(lethalResult.state.winnerPlayerId).toBe(firstPlayerId)
  expect(lethalResult.events.at(-1)).toEqual({
    type: GAME_EVENT_TYPE.GAME_OVER,
    winnerPlayerId: firstPlayerId,
  })
  expectCheckpoint(
    { reputation: 19, board: 6, graveyard: 1 },
    { reputation: 0, board: 4, graveyard: 3 },
  )

  const finalEventCounts = countEvents(events)
  expect(finalEventCounts).toEqual({
    [GAME_EVENT_TYPE.MULLIGAN_COMPLETED]: 2,
    [GAME_EVENT_TYPE.ENERGY_CHANGED]: 30,
    [GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED]: 4,
    [GAME_EVENT_TYPE.CARD_DRAWN]: 14,
    [GAME_EVENT_TYPE.UNIT_PLAYED]: 16,
    [GAME_EVENT_TYPE.ATTACK_DECLARED]: 7,
    [GAME_EVENT_TYPE.BLOCKS_DECLARED]: 7,
    [GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED]: 24,
    [GAME_EVENT_TYPE.UNIT_DIED]: 4,
    [GAME_EVENT_TYPE.COMBAT_RESOLVED]: 7,
    [GAME_EVENT_TYPE.UNIT_OBLITERATED]: 2,
    [GAME_EVENT_TYPE.ROUND_STARTED]: 7,
    [GAME_EVENT_TYPE.ROUND_ENDED]: 6,
    [GAME_EVENT_TYPE.PLAYER_PASSED]: 23,
    [GAME_EVENT_TYPE.CARD_OBLITERATED]: 0,
    [GAME_EVENT_TYPE.GAME_OVER]: 1,
  })
  expect(actions).toHaveLength(53)
  expect(state.round).toBe(7)
  expect(state.combat).toBeNull()
  expect(state.consecutivePasses).toBe(0)
  expect(state.players[firstPlayerId].reputation).toBe(19)
  expect(state.players[secondPlayerId].reputation).toBe(0)
  expect(state.players[firstPlayerId].reservedEnergy).toBe(3)
  expect(state.players[secondPlayerId].reservedEnergy).toBe(3)
  expect(state.players[firstPlayerId].board).toHaveLength(6)
  expect(state.players[secondPlayerId].board).toHaveLength(4)

  for (const illegalAction of [
    {
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId: firstPlayerId,
      cardInstanceIds: [],
    },
    {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: firstPlayerId,
      cardInstanceId: state.players[firstPlayerId].hand[0]!.instanceId,
    },
    {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: firstPlayerId,
      attackers: [state.players[firstPlayerId].board[0]!.instanceId],
    },
    { type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: secondPlayerId, blocks: [] },
    { type: GAME_ACTION_TYPE.PASS, playerId: secondPlayerId },
  ] satisfies GameAction[]) {
    const before = structuredClone(state)
    expect(() => applyAction(state, illegalAction)).toThrow('phase')
    expect(state).toEqual(before)
  }

  return { state, actions, events, statesAfterActions }
}

function countEvents(events: GameEvent[]): Partial<Record<GameEvent['type'], number>> {
  return Object.fromEntries(
    Object.values(GAME_EVENT_TYPE).map((type) => [
      type,
      events.filter((event) => event.type === type).length,
    ]),
  )
}

describe('vanilla full match', () => {
  it.each(fullMatchFixtures)(
    'plays a complete varied match with seed $seed and first player $firstPlayerId',
    (fixture) => {
      const firstRun = simulateFullMatch(fixture)
      const replay = simulateFullMatch(fixture)

      expect(replay.actions).toEqual(firstRun.actions)
      expect(replay.events).toEqual(firstRun.events)
      expect(replay.statesAfterActions).toEqual(firstRun.statesAfterActions)
      expect(replay.state).toEqual(firstRun.state)
    },
  )

  it('finishes through required draw exhaustion after 36 complete rounds', () => {
    const cards = Array.from({ length: 40 }, (_, index) => ({
      id: `unit-${index}`,
      type: CARD_TYPE.UNIT,
      faction: CARD_FACTION.OTHER,
      cost: 1,
      attack: 0,
      baseHealth: 1,
      health: 1,
    }))
    let state = createGame(
      [
        { id: 'a', cards },
        { id: 'b', cards },
      ],
      { seed: 0 },
    )
    const events: GameEvent[] = []
    let actionCount = 0
    let obliteratedCount = 0

    function act(action: GameAction) {
      const before = structuredClone(state)
      const result = applyAction(state, action)
      expect(state).toEqual(before)
      state = result.state
      actionCount += 1
      events.push(...result.events)
      obliteratedCount += result.events.filter(
        (event) => event.type === GAME_EVENT_TYPE.CARD_OBLITERATED,
      ).length

      const cardsInZones = Object.values(state.players).flatMap((player) => [
        ...player.deck,
        ...player.hand,
        ...player.board,
        ...player.graveyard,
      ])
      expect(cardsInZones).toHaveLength(80 - obliteratedCount)
      expect(new Set(cardsInZones.map((card) => card.instanceId)).size).toBe(cardsInZones.length)

      return result
    }

    act({
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId: state.initiativePlayerId,
      cardInstanceIds: [],
    })
    act({
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId: Object.keys(state.players).find((id) => id !== state.initiativePlayerId)!,
      cardInstanceIds: [],
    })

    while (state.phase !== PHASE.FINISHED) {
      act({ type: GAME_ACTION_TYPE.PASS, playerId: state.turnPlayerId })
    }

    expect(actionCount).toBe(74)
    expect(state.round).toBe(37)
    expect(state.winnerPlayerId).toBeNull()
    expect(state.phase).toBe(PHASE.FINISHED)
    expect(Object.values(state.players).map((player) => player.reputation)).toEqual([20, 20])
    expect(Object.values(state.players).map((player) => player.deck.length)).toEqual([0, 0])
    expect(Object.values(state.players).map((player) => player.hand.length)).toEqual([10, 10])
    expect(Object.values(state.players).map((player) => player.reservedEnergy)).toEqual([3, 3])
    expect(countEvents(events)).toEqual({
      [GAME_EVENT_TYPE.MULLIGAN_COMPLETED]: 2,
      [GAME_EVENT_TYPE.ENERGY_CHANGED]: 72,
      [GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED]: 4,
      [GAME_EVENT_TYPE.CARD_DRAWN]: 12,
      [GAME_EVENT_TYPE.ROUND_STARTED]: 37,
      [GAME_EVENT_TYPE.ROUND_ENDED]: 36,
      [GAME_EVENT_TYPE.PLAYER_PASSED]: 72,
      [GAME_EVENT_TYPE.CARD_OBLITERATED]: 60,
      [GAME_EVENT_TYPE.GAME_OVER]: 1,
      [GAME_EVENT_TYPE.UNIT_PLAYED]: 0,
      [GAME_EVENT_TYPE.ATTACK_DECLARED]: 0,
      [GAME_EVENT_TYPE.BLOCKS_DECLARED]: 0,
      [GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED]: 0,
      [GAME_EVENT_TYPE.UNIT_DIED]: 0,
      [GAME_EVENT_TYPE.COMBAT_RESOLVED]: 0,
      [GAME_EVENT_TYPE.UNIT_OBLITERATED]: 0,
    })
  })
})

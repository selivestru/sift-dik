import { describe, expect, test } from 'vitest'

import { derekCard } from '../catalog/characters/derek'
import { josyCard } from '../catalog/characters/josy'
import { mayaCard } from '../catalog/characters/maya'
import { tremoloCard } from '../catalog/characters/tremolo'
import { alwaysAndForever } from '../catalog/spells/always-and-forever'
import { applyAction, createGame } from '../core'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
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

describe('Character: Maya', () => {
  test('summon takes Derek from the deck into hand', () => {
    const state = createGame([p1Cards(), { id: 'p2', cards: [mayaCard, derekCard] }], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    arrangeZones(state, p2Id, ['maya'], ['derek'])

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'derek')).toBeDefined()
    expect(afterPlay.players[p2Id]!.deck).toHaveLength(0)
  })

  test('summon does nothing when Derek is not in the deck', () => {
    const state = createGame([p1Cards(), { id: 'p2', cards: [mayaCard, derekCard] }], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    arrangeZones(state, p2Id, ['maya', 'derek'], [])

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'derek')).toBeDefined()
    expect(afterPlay.players[p2Id]!.deck).toHaveLength(0)
  })

  test('support grants the ally to the right +1|+1 this round', () => {
    const state = createGame([p1Cards(), { id: 'p2', cards: [mayaCard, derekCard] }], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterMaya = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    const backToP2 = applyAction(afterMaya, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterDerek = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const backToP2Again = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const mayaOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'maya')!
    const derekOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'derek')!

    const attackState = applyAction(backToP2Again, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [mayaOnBoard.instanceId, derekOnBoard.instanceId],
    }).state

    const derekSlot = attackState.combat!.slots.find(
      (s) => s.attacker.instanceId === derekOnBoard.instanceId,
    )!

    expect(derekSlot.attacker.attack).toBe(3)
    expect(derekSlot.attacker.health).toBe(4)
    expect(derekSlot.attacker.tempAttack).toBe(1)
    expect(derekSlot.attacker.tempHealth).toBe(1)
  })

  test('Maya grants Josy +2|+2 instead of +1|+1', () => {
    const state = createGame([p1Cards(), { id: 'p2', cards: [mayaCard, josyCard] }], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterMaya = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    const backToP2 = applyAction(afterMaya, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterJosy = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const backToP2Again = applyAction(afterJosy, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const mayaOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'maya')!
    const josyOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'josy')!

    const attackState = applyAction(backToP2Again, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [mayaOnBoard.instanceId, josyOnBoard.instanceId],
    }).state

    const josySlot = attackState.combat!.slots.find(
      (s) => s.attacker.instanceId === josyOnBoard.instanceId,
    )!

    expect(josySlot.attacker.attack).toBe(3)
    expect(josySlot.attacker.health).toBe(4)
    expect(josySlot.attacker.tempAttack).toBe(2)
    expect(josySlot.attacker.tempHealth).toBe(2)
  })

  test('Tremolo support stays at +1|+1 even for Josy', () => {
    const state = createGame([p1Cards(), { id: 'p2', cards: [tremoloCard, josyCard] }], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterTremolo = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'tremolo')!.instanceId,
      abilityContexts: { tremolo_path: { chosenPath: 'chick' } },
    }).state

    const backToP2 = applyAction(afterTremolo, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterJosy = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const backToP2Again = applyAction(afterJosy, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const tremoloOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'tremolo')!
    const josyOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'josy')!

    const attackState = applyAction(backToP2Again, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [tremoloOnBoard.instanceId, josyOnBoard.instanceId],
    }).state

    const josySlot = attackState.combat!.slots.find(
      (s) => s.attacker.instanceId === josyOnBoard.instanceId,
    )!

    expect(josySlot.attacker.tempAttack).toBe(1)
    expect(josySlot.attacker.tempHealth).toBe(1)
  })

  test('allied Derek dying grants Vulnerable to the strongest enemy permanently', () => {
    const state = createGame(
      [
        p1Cards(
          createUnit({
            id: 'strong-blocker',
            attack: 3,
            baseAttack: 3,
            baseHealth: 3,
            health: 3,
            maxHealth: 3,
          }),
          createUnit({ id: 'weak-unit', attack: 1, baseAttack: 1 }),
        ),
        { id: 'p2', cards: [mayaCard, derekCard] },
      ],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10

    const afterMaya = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    const afterStrong = applyAction(afterMaya, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterMaya.players[p1Id]!.hand.find((c) => c.id === 'strong-blocker')!
        .instanceId,
    }).state

    const afterDerek = applyAction(afterStrong, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterStrong.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const afterWeak = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterDerek.players[p1Id]!.hand.find((c) => c.id === 'weak-unit')!.instanceId,
    }).state

    const derekOnBoard = afterWeak.players[p2Id]!.board.find((u) => u.id === 'derek')!

    const attackState = applyAction(afterWeak, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [derekOnBoard.instanceId],
    }).state

    const strongBlocker = attackState.players[p1Id]!.board.find((u) => u.id === 'strong-blocker')!

    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [
        {
          attackerInstanceId: derekOnBoard.instanceId,
          defenderInstanceId: strongBlocker.instanceId,
        },
      ],
    }).state

    const strikePass = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockState.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    }).state

    expect(combatResult.players[p2Id]!.graveyard.find((u) => u.id === 'derek')).toBeDefined()

    const markedUnit = combatResult.players[p1Id]!.board.find((u) => u.id === 'strong-blocker')!

    expect(markedUnit.keywords).toContain(KEYWORD.VULNERABLE)

    const round2 = finishRound(combatResult)

    const stillMarked = round2.players[p1Id]!.board.find((u) => u.id === 'strong-blocker')!

    expect(stillMarked.keywords).toContain(KEYWORD.VULNERABLE)
  })

  test('Always and Forever grants Barrier that expires at round end', () => {
    const state = createGame(
      [p1Cards(), { id: 'p2', cards: [mayaCard, derekCard, alwaysAndForever] }],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterMaya = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    const backToP2 = applyAction(afterMaya, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const mayaOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'maya')!

    const burstResult = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.ALWAYS_AND_FOREVER,
      )!.instanceId,
      targets: [mayaOnBoard.instanceId],
    })

    const shieldedMaya = burstResult.state.players[p2Id]!.board.find((u) => u.id === 'maya')!

    expect(shieldedMaya.keywords).toContain(KEYWORD.BARRIER)
    expect(burstResult.state.spellStack).toHaveLength(0)

    const round2 = finishRound(burstResult.state)

    const mayaAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'maya')!

    expect(mayaAfterRound.keywords ?? []).not.toContain(KEYWORD.BARRIER)
  })
})

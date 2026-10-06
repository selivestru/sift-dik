import { describe, expect, test } from 'vitest'

import { elenaCard } from '../catalog/characters/elena'
import { johnBoyCard } from '../catalog/characters/john-boy'
import { signatureDish } from '../catalog/spells/signature-dish'
import { waterGun } from '../catalog/spells/water-gun'
import { applyAction } from '../core'
import { createGame } from './scenario'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
  type GameState,
  type UnitCard,
  type UnitCardInstance,
} from '../types'

const unit = (id: string, card: UnitCard = johnBoyCard): UnitCardInstance => ({
  ...structuredClone(card),
  instanceId: id,
  ownerId: 'p1',
})

const setup = (): GameState => {
  const state = createGame(
    [
      { id: 'p1', cards: Array.from({ length: 12 }, () => johnBoyCard) },
      { id: 'p2', cards: Array.from({ length: 12 }, () => johnBoyCard) },
    ],
    { seed: 42 },
  )
  state.turnPlayerId = 'p1'
  state.players.p1!.hasAttackToken = true
  state.players.p1!.energy = 10
  state.players.p2!.energy = 10
  state.players.p1!.hand = [{ ...signatureDish, instanceId: 'dish', ownerId: 'p1' }]
  return state
}

const resolveWindow = (state: GameState) => {
  const first = applyAction(state, { type: GAME_ACTION_TYPE.PASS, playerId: state.turnPlayerId })
  if (state.spellStack.length || state.combat || first.state.winnerPlayerId !== null) return first
  return applyAction(first.state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: first.state.turnPlayerId,
  })
}

const attack = (state: GameState, attackers = state.players.p1!.board.map((u) => u.instanceId)) =>
  applyAction(state, { type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'p1', attackers })

const castDish = (state: GameState, targets?: string[]) =>
  applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_SPELL,
    playerId: 'p1',
    cardInstanceId: 'dish',
    targets,
  })

describe('Character: John Boy', () => {
  test('support fully heals both participants to their current maximum and leaves input unchanged', () => {
    const state = setup()
    const john = unit('john')
    const ally = unit('ally', { ...elenaCard, id: 'other', abilities: [] })
    john.health = 1
    john.maxHealth = 6
    john.tempHealth = 2
    ally.health = 2
    ally.maxHealth = 5
    state.players.p1!.board = [john, ally]
    const original = structuredClone(state)
    const result = attack(state)
    expect(result.state.combat!.slots.map((s) => s.attacker.health)).toEqual([6, 5])
    expect(result.events).toEqual([
      { type: 'HEAL_DEALT', targetId: 'john', amount: 5, isReputation: false },
      { type: 'HEAL_DEALT', targetId: 'ally', amount: 3, isReputation: false },
    ])
    expect(result.state.combat!.slots[1]!.attacker.keywords ?? []).not.toContain(KEYWORD.BARRIER)
    expect(state).toEqual(original)
  })

  test('support has no effect without an attacking ally to the right', () => {
    const state = setup()
    state.players.p1!.board = [unit('john'), unit('bench', { ...elenaCard, abilities: [] })]
    state.players.p1!.board[0]!.health = 1
    const result = attack(state, ['john'])
    expect(result.state.combat!.slots[0]!.attacker.health).toBe(1)
    expect(result.events).toEqual([])
    expect(result.state.players.p1!.board[0]!.keywords ?? []).not.toContain(KEYWORD.BARRIER)
  })

  test('supports only the immediately adjacent attacker', () => {
    const state = setup()
    state.players.p1!.board = [
      unit('john'),
      unit('middle', { ...elenaCard, id: 'other', abilities: [] }),
      unit('elena', { ...elenaCard, abilities: [] }),
    ]
    state.players.p1!.board[1]!.health = 1
    state.players.p1!.board[2]!.health = 1
    const result = attack(state)
    expect(result.state.combat!.slots[1]!.attacker.health).toBe(3)
    expect(result.state.combat!.slots[2]!.attacker.health).toBe(1)
    expect(result.state.combat!.slots[2]!.attacker.keywords ?? []).not.toContain(KEYWORD.BARRIER)
  })

  test('grants Barrier to healthy Elena without producing healing events and Barrier expires', () => {
    const state = setup()
    state.players.p1!.board = [unit('john'), unit('elena', elenaCard)]
    const declared = attack(state)
    expect(declared.events).toEqual([])
    expect(declared.state.combat!.slots[1]!.attacker.keywords).toContain(KEYWORD.BARRIER)
    const completed = resolveWindow(declared.state).state
    const nextRound = resolveWindow(completed).state
    expect(
      nextRound.players.p1!.board.find((u) => u.instanceId === 'elena')!.keywords ?? [],
    ).not.toContain(KEYWORD.BARRIER)
  })

  test('Barrier on supported Elena absorbs the next damage and can be granted again', () => {
    const state = setup()
    state.players.p1!.board = [unit('john'), unit('elena', elenaCard)]
    const declared = attack(state).state
    declared.players.p2!.hand = [{ ...waterGun, instanceId: 'gun', ownerId: 'p2' }]
    const damaged = applyAction(declared, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: 'p2',
      cardInstanceId: 'gun',
      targets: ['elena'],
    })
    expect(damaged.state.combat!.slots[1]!.attacker.health).toBe(3)
    expect(damaged.state.combat!.slots[1]!.attacker.keywords ?? []).not.toContain(KEYWORD.BARRIER)
    const finished = resolveWindow(damaged.state).state
    finished.turnPlayerId = 'p1'
    finished.players.p1!.hasAttackToken = true
    const repeated = attack(finished)
    const elena = repeated.state.combat!.slots[1]!.attacker
    expect(elena.keywords!.filter((k) => k === KEYWORD.BARRIER)).toHaveLength(1)
    expect(elena.tempKeywords!.filter((k) => k === KEYWORD.BARRIER)).toHaveLength(1)
  })
})

describe('Spell: Signature Dish', () => {
  test('heals a board ally when the opponent accepts the sequence, spends Reserved Energy first and enters graveyard', () => {
    const state = setup()
    state.players.p1!.board = [unit('john')]
    state.players.p1!.board[0]!.health = 1
    state.players.p1!.reservedEnergy = 2
    const cast = castDish(state, ['john'])
    expect(cast.state.players.p1!.board[0]!.health).toBe(1)
    expect(cast.state.players.p1!.reservedEnergy).toBe(0)
    expect(cast.state.players.p1!.energy).toBe(9)
    expect(cast.state.turnPlayerId).toBe('p2')
    expect(cast.state.spellStack).toHaveLength(1)
    const resolved = resolveWindow(cast.state)
    expect(resolved.state.players.p1!.board[0]!.health).toBe(4)
    expect(resolved.events).toContainEqual({
      type: 'HEAL_DEALT',
      targetId: 'john',
      amount: 3,
      isReputation: false,
    })
    expect(resolved.state.players.p1!.graveyard.map((c) => c.instanceId)).toContain('dish')
  })

  test.each(['attacker', 'blocker'])('heals an allied %s in combat before strikes', (role) => {
    const state = setup()
    const ally = unit('ally')
    ally.health = 1
    const enemy = { ...unit('enemy'), ownerId: 'p2', abilities: [] }
    state.combat = {
      attackerPlayerId: role === 'attacker' ? 'p1' : 'p2',
      defenderPlayerId: role === 'attacker' ? 'p2' : 'p1',
      blocksDeclared: true,
      slots: [
        {
          attacker: role === 'attacker' ? ally : enemy,
          blocker: role === 'blocker' ? ally : enemy,
        },
      ],
    }
    const result = resolveWindow(castDish(state, ['ally']).state)
    expect(result.state.combat).toBeNull()
    expect(result.state.players.p1!.board.find((unit) => unit.instanceId === 'ally')!.health).toBe(2)
    expect(result.events).toContainEqual({ type: 'HEAL_DEALT', targetId: 'ally', amount: 3, isReputation: false })
    expect(result.state.round).toBe(1)
  })

  test('a healthy ally produces no healing event', () => {
    const state = setup()
    state.players.p1!.board = [unit('john')]
    expect(resolveWindow(castDish(state, ['john']).state).events).toEqual([])
  })

  test.each([undefined, [], ['unknown'], ['p1'], ['p2'], ['dish'], ['enemy'], ['john', 'john']])(
    'rejects invalid targets %j without changing the input',
    (targets) => {
      const state = setup()
      state.players.p1!.board = [unit('john')]
      state.players.p2!.board = [{ ...unit('enemy'), ownerId: 'p2' }]
      const original = structuredClone(state)
      expect(() => castDish(state, targets)).toThrow()
      expect(state).toEqual(original)
    },
  )

  test('a target killed by a response causes resolution without healing or an exception', () => {
    const state = setup()
    state.players.p1!.board = [unit('john')]
    state.players.p1!.board[0]!.health = 1
    state.players.p2!.hand = [{ ...waterGun, instanceId: 'gun', ownerId: 'p2' }]
    const cast = castDish(state, ['john'])
    const response = applyAction(cast.state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: 'p2',
      cardInstanceId: 'gun',
      targets: ['john'],
    })
    const resolved = resolveWindow(response.state)
    expect(resolved.events).toEqual([])
    expect(resolved.state.spellStack).toEqual([])
    expect(resolved.state.players.p1!.graveyard.map((c) => c.instanceId)).toEqual(['john', 'dish'])
  })
})

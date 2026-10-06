import { describe, expect, test } from 'vitest'

import { derekCard } from '../catalog/characters/derek'
import { elenaCard } from '../catalog/characters/elena'
import { johnBoyCard } from '../catalog/characters/john-boy'
import { mayaCard } from '../catalog/characters/maya'
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
import { ABILITY } from '../types/abilities.types'

const unit = (id: string, card: UnitCard = elenaCard): UnitCardInstance => ({
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
  state.players.p1!.energy = 10
  state.players.p2!.energy = 10
  state.players.p1!.hasAttackToken = true
  state.players.p1!.hand = [unit('elena')]
  return state
}

const summon = (state: GameState, id = 'elena') =>
  applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: 'p1',
    cardInstanceId: id,
  })

const attack = (state: GameState) =>
  applyAction(state, {
    type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
    playerId: 'p1',
    attackers: state.players.p1!.board.map((u) => u.instanceId),
  })

const resolveWindow = (state: GameState) => {
  const first = applyAction(state, { type: GAME_ACTION_TYPE.PASS, playerId: state.turnPlayerId })
  if (state.spellStack.length || state.combat || first.state.winnerPlayerId !== null) return first
  return applyAction(first.state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: first.state.turnPlayerId,
  })
}

const castGun = (state: GameState, targets?: string[]) => {
  state.players.p1!.hand.push({ ...waterGun, instanceId: 'gun', ownerId: 'p1' })
  return applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_SPELL,
    playerId: 'p1',
    cardInstanceId: 'gun',
    targets,
  })
}

describe('Character: Elena', () => {
  test('summon without John Boy keeps printed stats', () => {
    const result = summon(setup())
    expect(result.state.players.p1!.board[0]).toMatchObject({ attack: 2, health: 3, maxHealth: 3 })
  })

  test.each([1, 2, 3])('summon buffs all %i allied John Boys but Elena only once', (count) => {
    const state = setup()
    state.players.p1!.board = Array.from({ length: count }, (_, i) =>
      unit(`john-${i}`, johnBoyCard),
    )
    state.players.p1!.board[0]!.health = 1
    const original = structuredClone(state)
    const result = summon(state)
    const board = result.state.players.p1!.board
    expect(board.find((u) => u.id === 'elena')).toMatchObject({
      attack: 3,
      health: 4,
      maxHealth: 4,
      baseAttack: 2,
      baseHealth: 3,
    })
    for (let i = 0; i < count; i++) {
      expect(board[i]).toMatchObject({
        attack: 3,
        health: i === 0 ? 2 : 5,
        maxHealth: 5,
        baseHealth: 4,
      })
    }
    const nextRound = resolveWindow(result.state).state
    expect(nextRound.players.p1!.board.find((u) => u.id === 'elena')!.attack).toBe(3)
    expect(nextRound.players.p1!.board[0]!.maxHealth).toBe(5)
    expect(state).toEqual(original)
  })

  test('ignores enemy John Boys and John Boys in hand and deck', () => {
    const state = setup()
    state.players.p2!.board = [{ ...unit('enemy-john', johnBoyCard), ownerId: 'p2' }]
    state.players.p1!.hand.push(unit('hand-john', johnBoyCard))
    const result = summon(state)
    expect(result.state.players.p1!.board[0]!.attack).toBe(2)
    expect(result.state.players.p2!.board[0]!.attack).toBe(2)
    expect(result.state.players.p1!.hand[0]!.cost).toBe(3)
    expect(result.state.players.p1!.deck.every((c) => c.type === 'unit' && c.attack === 2)).toBe(
      true,
    )
  })

  test('another Elena summon buffs John Boy again without buffing the earlier Elena', () => {
    const state = setup()
    state.players.p1!.board = [unit('john', johnBoyCard)]
    const first = summon(state).state
    first.turnPlayerId = 'p1'
    first.players.p1!.hand.push(unit('elena-2'))
    const second = summon(first, 'elena-2').state
    expect(second.players.p1!.board.map((u) => u.attack)).toEqual([4, 3, 3])
    expect(second.players.p1!.board.map((u) => u.maxHealth)).toEqual([6, 4, 4])
  })

  test('support grants temporary Tough to both attackers and it expires next round', () => {
    const state = setup()
    state.players.p1!.board = [unit('elena'), unit('ally', { ...johnBoyCard, abilities: [] })]
    const declared = attack(state).state
    for (const slot of declared.combat!.slots) {
      expect(slot.attacker.keywords).toContain(KEYWORD.TOUGH)
      expect(slot.attacker.tempKeywords).toContain(KEYWORD.TOUGH)
    }
    const completed = resolveWindow(declared).state
    const nextRound = resolveWindow(completed).state
    for (const u of nextRound.players.p1!.board) {
      expect(u.keywords ?? []).not.toContain(KEYWORD.TOUGH)
    }
  })

  test('support does nothing when Elena is the rightmost attacker', () => {
    const state = setup()
    state.players.p1!.board = [unit('elena')]
    expect(attack(state).state.combat!.slots[0]!.attacker.keywords ?? []).not.toContain(
      KEYWORD.TOUGH,
    )
  })

  test('support preserves permanent Tough and repeated support never duplicates keywords', () => {
    const state = setup()
    state.players.p1!.board = [
      unit('elena'),
      unit('ally', { ...johnBoyCard, abilities: [], keywords: [KEYWORD.TOUGH] }),
    ]
    const declared = attack(state).state
    expect(declared.combat!.slots[1]!.attacker.tempKeywords ?? []).not.toContain(KEYWORD.TOUGH)
    const completed = resolveWindow(declared).state
    completed.turnPlayerId = 'p1'
    completed.players.p1!.hasAttackToken = true
    const repeated = attack(completed).state
    expect(
      repeated.combat!.slots[0]!.attacker.keywords!.filter((k) => k === KEYWORD.TOUGH),
    ).toHaveLength(1)
    expect(
      repeated.combat!.slots[0]!.attacker.tempKeywords!.filter((k) => k === KEYWORD.TOUGH),
    ).toHaveLength(1)
    const nextRound = resolveWindow(resolveWindow(repeated).state).state
    expect(nextRound.players.p1!.board.find((u) => u.instanceId === 'ally')!.keywords).toContain(
      KEYWORD.TOUGH,
    )
    expect(
      nextRound.players.p1!.board.find((u) => u.instanceId === 'elena')!.keywords ?? [],
    ).not.toContain(KEYWORD.TOUGH)
  })

  test('John Boy and Elena support effects resolve together from left to right', () => {
    const state = setup()
    state.players.p1!.board = [
      unit('john', johnBoyCard),
      unit('elena'),
      unit('ally', { ...johnBoyCard, abilities: [] }),
    ]
    state.players.p1!.board[0]!.health = 1
    state.players.p1!.board[1]!.health = 1
    const slots = attack(state).state.combat!.slots
    expect(slots[0]!.attacker.health).toBe(4)
    expect(slots[1]!.attacker).toMatchObject({
      health: 3,
      keywords: [KEYWORD.BARRIER, KEYWORD.TOUGH],
    })
    expect(slots[2]!.attacker.keywords).toContain(KEYWORD.TOUGH)
  })
})

describe('Spell: Water Gun', () => {
  test('successful burst cast leaves its input state unchanged', () => {
    const state = setup()
    state.players.p1!.hand.push({ ...waterGun, instanceId: 'gun', ownerId: 'p1' })
    const original = structuredClone(state)
    applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: 'p1',
      cardInstanceId: 'gun',
      targets: ['p2'],
    })
    expect(state).toEqual(original)
  })

  test.each(['p1', 'p2', 'ally', 'enemy'])(
    'deals 1 damage to %s instantly and retains priority',
    (targetId) => {
      const state = setup()
      state.players.p1!.board = [unit('ally')]
      state.players.p2!.board = [{ ...unit('enemy'), ownerId: 'p2' }]
      state.players.p1!.reservedEnergy = 1
      state.consecutivePasses = 1
      const result = castGun(state, [targetId])
      expect(result.state.turnPlayerId).toBe('p1')
      expect(result.state.consecutivePasses).toBe(1)
      expect(result.state.spellStack).toEqual([])
      expect(result.state.players.p1!.reservedEnergy).toBe(0)
      expect(result.state.players.p1!.energy).toBe(10)
      expect(result.state.players.p1!.graveyard.map((c) => c.instanceId)).toContain('gun')
      expect(result.events).toContainEqual({
        type: 'DAMAGE_DEALT',
        targetId,
        amount: 1,
        isReputation: targetId.startsWith('p'),
      })
      if (targetId.startsWith('p')) expect(result.state.players[targetId]!.reputation).toBe(19)
      else
        expect(
          (targetId === 'ally' ? result.state.players.p1 : result.state.players.p2)!.board[0]!
            .health,
        ).toBe(2)
    },
  )

  test.each(['attacker', 'blocker'])(
    'can damage a combat %s while another spell is on the stack',
    (role) => {
      const state = setup()
      state.combat = {
        attackerPlayerId: 'p1',
        defenderPlayerId: 'p2',
        blocksDeclared: true,
        slots: [{ attacker: unit('attacker'), blocker: { ...unit('blocker'), ownerId: 'p2' } }],
      }
      state.spellStack = [
        { spell: { ...signatureDish, ownerId: 'p1', instanceId: 'dish' }, targets: ['attacker'] },
      ]
      const result = castGun(state, [role])
      const slot = result.state.combat!.slots[0]!
      expect((role === 'attacker' ? slot.attacker : slot.blocker)!.health).toBe(2)
      expect(result.state.spellStack).toHaveLength(1)
      expect(result.state.round).toBe(1)
    },
  )

  test.each([KEYWORD.TOUGH, KEYWORD.BARRIER])('respects %s', (keyword) => {
    const state = setup()
    state.players.p1!.board = [unit('ally', { ...elenaCard, keywords: [keyword] })]
    const result = castGun(state, ['ally'])
    expect(result.state.players.p1!.board[0]!.health).toBe(3)
    expect(result.events).toContainEqual({
      type: 'DAMAGE_DEALT',
      targetId: 'ally',
      amount: 0,
      isReputation: false,
    })
    expect(result.state.players.p1!.board[0]!.keywords ?? []).toEqual(
      keyword === KEYWORD.BARRIER ? [] : [keyword],
    )
  })

  test('kills an allied Maya and dispatches Derek revenge', () => {
    const state = setup()
    state.players.p1!.board = [unit('derek', derekCard), { ...unit('maya', mayaCard), health: 1 }]
    const result = castGun(state, ['maya'])
    expect(result.state.players.p1!.board[0]).toMatchObject({
      attack: 4,
      health: 5,
      maxHealth: 5,
      keywords: [KEYWORD.OVERWHELM],
    })
    expect(result.state.players.p1!.graveyard.map((c) => c.instanceId)).toContain('maya')
    expect(result.events).toContainEqual({ type: 'UNIT_DIED', unitInstanceId: 'maya' })
  })

  test.each(['attacker', 'blocker'])('removes a killed %s from combat', (role) => {
    const state = setup()
    state.combat = {
      attackerPlayerId: 'p1',
      defenderPlayerId: 'p2',
      blocksDeclared: true,
      slots: [
        {
          attacker: { ...unit('attacker'), health: 1 },
          blocker: { ...unit('blocker'), ownerId: 'p2', health: 1 },
        },
      ],
    }
    const result = castGun(state, [role])
    if (role === 'attacker') expect(result.state.combat!.slots).toEqual([])
    else expect(result.state.combat!.slots[0]!.blocker).toBeNull()
    expect(
      result.state.players[role === 'attacker' ? 'p1' : 'p2']!.graveyard.map((c) => c.instanceId),
    ).toContain(role)
  })

  test.each(['p1', 'p2'])(
    'lethal damage to %s Reputation awards the opponent victory without strike triggers',
    (targetId) => {
      const state = setup()
      state.players[targetId]!.reputation = 1
      state.players.p1!.board = [unit('charm', { ...elenaCard, abilities: [ABILITY.LEON_CHARM] })]
      const result = castGun(state, [targetId])
      const winner = targetId === 'p1' ? 'p2' : 'p1'
      expect(result.state.winnerPlayerId).toBe(winner)
      expect(result.events).toContainEqual({ type: 'GAME_OVER', winnerPlayerId: winner })
      expect(result.state.players.p1!.reservedEnergy).toBe(0)
      expect(result.events.filter((e) => e.type === 'ENERGY_CHANGED' && e.isReserved)).toEqual([])
    },
  )

  test.each([undefined, [], ['unknown'], ['elena'], ['gun'], ['p1', 'p2'], ['toString']])(
    'rejects invalid targets %j without modifying input',
    (targets) => {
      const state = setup()
      state.players.p1!.hand.push({ ...waterGun, instanceId: 'gun', ownerId: 'p1' })
      const original = structuredClone(state)
      expect(() =>
        applyAction(state, {
          type: GAME_ACTION_TYPE.PLAY_SPELL,
          playerId: 'p1',
          cardInstanceId: 'gun',
          targets,
        }),
      ).toThrow()
      expect(state).toEqual(original)
    },
  )
})

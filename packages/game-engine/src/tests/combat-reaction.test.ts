import { describe, expect, test } from 'vitest'
import { preemptiveStrike } from '../catalog/spells/preemptive-strike'
import { tempStun } from '../catalog/spells/temp-stun'
import { applyAction } from '../core'
import { GAME_ACTION_TYPE, type GameState } from '../types'
import { battle } from './scenario'

const attack = (state: GameState) => applyAction(state, {
  type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'p1', attackers: ['a'],
})
const block = (state: GameState) => applyAction(state, {
  type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2',
  blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }],
})

describe('Combat commitments', () => {
  test('an open attack gives the defender a blocking window', () => {
    const state = battle()
    const result = attack(state)
    expect(result.state.turnPlayerId).toBe('p2')
    expect(result.state.combat!.blocksDeclared).toBe(false)
    expect(result.state.players.p1!.hasAttackToken).toBe(false)
    expect(() => applyAction(result.state, { type: GAME_ACTION_TYPE.PLAY_UNIT, playerId: 'p2', cardInstanceId: result.state.players.p2!.hand[0]!.instanceId })).toThrow('combat')
  })

  test('committing blocks without response spells resolves immediately', () => {
    const result = block(attack(battle()).state)
    expect(result.state.combat).toBeNull()
    expect(result.state.players.p1!.board[0]!.health).toBe(3)
    expect(result.state.players.p2!.board[0]!.health).toBe(1)
    expect(result.state.turnPlayerId).toBe('p2')
    expect(result.state.round).toBe(1)
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.events.filter((event) => event.type === 'DAMAGE_DEALT')).toHaveLength(2)
  })

  test('passing on an attack commits no blocks and resolves damage', () => {
    const state = attack(battle()).state
    const result = applyAction(state, { type: GAME_ACTION_TYPE.PASS, playerId: 'p2' })
    expect(result.state.combat).toBeNull()
    expect(result.state.players.p2!.reputation).toBe(17)
    expect(result.state.turnPlayerId).toBe('p2')
    expect(result.state.round).toBe(1)
  })

  test('defender commits blocks and Fast spells together; attacker gets a response', () => {
    const state = battle()
    state.players.p2!.hand.push({ ...preemptiveStrike, instanceId: 'buff', ownerId: 'p2' })
    const result = applyAction(attack(state).state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2',
      blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }],
      spells: [{ cardInstanceId: 'buff', targets: ['b'] }],
    })
    expect(result.state.turnPlayerId).toBe('p1')
    expect(result.state.combat!.blocksDeclared).toBe(true)
    expect(result.state.combat!.slots[0]!.blocker!.health).toBe(4)
    expect(result.state.spellStack).toHaveLength(1)
    const resolved = applyAction(result.state, { type: GAME_ACTION_TYPE.PASS, playerId: 'p1' })
    expect(resolved.state.combat).toBeNull()
    expect(resolved.state.players.p2!.board[0]!.health).toBe(2)
    expect(resolved.state.players.p1!.board[0]!.health).toBe(1)
    expect(resolved.state.turnPlayerId).toBe('p2')
  })

  test('attacker can answer a defending Fast spell; the entire stack precedes combat', () => {
    const state = battle()
    state.players.p2!.hand.push({ ...preemptiveStrike, instanceId: 'buff', ownerId: 'p2' })
    state.players.p1!.hand.push({ ...tempStun, instanceId: 'stun', ownerId: 'p1' })
    const blocked = applyAction(attack(state).state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2',
      blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }],
      spells: [{ cardInstanceId: 'buff', targets: ['b'] }],
    }).state
    const reply = applyAction(blocked, { type: GAME_ACTION_TYPE.PLAY_SPELL, playerId: 'p1', cardInstanceId: 'stun', targets: ['b'] }).state
    const resolved = applyAction(reply, { type: GAME_ACTION_TYPE.PASS, playerId: 'p2' })
    expect(resolved.state.combat).toBeNull()
    expect(resolved.state.spellStack).toEqual([])
    expect(resolved.state.players.p2!.reputation).toBe(20)
    expect(resolved.state.players.p2!.board[0]!.health).toBe(5)
    expect(resolved.state.players.p2!.board[0]!.keywords).toContain('stunned')
    expect(resolved.events.some((event) => event.type === 'DAMAGE_DEALT')).toBe(false)
  })

  test('attacking Fast spells and attackers commit together; defense may accept both', () => {
    const state = battle()
    state.players.p1!.hand.push({ ...preemptiveStrike, instanceId: 'buff', ownerId: 'p1' })
    const committed = applyAction(state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'p1', attackers: ['a'],
      spells: [{ cardInstanceId: 'buff', targets: ['a'] }],
    }).state
    expect(committed.turnPlayerId).toBe('p2')
    const resolved = block(committed)
    expect(resolved.state.combat).toBeNull()
    expect(resolved.state.players.p2!.graveyard.some((card) => card.instanceId === 'b')).toBe(true)
    expect(resolved.state.players.p1!.board[0]!.health).toBe(5)
    expect(resolved.state.round).toBe(1)
  })

  test('committed blockers cannot be reassigned during the response window', () => {
    const state = battle()
    state.players.p2!.hand.push({ ...preemptiveStrike, instanceId: 'buff', ownerId: 'p2' })
    const blocked = applyAction(attack(state).state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2',
      blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }],
      spells: [{ cardInstanceId: 'buff', targets: ['b'] }],
    }).state
    expect(() => block(blocked)).toThrow('already been declared')
  })

  test('invalid spells in a defense commitment leave blockers, energy and hand unchanged', () => {
    const state = attack(battle()).state
    const before = structuredClone(state)
    expect(() => applyAction(state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2',
      blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }],
      spells: [{ cardInstanceId: 'missing' }],
    })).toThrow('not found')
    expect(state).toEqual(before)
  })
})

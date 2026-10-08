import { describe, expect, it } from 'vitest'

import { resolveCombat } from '../core/resolve-combat'
import { CARD_FACTION, CARD_TYPE, type UnitCardInstance } from '../types/card.types'
import { GAME_EVENT_TYPE, type GameEvent } from '../types/event.types'
import { COMBAT_STAGE, PHASE, type GameState, type PlayerState } from '../types/game-state.types'

function unit(id: string, ownerId: string, attack: number, health: number): UnitCardInstance {
  return {
    id: 'unit',
    instanceId: id,
    ownerId,
    type: CARD_TYPE.UNIT,
    faction: CARD_FACTION.OTHER,
    cost: 1,
    attack,
    health,
    baseHealth: health,
  }
}

function player(id: string, board: UnitCardInstance[]): PlayerState {
  return {
    id,
    board,
    reputation: 20,
    maxEnergy: 3,
    energy: 1,
    reservedEnergy: 0,
    mulliganCompleted: true,
    hasAttackToken: false,
    deck: [],
    hand: [],
    graveyard: [],
  }
}

function makeGame(): GameState {
  return {
    phase: PHASE.PLAYING,
    round: 3,
    rngState: 123,
    initiativePlayerId: 'a',
    turnPlayerId: 'a',
    consecutivePasses: 1,
    winnerPlayerId: null,
    players: {
      a: player('a', [unit('attacker', 'a', 3, 2)]),
      b: player('b', [unit('blocker', 'b', 2, 4)]),
    },
    combat: {
      attackerPlayerId: 'a',
      defenderPlayerId: 'b',
      stage: COMBAT_STAGE.AWAITING_RESPONSE,
      slots: [{ attackerId: 'attacker', blockerId: 'blocker' }],
    },
  }
}

describe('resolve combat', () => {
  it('exchanges damage before removing the attacker and gives the defender priority', () => {
    const state = makeGame()
    const events: GameEvent[] = [{ type: GAME_EVENT_TYPE.PLAYER_PASSED, playerId: 'a' }]
    const result = resolveCombat(state, events)

    expect(result.state).toBe(state)
    expect(result.events).toBe(events)
    expect(state.players.a.board).toEqual([])
    expect(state.players.a.graveyard).toEqual([{ ...unit('attacker', 'a', 3, 2), health: 0 }])
    expect(state.players.a.graveyard[0].baseHealth).toBe(2)
    expect(state.players.b.board[0].health).toBe(1)
    expect(state.players.b.graveyard).toEqual([])
    expect(state.players.b.reputation).toBe(20)
    expect(state.combat).toBeNull()
    expect(state.turnPlayerId).toBe('b')
    expect(state.consecutivePasses).toBe(0)
    expect(state.phase).toBe(PHASE.PLAYING)
    expect(state.round).toBe(3)
    expect(state.initiativePlayerId).toBe('a')
    expect(state.rngState).toBe(123)
    expect(state.players.a.energy).toBe(1)
    expect(state.players.a.hasAttackToken).toBe(false)
    expect(events).toEqual([
      { type: GAME_EVENT_TYPE.PLAYER_PASSED, playerId: 'a' },
      {
        type: GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
        slotIndex: 0,
        attackerId: 'attacker',
        blockerId: 'blocker',
        strikes: [
          {
            sourceInstanceId: 'attacker',
            amount: 3,
            target: { type: 'unit', playerId: 'b', cardInstanceId: 'blocker', health: 1 },
          },
          {
            sourceInstanceId: 'blocker',
            amount: 2,
            target: { type: 'unit', playerId: 'a', cardInstanceId: 'attacker', health: 0 },
          },
        ],
      },
      { type: GAME_EVENT_TYPE.UNIT_DIED, playerId: 'a', cardInstanceId: 'attacker' },
      { type: GAME_EVENT_TYPE.COMBAT_RESOLVED, attackerPlayerId: 'a', defenderPlayerId: 'b' },
    ])
  })

  it('moves both units to their owners graveyards after a mutual kill', () => {
    const state = makeGame()
    state.players.b.board[0].health = 3
    const { events } = resolveCombat(state, [])
    expect(state.players.a.board).toEqual([])
    expect(state.players.b.board).toEqual([])
    expect(state.players.a.graveyard[0].health).toBe(0)
    expect(state.players.b.graveyard[0].health).toBe(0)
    expect(events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.UNIT_DIED,
      GAME_EVENT_TYPE.UNIT_DIED,
      GAME_EVENT_TYPE.COMBAT_RESOLVED,
    ])
  })

  it('keeps surviving units on the board with their damage', () => {
    const state = makeGame()
    state.players.a.board[0].health = 5
    resolveCombat(state, [])
    expect(state.players.a.board[0].health).toBe(3)
    expect(state.players.b.board[0].health).toBe(1)
    expect(state.players.a.graveyard).toEqual([])
    expect(state.players.b.graveyard).toEqual([])
  })

  it('resolves slots in attack order and preserves intermediate reputation for UI', () => {
    const state = makeGame()
    state.players.a.board.push(unit('second', 'a', 5, 3))
    state.combat!.slots = [
      { attackerId: 'second', blockerId: null },
      { attackerId: 'attacker', blockerId: null },
    ]
    const { events } = resolveCombat(state, [])
    expect(state.players.b.reputation).toBe(12)
    expect(state.players.a.board.map((card) => card.health)).toEqual([2, 3])
    expect(state.players.b.board[0].health).toBe(4)
    expect(events.slice(0, 2)).toMatchObject([
      {
        slotIndex: 0,
        attackerId: 'second',
        strikes: [
          {
            sourceInstanceId: 'second',
            amount: 5,
            target: { type: 'reputation', playerId: 'b', reputation: 15 },
          },
        ],
      },
      {
        slotIndex: 1,
        attackerId: 'attacker',
        strikes: [
          {
            sourceInstanceId: 'attacker',
            amount: 3,
            target: { type: 'reputation', playerId: 'b', reputation: 12 },
          },
        ],
      },
    ])
  })

  it('ends the game on lethal damage without resolving later slots', () => {
    const state = makeGame()
    state.players.b.reputation = 2
    state.players.a.board.push(unit('second', 'a', 5, 3))
    state.combat!.slots = [
      { attackerId: 'attacker', blockerId: null },
      { attackerId: 'second', blockerId: 'blocker' },
    ]
    const { events } = resolveCombat(state, [])
    expect(state.phase).toBe(PHASE.FINISHED)
    expect(state.winnerPlayerId).toBe('a')
    expect(state.players.b.reputation).toBe(-1)
    expect(state.players.b.board[0].health).toBe(4)
    expect(state.players.a.board[1].health).toBe(3)
    expect(state.combat).toBeNull()
    expect(events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_RESOLVED,
      GAME_EVENT_TYPE.GAME_OVER,
    ])
    expect(events.at(-1)).toEqual({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId: 'a' })
  })

  it('does not send a blocked attack to the Nexus when its blocker is missing', () => {
    const state = makeGame()
    state.players.b.board = []
    resolveCombat(state, [])
    expect(state.players.b.reputation).toBe(20)
    expect(state.players.a.board[0].health).toBe(2)
    expect(state.combat).toBeNull()
  })

  it('skips a removed attacker', () => {
    const state = makeGame()
    state.players.a.board = []
    resolveCombat(state, [])
    expect(state.players.b.board[0].health).toBe(4)
    expect(state.players.b.reputation).toBe(20)
  })

  it('does not record a strike from a unit with zero attack', () => {
    const state = makeGame()
    state.players.a.board[0].attack = 0
    const { events } = resolveCombat(state, [])
    expect(state.players.b.board[0].health).toBe(4)
    expect(events[0]).toMatchObject({ strikes: [{ sourceInstanceId: 'blocker', amount: 2 }] })
    const damageEvent = events.find(
      (event) => event.type === GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
    )
    expect(damageEvent?.strikes).toHaveLength(1)
  })

  it('rejects resolution without combat without changing state or events', () => {
    const state = makeGame()
    state.combat = null
    const before = structuredClone(state)
    const events: GameEvent[] = []
    expect(() => resolveCombat(state, events)).toThrow('No active combat')
    expect(state).toEqual(before)
    expect(events).toEqual([])
  })

  it.each([PHASE.MULLIGAN, PHASE.FINISHED])('rejects resolution in phase %s', (phase) => {
    const state = makeGame()
    state.phase = phase
    const before = structuredClone(state)
    const events: GameEvent[] = []
    expect(() => resolveCombat(state, events)).toThrow('Cannot resolve combat in this phase')
    expect(state).toEqual(before)
    expect(events).toEqual([])
  })
})

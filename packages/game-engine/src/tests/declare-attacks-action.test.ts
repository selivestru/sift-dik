import { describe, expect, it } from 'vite-plus/test'

import { MAX_UNITS_ON_BOARD } from '../constants/game'
import { applyAction } from '../core/apply-action'
import { gameActionSchema } from '../schemas/action.schema'
import { GAME_ACTION_TYPE } from '../types/action.types'
import { CARD_FACTION, CARD_TYPE, type UnitCardInstance } from '../types/card.types'
import { GAME_EVENT_TYPE } from '../types/event.types'
import { COMBAT_STAGE, PHASE, type GameState, type PlayerState } from '../types/game-state.types'

function makePlayer(id: string): PlayerState {
  const unit = (instanceId: string): UnitCardInstance => ({
    id: 'unit',
    instanceId,
    ownerId: id,
    type: CARD_TYPE.UNIT,
    faction: CARD_FACTION.OTHER,
    cost: 1,
    attack: 2,
    baseHealth: 3,
    health: 3,
  })

  return {
    id,
    reputation: 20,
    maxEnergy: 1,
    energy: 1,
    reservedEnergy: 0,
    mulliganCompleted: true,
    hasAttackToken: id === 'a',
    deck: [],
    hand: [unit(`${id}-hand`)],
    board: Array.from({ length: MAX_UNITS_ON_BOARD }, (_, i) => unit(`${id}-${i}`)),
    graveyard: [],
  }
}

function makeGame(): GameState {
  return {
    phase: PHASE.PLAYING,
    rngState: 123,
    round: 1,
    initiativePlayerId: 'a',
    turnPlayerId: 'a',
    consecutivePasses: 1,
    combat: null,
    winnerPlayerId: null,
    players: { a: makePlayer('a'), b: makePlayer('b') },
  }
}

describe('declare attacks action', () => {
  it('commits ordered attackers, spends the token and gives the defender priority', () => {
    const state = makeGame()
    const before = structuredClone(state)
    const attackers = state.players.a.board.map((unit) => unit.instanceId).reverse()
    const result = applyAction(state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: 'a',
      attackers,
    })

    expect(result.state.combat).toEqual({
      attackerPlayerId: 'a',
      defenderPlayerId: 'b',
      stage: COMBAT_STAGE.AWAITING_BLOCKS,
      slots: attackers.map((attackerId) => ({ attackerId, blockerId: null })),
    })
    expect(result.state.players.a.hasAttackToken).toBe(false)
    expect(result.state.turnPlayerId).toBe('b')
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.state.round).toBe(state.round)
    expect(result.state.initiativePlayerId).toBe(state.initiativePlayerId)
    expect(result.state.rngState).toBe(state.rngState)
    for (const id of ['a', 'b']) {
      expect(result.state.players[id]).toEqual({ ...state.players[id], hasAttackToken: false })
    }
    expect(result.events).toEqual([
      {
        type: GAME_EVENT_TYPE.ATTACK_DECLARED,
        attackerPlayerId: 'a',
        defenderPlayerId: 'b',
        attackerInstanceIds: attackers,
      },
    ])
    expect(state).toEqual(before)
    attackers.length = 0
    expect(result.state.combat?.slots).toHaveLength(MAX_UNITS_ON_BOARD)
    expect(result.events[0]).toMatchObject({
      attackerInstanceIds: before.players.a.board.map((unit) => unit.instanceId).reverse(),
    })
  })

  it('uses the attack token rather than round initiative to authorize an attack', () => {
    const state = makeGame()
    state.turnPlayerId = 'b'
    state.players.b.hasAttackToken = true
    const result = applyAction(state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: 'b',
      attackers: ['b-0'],
    })
    expect(result.state.combat?.attackerPlayerId).toBe('b')
    expect(result.state.turnPlayerId).toBe('a')
    expect(result.state.players.b.hasAttackToken).toBe(false)
  })

  it.each([
    ['hand', 'Attacker is not on player board'],
    ['opponent', 'Attacker is not on player board'],
    ['missing-unit', 'Attacker is not on player board'],
    ['no-token', 'Player does not have the attack token'],
    ['wrong-player', "Not player's turn"],
    ['missing-player', 'Player not found'],
    ['mulligan', 'Cannot declare attacks in this phase'],
    ['finished', 'Cannot declare attacks in this phase'],
    ['combat', 'Cannot declare attacks during combat'],
  ])('rejects %s without changing the input', (scenario, message) => {
    const state = makeGame()
    let playerId = 'a'
    let attackers = ['a-0']
    if (scenario === 'hand') attackers = ['a-hand']
    if (scenario === 'opponent') attackers = ['b-0']
    if (scenario === 'missing-unit') attackers = ['unknown']
    if (scenario === 'no-token') state.players.a.hasAttackToken = false
    if (scenario === 'wrong-player') state.turnPlayerId = 'b'
    if (scenario === 'missing-player') playerId = 'unknown'
    if (scenario === 'mulligan') state.phase = PHASE.MULLIGAN
    if (scenario === 'finished') state.phase = PHASE.FINISHED
    if (scenario === 'combat') {
      state.combat = {
        attackerPlayerId: 'a',
        defenderPlayerId: 'b',
        stage: COMBAT_STAGE.AWAITING_BLOCKS,
        slots: [{ attackerId: 'a-0', blockerId: null }],
      }
    }
    const before = structuredClone(state)
    expect(() =>
      applyAction(state, {
        type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
        playerId,
        attackers,
      }),
    ).toThrow(message)
    expect(state).toEqual(before)
  })

  it.each([
    { attackers: [], message: 'Must include at least one attacker' },
    { attackers: ['a-0', 'a-0'], message: 'Duplicate attackers' },
    {
      attackers: Array.from({ length: MAX_UNITS_ON_BOARD + 1 }, (_, i) => `a-${i}`),
      message: `Cannot attack more than ${MAX_UNITS_ON_BOARD} units`,
    },
  ])('returns a schema error for invalid attackers $attackers', ({ attackers, message }) => {
    const action = { type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'a', attackers }
    expect(gameActionSchema.safeParse(action).success).toBe(false)
    const state = makeGame()
    const before = structuredClone(state)
    expect(() => applyAction(state, action)).toThrow(message)
    expect(state).toEqual(before)
  })

  it.each([COMBAT_STAGE.AWAITING_BLOCKS, COMBAT_STAGE.AWAITING_RESPONSE])(
    'prevents the defender from playing or replacing a unit during %s',
    (stage) => {
      const state = applyAction(makeGame(), {
        type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
        playerId: 'a',
        attackers: ['a-0'],
      }).state
      state.combat!.stage = stage
      const before = structuredClone(state)
      expect(() =>
        applyAction(state, {
          type: GAME_ACTION_TYPE.PLAY_UNIT,
          playerId: 'b',
          cardInstanceId: 'b-hand',
          replaceInstanceId: 'b-0',
        }),
      ).toThrow('Cannot play units during combat')
      expect(state).toEqual(before)
    },
  )
})

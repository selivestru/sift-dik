import { describe, expect, it } from 'vitest'

import { MAX_UNITS_ON_BOARD } from '../constants/game'
import { applyAction } from '../core/apply-action'
import { gameActionSchema } from '../schemas/action.schema'
import { GAME_ACTION_TYPE, type DeclareBlocksAction } from '../types/action.types'
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
    health: 3,
    baseHealth: 3,
  })
  return {
    id,
    reputation: 20,
    energy: 1,
    maxEnergy: 1,
    reservedEnergy: 0,
    mulliganCompleted: true,
    hasAttackToken: id === 'a',
    deck: [],
    hand: [unit(`${id}-hand`)],
    graveyard: [],
    board: Array.from({ length: MAX_UNITS_ON_BOARD }, (_, i) => unit(`${id}-${i}`)),
  }
}

function makeCombat(attackers = ['a-2', 'a-0', 'a-1']): GameState {
  const state: GameState = {
    phase: PHASE.PLAYING,
    round: 1,
    rngState: 123,
    initiativePlayerId: 'a',
    turnPlayerId: 'a',
    consecutivePasses: 0,
    combat: null,
    winnerPlayerId: null,
    players: { a: makePlayer('a'), b: makePlayer('b') },
  }
  return applyAction(state, { type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'a', attackers })
    .state
}

function declareBlocks(state: GameState, blocks: DeclareBlocksAction['blocks']) {
  return applyAction(state, { type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'b', blocks })
}

describe('declare blocks action', () => {
  it('commits partial blocks in attack order without dealing damage', () => {
    const state = makeCombat()
    state.consecutivePasses = 1
    const before = structuredClone(state)
    const result = declareBlocks(state, [
      { attackerInstanceId: 'a-1', defenderInstanceId: 'b-0' },
      { attackerInstanceId: 'a-2', defenderInstanceId: 'b-1' },
    ])
    const slots = [
      { attackerId: 'a-2', blockerId: 'b-1' },
      { attackerId: 'a-0', blockerId: null },
      { attackerId: 'a-1', blockerId: 'b-0' },
    ]
    expect(result.state.combat).toEqual({
      attackerPlayerId: 'a',
      defenderPlayerId: 'b',
      stage: COMBAT_STAGE.AWAITING_RESPONSE,
      slots,
    })
    expect(result.state.turnPlayerId).toBe('a')
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.state.players).toEqual(before.players)
    expect(result.state.phase).toBe(PHASE.PLAYING)
    expect(result.state.round).toBe(before.round)
    expect(result.state.rngState).toBe(before.rngState)
    expect(result.events).toEqual([
      {
        type: GAME_EVENT_TYPE.BLOCKS_DECLARED,
        attackerPlayerId: 'a',
        defenderPlayerId: 'b',
        slots,
      },
    ])
    expect(state).toEqual(before)

    result.state.combat!.slots[0].blockerId = null
    expect(result.events[0]).toMatchObject({ slots })
  })

  it('supports six attackers blocked by six distinct units', () => {
    const state = makeCombat(Array.from({ length: MAX_UNITS_ON_BOARD }, (_, i) => `a-${i}`))
    const blocks = state.players.b.board.map((unit, i) => ({
      attackerInstanceId: `a-${i}`,
      defenderInstanceId: unit.instanceId,
    }))
    const result = declareBlocks(state, blocks)
    expect(result.state.combat?.slots).toHaveLength(MAX_UNITS_ON_BOARD)
    expect(result.state.combat?.slots.every((slot) => slot.blockerId !== null)).toBe(true)
    expect(result.state.combat?.stage).toBe(COMBAT_STAGE.AWAITING_RESPONSE)
  })

  it('confirms empty blocks before immediately resolving all unblocked attacks', () => {
    const state = makeCombat()
    const before = structuredClone(state)
    const result = declareBlocks(state, [])
    expect(result.state.combat).toBeNull()
    expect(result.state.players.b.reputation).toBe(14)
    expect(result.state.players.a).toEqual(state.players.a)
    expect(result.state.players.b.board).toEqual(state.players.b.board)
    expect(result.state.turnPlayerId).toBe('b')
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.state.round).toBe(state.round)
    expect(result.events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.BLOCKS_DECLARED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_RESOLVED,
    ])
    expect(result.events[0]).toEqual({
      type: GAME_EVENT_TYPE.BLOCKS_DECLARED,
      attackerPlayerId: 'a',
      defenderPlayerId: 'b',
      slots: before.combat!.slots,
    })
    expect(state).toEqual(before)
  })

  it('can end the game when empty blocks allow lethal damage', () => {
    const state = makeCombat()
    state.players.b.reputation = 2
    const result = declareBlocks(state, [])
    expect(result.state.phase).toBe(PHASE.FINISHED)
    expect(result.state.winnerPlayerId).toBe('a')
    expect(result.state.combat).toBeNull()
    expect(result.events[0].type).toBe(GAME_EVENT_TYPE.BLOCKS_DECLARED)
    expect(result.events.at(-1)).toEqual({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId: 'a' })
  })

  it('rejects another confirmation after blocks have been committed', () => {
    const state = declareBlocks(makeCombat(), [
      { attackerInstanceId: 'a-0', defenderInstanceId: 'b-0' },
    ]).state
    const before = structuredClone(state)
    expect(() => declareBlocks(state, [])).toThrow('Blockers have already been confirmed')
    expect(state).toEqual(before)
  })

  it.each([
    ['non-attacking', 'Block references a unit that is not attacking'],
    ['missing-attacker', 'Block references a unit that is not attacking'],
    ['hand', 'Blocker is not on defender board'],
    ['opponent', 'Blocker is not on defender board'],
    ['missing-blocker', 'Blocker is not on defender board'],
    ['attacker-player', 'Only the defender may declare blocks'],
    ['missing-player', 'Player not found'],
    ['wrong-turn', "Not player's turn"],
    ['no-combat', 'No active combat'],
    ['mulligan', 'Cannot declare blocks in this phase'],
    ['finished', 'Cannot declare blocks in this phase'],
  ])('rejects %s without changing the input', (scenario, message) => {
    const state = makeCombat()
    const action: DeclareBlocksAction = {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: 'b',
      blocks: [{ attackerInstanceId: 'a-0', defenderInstanceId: 'b-0' }],
    }
    if (scenario === 'non-attacking') action.blocks[0].attackerInstanceId = 'a-3'
    if (scenario === 'missing-attacker') action.blocks[0].attackerInstanceId = 'unknown'
    if (scenario === 'hand') action.blocks[0].defenderInstanceId = 'b-hand'
    if (scenario === 'opponent') action.blocks[0].defenderInstanceId = 'a-0'
    if (scenario === 'missing-blocker') action.blocks[0].defenderInstanceId = 'unknown'
    if (scenario === 'attacker-player') action.playerId = 'a'
    if (scenario === 'missing-player') action.playerId = 'unknown'
    if (scenario === 'wrong-turn') state.turnPlayerId = 'a'
    if (scenario === 'no-combat') state.combat = null
    if (scenario === 'mulligan') state.phase = PHASE.MULLIGAN
    if (scenario === 'finished') state.phase = PHASE.FINISHED
    const before = structuredClone(state)
    expect(() => applyAction(state, action)).toThrow(message)
    expect(state).toEqual(before)
  })

  it.each([
    {
      blocks: [
        { attackerInstanceId: 'a-0', defenderInstanceId: 'b-0' },
        { attackerInstanceId: 'a-0', defenderInstanceId: 'b-1' },
      ],
      message: 'Duplicate blocked attackers',
    },
    {
      blocks: [
        { attackerInstanceId: 'a-0', defenderInstanceId: 'b-0' },
        { attackerInstanceId: 'a-1', defenderInstanceId: 'b-0' },
      ],
      message: 'Duplicate blockers',
    },
    {
      blocks: Array.from({ length: MAX_UNITS_ON_BOARD + 1 }, (_, i) => ({
        attackerInstanceId: `a-${i}`,
        defenderInstanceId: `b-${i}`,
      })),
      message: `Cannot declare more than ${MAX_UNITS_ON_BOARD} blockers`,
    },
  ])('rejects schema violation: $message', ({ blocks, message }) => {
    const state = makeCombat()
    const before = structuredClone(state)
    const action: DeclareBlocksAction = {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: 'b',
      blocks,
    }
    const parsed = gameActionSchema.safeParse(action)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['blocks'], message }),
    )
    expect(() => applyAction(state, action)).toThrow(message)
    expect(state).toEqual(before)
  })
})

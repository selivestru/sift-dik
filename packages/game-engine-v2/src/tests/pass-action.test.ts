import { describe, expect, it } from 'vitest'

import { applyAction } from '../core/apply-action'
import { createGame } from '../core/create-game'
import { GAME_ACTION_TYPE } from '../types/action.types'
import { CARD_FACTION, CARD_TYPE, type CardDefinition } from '../types/card.types'
import { GAME_EVENT_TYPE } from '../types/event.types'
import { COMBAT_STAGE, PHASE, type GameState } from '../types/game-state.types'

function makeGame() {
  const cards: CardDefinition[] = Array.from({ length: 40 }, (_, index) => ({
    id: `unit-${index}`,
    type: CARD_TYPE.UNIT,
    faction: CARD_FACTION.OTHER,
    cost: 1,
    attack: 1,
    baseHealth: 2,
    health: 2,
  }))
  let state = createGame(
    [
      { id: 'a', cards },
      { id: 'b', cards },
    ],
    { seed: 123 },
  )
  const initialInitiative = state.initiativePlayerId
  for (const playerId of ['a', 'b']) {
    state = applyAction(state, {
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId,
      cardInstanceIds: [],
    }).state
  }
  expect(state.initiativePlayerId).toBe(initialInitiative)
  expect(state.round).toBe(1)
  return state
}

function pass(state: GameState, playerId = state.turnPlayerId) {
  return applyAction(state, { type: GAME_ACTION_TYPE.PASS, playerId })
}

function endRound(state: GameState) {
  return pass(pass(state).state)
}

function makeCombat() {
  const state = makeGame()
  const attacker = state.players[state.turnPlayerId]
  const defender = Object.values(state.players).find((player) => player.id !== attacker.id)!
  attacker.board = attacker.deck.splice(0, 2)
  defender.board = defender.deck.splice(0, 1)

  return applyAction(state, {
    type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
    playerId: attacker.id,
    attackers: attacker.board.map((unit) => unit.instanceId),
  }).state
}

function blockFirstAttacker(state: GameState) {
  const combat = state.combat!
  return applyAction(state, {
    type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
    playerId: combat.defenderPlayerId,
    blocks: [
      {
        attackerInstanceId: combat.slots[0].attackerId,
        defenderInstanceId: state.players[combat.defenderPlayerId].board[0].instanceId,
      },
    ],
  }).state
}

describe('pass action', () => {
  it('passes priority without ending the round after the first pass', () => {
    const state = makeGame()
    const before = structuredClone(state)
    const result = pass(state)

    expect(result.events).toEqual([
      {
        type: GAME_EVENT_TYPE.PLAYER_PASSED,
        playerId: state.turnPlayerId,
      },
    ])
    expect(result.state.consecutivePasses).toBe(1)
    expect(result.state.turnPlayerId).not.toBe(state.turnPlayerId)
    expect(result.state.round).toBe(1)
    expect(result.state.players).toEqual(state.players)
    expect(result.state.rngState).toBe(state.rngState)
    expect(state).toEqual(before)
    expect(() => pass(result.state, state.turnPlayerId)).toThrow("Not player's turn")
  })

  it('ends the round after the second pass and grants a new attack token', () => {
    const state = makeGame()
    state.players[state.initiativePlayerId].hasAttackToken = false
    const result = endRound(state)

    expect(result.events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.PLAYER_PASSED,
      GAME_EVENT_TYPE.ROUND_ENDED,
      GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
      GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
      GAME_EVENT_TYPE.ROUND_STARTED,
      GAME_EVENT_TYPE.ENERGY_CHANGED,
      GAME_EVENT_TYPE.CARD_DRAWN,
      GAME_EVENT_TYPE.ENERGY_CHANGED,
      GAME_EVENT_TYPE.CARD_DRAWN,
    ])
    expect(result.events[1]).toEqual({ type: GAME_EVENT_TYPE.ROUND_ENDED, round: 1 })
    expect(result.events[2]).toEqual({
      type: GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
      playerId: 'a',
      reservedEnergy: 1,
      bankedEnergy: 1,
    })
    expect(result.events[3]).toEqual({
      type: GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
      playerId: 'b',
      reservedEnergy: 1,
      bankedEnergy: 1,
    })
    expect(result.state.round).toBe(2)
    expect(result.state.initiativePlayerId).not.toBe(state.initiativePlayerId)
    expect(result.state.turnPlayerId).toBe(result.state.initiativePlayerId)
    expect(result.state.consecutivePasses).toBe(0)
    for (const player of Object.values(result.state.players)) {
      expect(player.maxEnergy).toBe(2)
      expect(player.energy).toBe(2)
      expect(player.reservedEnergy).toBe(1)
      expect(player.hand).toHaveLength(6)
      expect(player.hand[5]).toEqual(state.players[player.id].deck[0])
      expect(player.deck).toHaveLength(34)
      expect(player.hasAttackToken).toBe(player.id === result.state.initiativePlayerId)
    }
  })

  it('accumulates unused energy up to three and stops emitting changes at the cap', () => {
    const state = makeGame()
    state.players.a.reservedEnergy = 2
    state.players.b.reservedEnergy = 3

    const firstEnd = endRound(state)
    expect(firstEnd.state.players.a.reservedEnergy).toBe(3)
    expect(firstEnd.state.players.b.reservedEnergy).toBe(3)
    expect(
      firstEnd.events.filter((event) => event.type === GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED),
    ).toEqual([
      {
        type: GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
        playerId: 'a',
        reservedEnergy: 3,
        bankedEnergy: 1,
      },
    ])

    const secondEnd = endRound(firstEnd.state)
    expect(secondEnd.state.players.a.reservedEnergy).toBe(3)
    expect(secondEnd.state.players.b.reservedEnergy).toBe(3)
    expect(
      secondEnd.events.some((event) => event.type === GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED),
    ).toBe(false)
  })

  it.each([
    [0, 2, 2],
    [1, 1, 2],
    [5, 2, 3],
  ])(
    'banks %i remaining energy into a reserve of %i (result: %i)',
    (energy, reservedEnergy, expectedReservedEnergy) => {
      const state = makeGame()
      state.round = 5
      for (const player of Object.values(state.players)) {
        player.maxEnergy = 5
        player.energy = 0
      }
      state.players.a.energy = energy
      state.players.a.reservedEnergy = reservedEnergy
      const before = structuredClone(state)

      const result = endRound(state)

      expect(result.state.players.a.reservedEnergy).toBe(expectedReservedEnergy)
      expect(result.state.players.a.energy).toBe(6)
      expect(result.state.players.b.reservedEnergy).toBe(0)
      expect(
        result.events.filter((event) => event.type === GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED),
      ).toEqual(
        expectedReservedEnergy > reservedEnergy
          ? [
              {
                type: GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
                playerId: 'a',
                reservedEnergy: expectedReservedEnergy,
                bankedEnergy: expectedReservedEnergy - reservedEnergy,
              },
            ]
          : [],
      )
      expect(state).toEqual(before)
    },
  )

  it('breaks consecutive passes when a unit is played', () => {
    let state = pass(makeGame()).state
    const player = state.players[state.turnPlayerId]
    state = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: player.id,
      cardInstanceId: player.hand[0].instanceId,
    }).state
    expect(state.consecutivePasses).toBe(0)
    const result = pass(state)
    expect(result.state.round).toBe(1)
    expect(result.state.consecutivePasses).toBe(1)
    expect(pass(result.state).state.round).toBe(2)
  })

  it('alternates initiative from round ownership rather than the last action player', () => {
    const state = makeGame()
    state.turnPlayerId = Object.keys(state.players).find((id) => id !== state.initiativePlayerId)!
    const next = endRound(state).state
    expect(next.initiativePlayerId).toBe(state.turnPlayerId)
    expect(endRound(next).state.initiativePlayerId).toBe(state.initiativePlayerId)
  })

  it('caps energy at ten and preserves damaged units between rounds', () => {
    const state = makeGame()
    state.round = 10
    for (const player of Object.values(state.players)) {
      player.maxEnergy = 10
      player.energy = 0
      const unit = player.deck.shift()!
      unit.health = 1
      player.board.push(unit)
    }
    const next = endRound(state).state
    expect(next.round).toBe(11)
    for (const player of Object.values(next.players)) {
      expect(player.maxEnergy).toBe(10)
      expect(player.energy).toBe(10)
      expect(player.board).toEqual(state.players[player.id].board)
      expect(player.board[0].health).toBe(1)
    }
  })

  it.each([
    ['wrong-player', "Not player's turn"],
    ['missing-player', 'Player not found'],
    ['mulligan', 'Cannot pass in this phase'],
    ['finished', 'Cannot pass in this phase'],
  ])('rejects %s without changing the input', (scenario, message) => {
    const state = makeGame()
    let playerId = state.turnPlayerId
    if (scenario === 'wrong-player') {
      playerId = Object.keys(state.players).find((id) => id !== playerId)!
    }
    if (scenario === 'missing-player') playerId = 'unknown'
    if (scenario === 'mulligan') state.phase = PHASE.MULLIGAN
    if (scenario === 'finished') state.phase = PHASE.FINISHED
    const before = structuredClone(state)
    expect(() => pass(state, playerId)).toThrow(message)
    expect(state).toEqual(before)
  })

  it('obliterates an opening draw when a later round starts with a full hand', () => {
    const state = makeGame()
    const player = state.players.a
    player.hand.push(...player.deck.splice(0, 5))
    const card = player.deck[0]
    const next = endRound(state)
    expect(next.state.players.a.hand).toHaveLength(10)
    expect(next.state.players.a.deck).toHaveLength(player.deck.length - 1)
    expect(next.state.players.a.graveyard).toEqual(player.graveyard)
    expect(next.events).toContainEqual({
      type: GAME_EVENT_TYPE.CARD_OBLITERATED,
      playerId: 'a',
      cardInstanceId: card.instanceId,
    })
    expect(
      next.events.some(
        (event) => event.type === GAME_EVENT_TYPE.CARD_DRAWN && event.playerId === 'a',
      ),
    ).toBe(false)
  })

  it('ends the game on an empty later draw, with a tie if both decks are empty', () => {
    for (const bothEmpty of [false, true]) {
      const state = makeGame()
      state.players.a.deck = []
      if (bothEmpty) state.players.b.deck = []
      const result = endRound(state)
      expect(result.state.phase).toBe(PHASE.FINISHED)
      expect(result.state.winnerPlayerId).toBe(bothEmpty ? null : 'b')
      expect(result.events.at(-1)).toEqual({
        type: GAME_EVENT_TYPE.GAME_OVER,
        winnerPlayerId: bothEmpty ? null : 'b',
      })
      expect(() => pass(result.state)).toThrow('phase')
    }
  })

  it('allows drawing the last card and loses only on the following required draw', () => {
    const state = makeGame()
    state.players.a.deck = state.players.a.deck.slice(0, 1)
    const next = endRound(state).state
    expect(next.phase).toBe(PHASE.PLAYING)
    expect(next.players.a.deck).toHaveLength(0)
    expect(endRound(next).state.winnerPlayerId).toBe('b')
  })
})

describe('pass during combat', () => {
  it('confirms empty blocks and resolves the attack when the defender passes', () => {
    const state = makeCombat()
    const combat = state.combat!
    const before = structuredClone(state)
    const result = pass(state)
    const explicitBlocks = applyAction(state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: combat.defenderPlayerId,
      blocks: [],
    })

    expect(result.state).toEqual(explicitBlocks.state)
    expect(result.events).toEqual([
      { type: GAME_EVENT_TYPE.PLAYER_PASSED, playerId: combat.defenderPlayerId },
      ...explicitBlocks.events,
    ])
    expect(result.events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.PLAYER_PASSED,
      GAME_EVENT_TYPE.BLOCKS_DECLARED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_RESOLVED,
    ])
    expect(result.state.players[combat.defenderPlayerId].reputation).toBe(18)
    expect(result.state.combat).toBeNull()
    expect(result.state.turnPlayerId).toBe(combat.defenderPlayerId)
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.state.round).toBe(state.round)
    expect(result.state.phase).toBe(PHASE.PLAYING)
    expect(result.state.rngState).toBe(state.rngState)
    expect(state).toEqual(before)
  })

  it('resolves confirmed blocks on the attacker pass without confirming them again', () => {
    const attack = makeCombat()
    const combat = attack.combat!
    const attacker = attack.players[combat.attackerPlayerId]
    const defender = attack.players[combat.defenderPlayerId]
    attacker.board[0].attack = 3
    defender.board[0].attack = 2
    defender.board[0].health = 4
    const state = blockFirstAttacker(attack)
    expect(state.combat?.stage).toBe(COMBAT_STAGE.AWAITING_RESPONSE)
    const before = structuredClone(state)
    const result = pass(state)

    expect(result.events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.PLAYER_PASSED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.UNIT_DIED,
      GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED,
      GAME_EVENT_TYPE.COMBAT_RESOLVED,
    ])
    expect(result.events[0]).toEqual({
      type: GAME_EVENT_TYPE.PLAYER_PASSED,
      playerId: combat.attackerPlayerId,
    })
    expect(result.state.players[attacker.id].board).toHaveLength(1)
    expect(result.state.players[attacker.id].graveyard[0].instanceId).toBe(
      combat.slots[0].attackerId,
    )
    expect(result.state.players[defender.id].board[0].health).toBe(1)
    expect(result.state.players[defender.id].reputation).toBe(19)
    expect(result.state.combat).toBeNull()
    expect(result.state.turnPlayerId).toBe(defender.id)
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.state.round).toBe(state.round)
    expect(state).toEqual(before)
  })

  it('continues ordinary actions after combat and requires two new passes to end the round', () => {
    const attack = makeCombat()
    const combat = attack.combat!
    const afterCombat = pass(blockFirstAttacker(attack)).state
    const defender = afterCombat.players[combat.defenderPlayerId]
    const played = applyAction(afterCombat, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defender.id,
      cardInstanceId: defender.hand[0].instanceId,
    }).state
    expect(played.turnPlayerId).toBe(combat.attackerPlayerId)
    expect(() =>
      applyAction(played, {
        type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
        playerId: combat.attackerPlayerId,
        attackers: [played.players[combat.attackerPlayerId].board[0].instanceId],
      }),
    ).toThrow('Player does not have the attack token')
    const firstPass = pass(played)
    expect(firstPass.state.round).toBe(attack.round)
    expect(firstPass.state.consecutivePasses).toBe(1)
    const secondPass = pass(firstPass.state)
    expect(secondPass.state.round).toBe(attack.round + 1)
    expect(secondPass.state.initiativePlayerId).toBe(combat.defenderPlayerId)
    expect(secondPass.state.turnPlayerId).toBe(combat.defenderPlayerId)
    expect(secondPass.state.players[combat.defenderPlayerId].hasAttackToken).toBe(true)
  })

  it.each([COMBAT_STAGE.AWAITING_BLOCKS, COMBAT_STAGE.AWAITING_RESPONSE])(
    'can finish the game on a pass in %s',
    (stage) => {
      let state = makeCombat()
      const defenderId = state.combat!.defenderPlayerId
      const attackerId = state.combat!.attackerPlayerId
      state.players[defenderId].reputation = 1
      if (stage === COMBAT_STAGE.AWAITING_RESPONSE) state = blockFirstAttacker(state)
      const result = pass(state)
      expect(result.state.phase).toBe(PHASE.FINISHED)
      expect(result.state.winnerPlayerId).toBe(attackerId)
      expect(result.state.combat).toBeNull()
      expect(result.state.round).toBe(state.round)
      expect(result.events[0]).toEqual({
        type: GAME_EVENT_TYPE.PLAYER_PASSED,
        playerId: state.turnPlayerId,
      })
      expect(result.events.at(-1)).toEqual({
        type: GAME_EVENT_TYPE.GAME_OVER,
        winnerPlayerId: attackerId,
      })
      expect(() => pass(result.state)).toThrow('Cannot pass in this phase')
    },
  )

  it.each([COMBAT_STAGE.AWAITING_BLOCKS, COMBAT_STAGE.AWAITING_RESPONSE])(
    'rejects a pass out of turn during %s',
    (stage) => {
      let state = makeCombat()
      if (stage === COMBAT_STAGE.AWAITING_RESPONSE) state = blockFirstAttacker(state)
      const wrongPlayer = Object.values(state.players).find(
        (player) => player.id !== state.turnPlayerId,
      )!
      const before = structuredClone(state)
      expect(() => pass(state, wrongPlayer.id)).toThrow("Not player's turn")
      expect(state).toEqual(before)
    },
  )

  it.each([
    [COMBAT_STAGE.AWAITING_BLOCKS, 'Only the defender may pass while awaiting blocks'],
    [COMBAT_STAGE.AWAITING_RESPONSE, 'Only the attacker may pass while awaiting a response'],
  ])('rejects the wrong combat role even with inconsistent priority in %s', (stage, message) => {
    let state = makeCombat()
    if (stage === COMBAT_STAGE.AWAITING_RESPONSE) state = blockFirstAttacker(state)
    const combat = state.combat!
    state.turnPlayerId =
      stage === COMBAT_STAGE.AWAITING_BLOCKS ? combat.attackerPlayerId : combat.defenderPlayerId
    const before = structuredClone(state)
    expect(() => pass(state)).toThrow(message)
    expect(state).toEqual(before)
  })
})

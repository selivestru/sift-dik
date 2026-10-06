import { createGame as createOpeningGame, type CreateGameOptions, type CreateGamePlayer } from '../core/create-game'
import { applyAction } from '../core/apply-action'
import { GAME_ACTION_TYPE, type GameState, type UnitCard, type UnitCardInstance } from '../types'

const filler: UnitCard = {
  id: 'scenario-filler', type: 'unit', faction: 'dik', baseCost: 1, cost: 1,
  baseAttack: 1, attack: 1, baseHealth: 1, health: 1, maxHealth: 1,
}

export const createGame = (players: [CreateGamePlayer, CreateGamePlayer], options?: CreateGameOptions): GameState => {
  const padded = players.map((player) => ({ ...player, cards: [...player.cards, ...Array.from({ length: Math.max(0, 4 - player.cards.length) }, () => filler)] })) as [CreateGamePlayer, CreateGamePlayer]
  const state = createOpeningGame(padded, options)
  state.phase = 'playing'
  state.mulligan = null
  state.round = 1
  for (const player of Object.values(state.players)) {
    const originalIds = new Set(players.find((participant) => participant.id === player.id)!.cards.map((_, index) => `${player.id}-card-${index + 1}`))
    player.hand = player.hand.filter((card) => originalIds.has(card.instanceId))
    player.deck = player.deck.filter((card) => originalIds.has(card.instanceId))
    player.energy = 1
    player.maxEnergy = 1
    player.hasAttackToken = player.id === state.initiativePlayerId
  }
  return state
}

export const battle = (attackOverrides: Partial<UnitCard> = {}, blockOverrides: Partial<UnitCard> = {}): GameState => {
  const state = createGame([
    { id: 'p1', cards: Array.from({ length: 20 }, () => filler) },
    { id: 'p2', cards: Array.from({ length: 20 }, () => filler) },
  ], { seed: 42 })
  state.initiativePlayerId = 'p1'
  state.turnPlayerId = 'p1'
  state.players.p1!.hasAttackToken = true
  state.players.p2!.hasAttackToken = false
  for (const player of Object.values(state.players)) player.energy = 10
  const attacker: UnitCardInstance = { ...filler, attack: 3, health: 4, maxHealth: 4, ...attackOverrides, instanceId: 'a', ownerId: 'p1' }
  const blocker: UnitCardInstance = { ...filler, attack: 1, health: 4, maxHealth: 4, ...blockOverrides, instanceId: 'b', ownerId: 'p2' }
  state.players.p1!.board = [attacker]
  state.players.p2!.board = [blocker]
  return state
}

export const resolveBattle = (state: GameState, blocked = true) => {
  const attacked = applyAction(state, { type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'p1', attackers: ['a'] }).state
  return blocked
    ? applyAction(attacked, { type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2', blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }] })
    : applyAction(attacked, { type: GAME_ACTION_TYPE.PASS, playerId: 'p2' })
}

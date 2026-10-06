import { INIT_ENERGY } from '../../constants/game'
import { GAME_EVENT_TYPE, type GameState, type MulliganAction } from '../../types'
import { nextRandom } from '../../utils/createRng'
import { shuffle } from '../../utils/shuffle'
import type { ApplyActionResult } from '../apply-action'
import { drawCard } from '../utils/draw-card'

export const mulliganAction = (state: GameState, action: MulliganAction): ApplyActionResult => {
  if (state.phase !== 'mulligan' || !state.mulligan) throw new Error('Mulligan is already over')
  if (state.mulligan[action.playerId] !== null) throw new Error('Player has already confirmed the mulligan')
  const player = state.players[action.playerId]!
  const selected = new Set(action.cardInstanceIds)
  if (selected.size !== action.cardInstanceIds.length || action.cardInstanceIds.some((id) => !player.hand.some((card) => card.instanceId === id))) {
    throw new Error('Mulligan must select unique cards from your opening hand')
  }
  if (selected.size > player.deck.length) throw new Error('Not enough replacement cards in the deck')
  state.mulligan[action.playerId] = [...action.cardInstanceIds]
  const events: ApplyActionResult['events'] = []
  if (Object.values(state.mulligan).some((selection) => selection === null)) return { state, events }
  for (const participant of Object.values(state.players)) {
    const ids = new Set(state.mulligan[participant.id]!)
    const returned = participant.hand.filter((card) => ids.has(card.instanceId))
    participant.hand = participant.hand.map((card) => ids.has(card.instanceId) ? participant.deck.shift()! : card)
    participant.deck = shuffle([...participant.deck, ...returned], () => nextRandom(state))
    participant.energy = INIT_ENERGY
    participant.maxEnergy = INIT_ENERGY
    participant.hasAttackToken = participant.id === state.initiativePlayerId
  }
  state.mulligan = null
  state.phase = 'playing'
  state.round = 1
  state.turnPlayerId = state.initiativePlayerId
  events.push({ type: GAME_EVENT_TYPE.ROUND_STARTED, round: 1, initiativePlayerId: state.initiativePlayerId })
  for (const participant of Object.values(state.players)) {
    drawCard(state, participant.id, events)
    if (state.winnerPlayerId !== null) break
  }
  return { state, events }
}

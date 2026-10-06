import { MAX_UNITS_ON_BOARD_PER_PLAYER } from '../../constants/game'
import {
  CARD_TYPE,
  GAME_EVENT_TYPE,
  KEYWORD,
  type GameEvent,
  type GameState,
  type PlayUnitAction,
  type UnitCardInstance,
} from '../../types'
import { TRIGGER, type AbilityContextInput, type AbilityType } from '../../types/abilities.types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import { ABILITIES } from '../abilities/registry'
import { triggerUnitAbilities } from '../abilities/trigger-abilities'
import type { ApplyActionResult } from '../apply-action'

export const playUnitAction = (state: GameState, action: PlayUnitAction): ApplyActionResult => {
  const nextState = state

  const card = validatePlayUnitAction(nextState, action)
  const abilityContexts = parseAbilityPayloads(card, action)

  const events: GameEvent[] = []

  spendUnitCost(nextState, events, action.playerId, card.cost)
  deployUnitToBoard(nextState, events, action.playerId, card)
  triggerImpulseIfApplicable(nextState, events, action.playerId, card)
  triggerUnitAbilities(
    nextState,
    events,
    card,
    TRIGGER.ON_SUMMON,
    { sourceUnit: card },
    abilityContexts,
  )

  nextState.turnPlayerId = getNextPlayerId(nextState)
  nextState.consecutivePasses = 0

  return {
    state: nextState,
    events,
  }
}

function validatePlayUnitAction(state: GameState, action: PlayUnitAction): UnitCardInstance {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to act`)
  }

  if (state.combat !== null) {
    throw new Error('Cannot play unit: combat is currently in progress')
  }

  if (state.spellStack.length > 0) {
    throw new Error('Cannot play unit while spells are on the stack')
  }

  const playerState = state.players[action.playerId]
  if (!playerState) {
    throw new Error(`Player with ID "${action.playerId}" not found`)
  }

  const card = playerState.hand.find((c) => c.instanceId === action.cardInstanceId)
  if (!card) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" not found in player hand`)
  }

  if (card.type !== CARD_TYPE.UNIT) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" is not a unit card`)
  }
  if (!Number.isInteger(card.cost) || card.cost < 0) throw new Error('Unit cost must be a nonnegative integer')

  if (playerState.energy < card.cost) {
    throw new Error(
      `Not enough energy to play unit (required: ${card.cost}, available: ${playerState.energy})`,
    )
  }

  if (playerState.board.length >= MAX_UNITS_ON_BOARD_PER_PLAYER) {
    throw new Error(
      `Cannot play unit: board has reached maximum capacity (${MAX_UNITS_ON_BOARD_PER_PLAYER})`,
    )
  }

  return card
}

function parseAbilityPayloads(card: UnitCardInstance, action: PlayUnitAction): AbilityContextInput {
  const parsed: Partial<Record<AbilityType, unknown>> = {}

  for (const abilityId of card.abilities ?? []) {
    const schema = ABILITIES[abilityId]?.payloadSchema

    if (!schema) continue

    const result = schema.safeParse(action.abilityContexts?.[abilityId])

    if (!result.success) {
      throw new Error(`Invalid payload for ability "${abilityId}": ${result.error.message}`)
    }

    parsed[abilityId] = result.data
  }

  return parsed as AbilityContextInput
}

function spendUnitCost(
  state: GameState,
  events: GameEvent[],
  playerId: string,
  cost: number,
): void {
  const playerState = state.players[playerId]!
  playerState.energy -= cost

  events.push({
    type: GAME_EVENT_TYPE.ENERGY_CHANGED,
    energy: playerState.energy,
    playerId,
    isReserved: false,
  })
}

function deployUnitToBoard(
  state: GameState,
  events: GameEvent[],
  playerId: string,
  card: UnitCardInstance,
): void {
  const playerState = state.players[playerId]!
  playerState.hand = playerState.hand.filter((c) => c.instanceId !== card.instanceId)
  playerState.board.push(card)

  events.push({
    type: GAME_EVENT_TYPE.UNIT_SPAWNED,
    playerId,
    unit: card,
  })
}

function triggerImpulseIfApplicable(
  state: GameState,
  events: GameEvent[],
  playerId: string,
  card: UnitCardInstance,
): void {
  const playerState = state.players[playerId]!

  if (card.keywords?.includes(KEYWORD.IMPULSE) && playerState.reservedEnergy < 3) {
    playerState.reservedEnergy = Math.min(3, playerState.reservedEnergy + 1)

    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: playerState.reservedEnergy,
      isReserved: true,
    })
  }
}

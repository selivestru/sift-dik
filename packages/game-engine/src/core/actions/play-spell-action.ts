import {
  CARD_TYPE,
  GAME_ACTION_TYPE,
  GAME_EVENT_TYPE,
  SPELL_SPEED,
  type GameEvent,
  type GameState,
  type PlaySpellAction,
  type PlaySpellsAction,
  type SpellPlay,
  type PlayerState,
  type SpellCardInstance,
} from '../../types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import { MAX_SPELL_STACK_SIZE } from '../../constants/game'
import type { ApplyActionResult } from '../apply-action'
import { SPELL_REGISTRY } from '../spells/registry'
import { resolveSpellItem } from '../spells/resolve-spell-stack'
import { validateSpellTargets } from '../spells/validate-spell-targets'

export const playSpellAction = (state: GameState, action: PlaySpellAction): ApplyActionResult => {
  return playSpellsAction(state, { type: GAME_ACTION_TYPE.PLAY_SPELLS, playerId: action.playerId, spells: [action] })
}

export const playSpellsAction = (state: GameState, action: PlaySpellsAction): ApplyActionResult => {
  const events: GameEvent[] = []
  const addedFastSpells = playSpells(state, events, action.playerId, action.spells)
  if (addedFastSpells && state.winnerPlayerId === null) {
    if (state.combat && !state.combat.blocksDeclared) state.combat.blocksDeclared = true
    state.turnPlayerId = getNextPlayerId(state)
    state.consecutivePasses = 0
  }
  return { state, events }
}

export const playSpells = (state: GameState, events: GameEvent[], playerId: string, spells: SpellPlay[]): boolean => {
  if (new Set(spells.map((item) => item.cardInstanceId)).size !== spells.length) {
    throw new Error('A spell batch cannot contain duplicate card instances')
  }
  if (spells.length === 0) throw new Error('A spell batch must contain at least one spell')
  let addedStackItem = false
  for (const choice of spells) {
    if (state.phase === 'finished') break
    const action: PlaySpellAction = { ...choice, type: GAME_ACTION_TYPE.PLAY_SPELL, playerId }
    const spellCard = validatePlaySpellAction(state, action)
    spendSpellCost(state.players[playerId]!, events, playerId, spellCard.cost)
    removeSpellFromHand(state, action)
    const item = {
      spell: spellCard,
      targets: choice.targets ? [...choice.targets] : undefined,
      payload: choice.payload ? structuredClone(choice.payload) : undefined,
    }
    if (spellCard.speed === SPELL_SPEED.BURST || spellCard.speed === SPELL_SPEED.FOCUS) {
      resolveSpellItem(state, events, item)
    } else {
      if (state.spellStack.length === 0) state.stackInitiatorPlayerId = playerId
      state.spellStack.push(item)
      addedStackItem = true
    }
  }
  return addedStackItem
}

function validatePlaySpellAction(state: GameState, action: PlaySpellAction): SpellCardInstance {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to act`)
  }

  const playerState = state.players[action.playerId]
  if (!playerState) {
    throw new Error(`Player with ID "${action.playerId}" not found`)
  }

  const card = playerState.hand.find((c) => c.instanceId === action.cardInstanceId)
  if (!card) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" not found in player hand`)
  }

  if (card.type !== CARD_TYPE.SPELL) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" is not a spell card`)
  }

  const spellCard = card as SpellCardInstance
  if (!Number.isInteger(spellCard.cost) || spellCard.cost < 0) throw new Error('Spell cost must be a nonnegative integer')
  if ((spellCard.speed === SPELL_SPEED.FAST || spellCard.speed === SPELL_SPEED.SLOW) && state.spellStack.length >= MAX_SPELL_STACK_SIZE) {
    throw new Error('Spell stack is full')
  }

  if ((spellCard.speed === SPELL_SPEED.SLOW || spellCard.speed === SPELL_SPEED.FOCUS) && state.combat !== null) {
    throw new Error('Cannot play slow spell while combat is in progress')
  }

  if ((spellCard.speed === SPELL_SPEED.SLOW || spellCard.speed === SPELL_SPEED.FOCUS) && state.spellStack.length > 0) {
    throw new Error('Cannot play slow spell while other spells are on the stack')
  }

  const availableEnergy = playerState.energy + playerState.reservedEnergy
  if (availableEnergy < spellCard.cost) {
    throw new Error(
      `Not enough energy to play spell (required: ${spellCard.cost}, available: ${availableEnergy})`,
    )
  }

  const validateTargets = SPELL_REGISTRY[spellCard.id]?.validateTargets
  const entry = SPELL_REGISTRY[spellCard.id]
  if (!entry) throw new Error(`Unknown spell "${spellCard.id}"`)
  entry.payloadSchema?.parse(action.payload ?? {})

  if (validateTargets) {
    validateTargets(state, { spell: spellCard, targets: action.targets, payload: action.payload })
  } else {
    validateSpellTargets(state, { spell: spellCard, targets: action.targets })
  }

  return spellCard
}

function spendSpellCost(
  playerState: PlayerState,
  events: GameEvent[],
  playerId: string,
  cost: number,
): void {
  let costLeft = cost
  const reservedToSpend = Math.min(playerState.reservedEnergy, costLeft)
  playerState.reservedEnergy -= reservedToSpend
  costLeft -= reservedToSpend

  if (reservedToSpend > 0) {
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: playerState.reservedEnergy,
      isReserved: true,
    })
  }

  if (costLeft > 0) {
    playerState.energy -= costLeft
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: playerState.energy,
      isReserved: false,
    })
  }
}

function removeSpellFromHand(state: GameState, action: PlaySpellAction): void {
  const playerState = state.players[action.playerId]!
  playerState.hand = playerState.hand.filter((c) => c.instanceId !== action.cardInstanceId)
}

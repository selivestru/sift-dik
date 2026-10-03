import {
  CARD_TYPE,
  GAME_EVENT_TYPE,
  KEYWORD,
  type CardInstance,
  type GameEvent,
  type GameState,
  type PassAction,
  type PlayerState,
  type UnitCardInstance,
} from '../../types'
import { TRIGGER } from '../../types/abilities.types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import { notifyAllyDeath, triggerUnitAbilities } from '../abilities/trigger-abilities'
import type { ApplyActionResult } from '../apply-action'
import { resolveCombat } from '../combat/resolve-combat'
import { resolveSpellItem } from '../spells/resolve-spell-stack'
import { drawCard } from '../utils/draw-card'

export const passAction = (state: GameState, action: PassAction): ApplyActionResult => {
  const nextState = structuredClone(state)

  validatePassAction(nextState, action)

  const events: GameEvent[] = []

  if (nextState.spellStack.length > 0) {
    passSpellStackPriority(nextState, events)

    return {
      state: nextState,
      events,
    }
  }

  if (nextState.combat !== null) {
    passCombatPriority(nextState, events)

    return {
      state: nextState,
      events,
    }
  }

  passRoundPriority(nextState, events)

  return {
    state: nextState,
    events,
  }
}

function validatePassAction(state: GameState, action: PassAction): void {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to pass`)
  }
}

function passSpellStackPriority(state: GameState, events: GameEvent[]): void {
  state.consecutivePasses += 1

  if (state.consecutivePasses === 2) {
    const spellItem = state.spellStack.pop()!
    resolveSpellItem(state, events, spellItem)

    state.consecutivePasses = 0
  }

  state.turnPlayerId = getNextPlayerId(state)
}

function passCombatPriority(state: GameState, events: GameEvent[]): void {
  state.consecutivePasses += 1

  if (state.consecutivePasses === 2) {
    const attackerPlayerId = state.combat!.attackerPlayerId

    resolveCombat(state, events)

    state.combat = null
    state.consecutivePasses = 0

    if (state.winnerPlayerId === null) {
      state.turnPlayerId = attackerPlayerId
    }

    return
  }

  state.turnPlayerId = getNextPlayerId(state)
}

function passRoundPriority(state: GameState, events: GameEvent[]): void {
  state.consecutivePasses += 1

  if (state.consecutivePasses === 2) {
    progressRound(state, events)

    return
  }

  state.turnPlayerId = getNextPlayerId(state)
}

function progressRound(state: GameState, events: GameEvent[]): void {
  events.push({ type: GAME_EVENT_TYPE.ROUND_ENDED, round: state.round })

  triggerRoundEndAbilities(state, events)

  for (const playerId in state.players) {
    endPlayerRoundCleanup(state, state.players[playerId]!, events)
  }

  advanceRound(state, events)
  runDrawPhase(state, events)

  state.consecutivePasses = 0
}

function triggerRoundEndAbilities(state: GameState, events: GameEvent[]): void {
  for (const playerId in state.players) {
    for (const unit of state.players[playerId]!.board) {
      triggerUnitAbilities(state, events, unit, TRIGGER.ON_ROUND_END, { sourceUnit: unit })
    }
  }
}

function endPlayerRoundCleanup(state: GameState, player: PlayerState, events: GameEvent[]): void {
  discardFleetingCards(player, events)
  purgeEphemeralUnits(state, player, events)
  restoreCardCosts(player.hand)
  restoreCardCosts(player.board)

  for (const card of player.board) {
    if (card.type !== CARD_TYPE.UNIT) continue

    resetUnitRoundState(card, events)
  }
}

function restoreCardCosts(cards: CardInstance[]): void {
  for (const card of cards) {
    if (!card.tempCost) continue

    card.cost += card.tempCost
    card.tempCost = 0
  }
}

function discardFleetingCards(player: PlayerState, events: GameEvent[]): void {
  const fleetingCards = player.hand.filter((card) => card.keywords?.includes(KEYWORD.FLEETING))

  if (fleetingCards.length === 0) return

  const fleetingIds = new Set(fleetingCards.map((c) => c.instanceId))
  player.hand = player.hand.filter((c) => !fleetingIds.has(c.instanceId))
  player.graveyard.push(...fleetingCards)

  for (const card of fleetingCards) {
    events.push({
      type: GAME_EVENT_TYPE.CARD_DISCARDED,
      playerId: player.id,
      cardInstanceId: card.instanceId,
    })
  }
}

function purgeEphemeralUnits(state: GameState, player: PlayerState, events: GameEvent[]): void {
  const ephemeralUnits = player.board.filter((card) => card.keywords?.includes(KEYWORD.EPHEMERAL))

  if (ephemeralUnits.length === 0) return

  const ephemeralIds = new Set(ephemeralUnits.map((c) => c.instanceId))
  player.board = player.board.filter((c) => !ephemeralIds.has(c.instanceId))
  player.graveyard.push(...ephemeralUnits)

  for (const card of ephemeralUnits) {
    events.push({
      type: GAME_EVENT_TYPE.UNIT_DIED,
      unitInstanceId: card.instanceId,
    })
    notifyAllyDeath(state, events, card)
  }
}

function resetUnitRoundState(unit: UnitCardInstance, events: GameEvent[]): void {
  if (unit.tempAttack) {
    unit.attack = Math.max(0, unit.attack - unit.tempAttack)
    unit.tempAttack = 0
  }

  if (unit.tempHealth) {
    unit.health = Math.max(1, unit.health - unit.tempHealth)
    unit.maxHealth = Math.max(1, unit.maxHealth - unit.tempHealth)
    unit.tempHealth = 0
  }

  if (unit.tempKeywords && unit.tempKeywords.length > 0) {
    const tempSet = new Set(unit.tempKeywords)
    unit.keywords = unit.keywords?.filter((k) => !tempSet.has(k))
    unit.tempKeywords = []
  }

  if (unit.keywords?.includes(KEYWORD.BARRIER)) {
    unit.keywords = unit.keywords.filter((k) => k !== KEYWORD.BARRIER)
  }

  healRegenerationUnit(unit, events)
}

function healRegenerationUnit(unit: UnitCardInstance, events: GameEvent[]): void {
  if (!unit.keywords?.includes(KEYWORD.REGENERATION)) return
  if (unit.health >= unit.maxHealth) return

  const delta = unit.maxHealth - unit.health

  unit.health = unit.maxHealth

  events.push({
    type: GAME_EVENT_TYPE.HEAL_DEALT,
    targetId: unit.instanceId,
    amount: delta,
    isReputation: false,
  })
}

function advanceRound(state: GameState, events: GameEvent[]): void {
  state.round += 1
  alternateInitiative(state)

  events.push({
    type: GAME_EVENT_TYPE.ROUND_STARTED,
    initiativePlayerId: state.initiativePlayerId,
    round: state.round,
  })
}

function alternateInitiative(state: GameState): void {
  const prevInitiativeId = state.initiativePlayerId
  const nextInitiativeId = Object.keys(state.players).find((id) => id !== prevInitiativeId)!

  state.initiativePlayerId = nextInitiativeId
  state.turnPlayerId = nextInitiativeId

  state.players[nextInitiativeId]!.hasAttackToken = true
  state.players[prevInitiativeId]!.hasAttackToken = false
}

function runDrawPhase(state: GameState, events: GameEvent[]): void {
  for (const playerId in state.players) {
    refreshEnergy(state.players[playerId]!, playerId, events)
    drawCard(state, playerId, events)

    if (state.winnerPlayerId !== null) {
      return
    }
  }
}

function refreshEnergy(player: PlayerState, playerId: string, events: GameEvent[]): void {
  const leftover = player.energy

  player.maxEnergy = Math.min(10, player.maxEnergy + 1)
  player.energy = player.maxEnergy
  player.reservedEnergy = Math.min(3, player.reservedEnergy + leftover)

  events.push(
    {
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: player.energy,
      isReserved: false,
    },
    {
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: player.reservedEnergy,
      isReserved: true,
    },
  )
}

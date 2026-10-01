import {
  KEYWORD,
  type DeclareAttacksAction,
  type GameEvent,
  type GameState,
  type UnitCardInstance,
} from '../../types'
import { TRIGGER } from '../../types/abilities.types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import { triggerUnitAbilities } from '../abilities/trigger-abilities'
import type { ApplyActionResult } from '../apply-action'

export const declareAttacksAction = (
  state: GameState,
  action: DeclareAttacksAction,
): ApplyActionResult => {
  const nextState = structuredClone(state)

  validateDeclareAttacksAction(nextState, action)
  initializeCombatSlots(nextState, action)
  assignForcedBlockers(nextState, action)

  const events: GameEvent[] = []

  triggerAttackAbilities(nextState, events)

  return {
    state: nextState,
    events,
  }
}

function validateDeclareAttacksAction(state: GameState, action: DeclareAttacksAction): void {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to attack`)
  }

  if (state.combat !== null) {
    throw new Error('Cannot declare attacks: combat is already in progress')
  }

  const playerState = state.players[action.playerId]!
  if (!playerState.hasAttackToken) {
    throw new Error(`Player "${action.playerId}" does not have an active attack token`)
  }

  if (action.attackers.length === 0) {
    throw new Error('Cannot declare attack: at least one attacker must be selected')
  }

  const attackersIds = new Set(action.attackers)
  if (attackersIds.size !== action.attackers.length) {
    throw new Error('Cannot declare attack: duplicate attacker IDs detected')
  }

  const allAttackersOnBoard = action.attackers.every((attackerId) =>
    playerState.board.some((unit) => unit.instanceId === attackerId),
  )
  if (!allAttackersOnBoard) {
    throw new Error(
      `Cannot declare attack: one or more attackers are not present on player "${action.playerId}" board`,
    )
  }

  const hasCannotAttackUnit = action.attackers.some((id) => {
    const unit = playerState.board.find((u) => u.instanceId === id)
    return unit?.keywords?.includes(KEYWORD.CANNOT_ATTACK)
  })
  if (hasCannotAttackUnit) {
    throw new Error('Cannot declare attack: one or more attackers have the "cannot_attack" keyword')
  }

  const hasStunnedUnit = action.attackers.some((id) => {
    const unit = playerState.board.find((u) => u.instanceId === id)
    return unit?.keywords?.includes(KEYWORD.STUNNED)
  })

  if (hasStunnedUnit) {
    throw new Error(
      `Cannot declare attack: one or more attackers have the "${KEYWORD.STUNNED}" keyword`,
    )
  }

  validateForcedBlockers(state, action)
}

function validateForcedBlockers(state: GameState, action: DeclareAttacksAction): void {
  const forcedBlockers = action.forcedBlockers ?? []

  if (forcedBlockers.length === 0) return

  const defenderIds = forcedBlockers.map((pair) => pair.defenderInstanceId)

  if (new Set(defenderIds).size !== defenderIds.length) {
    throw new Error(
      'Cannot declare attack: the same defender unit is assigned to multiple forced blockers',
    )
  }

  const attackerIds = forcedBlockers.map((pair) => pair.attackerInstanceId)

  if (new Set(attackerIds).size !== attackerIds.length) {
    throw new Error('Cannot declare attack: multiple forced blockers assigned to the same attacker')
  }

  const defenderState = state.players[getNextPlayerId(state)]!

  for (const pair of forcedBlockers) {
    if (!action.attackers.includes(pair.attackerInstanceId)) {
      throw new Error(
        'Cannot declare attack: forced blocker is assigned to a unit that is not attacking',
      )
    }

    const blocker = defenderState.board.find((unit) => unit.instanceId === pair.defenderInstanceId)

    if (!blocker) {
      throw new Error(
        `Cannot declare attack: forced blocker unit "${pair.defenderInstanceId}" is not present on player "${defenderState.id}" board`,
      )
    }

    validateForcedBlockerLegality(state, action, pair, blocker)
  }
}

function validateForcedBlockerLegality(
  state: GameState,
  action: DeclareAttacksAction,
  pair: { attackerInstanceId: string; defenderInstanceId: string },
  blocker: UnitCardInstance,
): void {
  if (blocker.keywords?.includes(KEYWORD.STUNNED)) {
    throw new Error(
      `Cannot declare attack: stunned unit "${blocker.instanceId}" cannot be forced to block`,
    )
  }

  if (blocker.keywords?.includes(KEYWORD.VULNERABLE)) return

  const attacker = state.players[action.playerId]!.board.find(
    (unit) => unit.instanceId === pair.attackerInstanceId,
  )!

  if (!attacker.keywords?.includes(KEYWORD.CHALLENGER)) {
    throw new Error(
      `Cannot declare attack: unit "${blocker.instanceId}" can only be forced to block by a "challenger" attacker or while having the "vulnerable" keyword`,
    )
  }

  if (blocker.keywords?.includes(KEYWORD.CANNOT_BLOCK)) {
    throw new Error(
      `Cannot declare attack: unit "${blocker.instanceId}" has the "cannot_block" keyword and cannot be forced to block`,
    )
  }

  const attackerIsElusive = attacker.keywords?.includes(KEYWORD.ELUSIVE)
  const blockerIsElusive = blocker.keywords?.includes(KEYWORD.ELUSIVE)

  if (attackerIsElusive && !blockerIsElusive) {
    throw new Error(
      `Cannot declare attack: unit "${blocker.instanceId}" cannot block elusive attacker "${attacker.instanceId}"`,
    )
  }

  const attackerIsPressure = attacker.keywords?.includes(KEYWORD.PRESSURE)

  if (attackerIsPressure && blocker.attack < 3) {
    throw new Error(
      `Cannot declare attack: unit "${blocker.instanceId}" has less than 3 attack and cannot block pressure attacker "${attacker.instanceId}"`,
    )
  }
}

function assignForcedBlockers(state: GameState, action: DeclareAttacksAction): void {
  const forcedBlockers = action.forcedBlockers ?? []

  if (forcedBlockers.length === 0) return

  const defenderState = state.players[state.combat!.defenderPlayerId]!

  for (const pair of forcedBlockers) {
    const slot = state.combat!.slots.find((s) => s.attacker.instanceId === pair.attackerInstanceId)!
    const blocker = defenderState.board.find((unit) => unit.instanceId === pair.defenderInstanceId)!

    defenderState.board = defenderState.board.filter(
      (unit) => unit.instanceId !== pair.defenderInstanceId,
    )
    slot.blocker = blocker
  }
}

function initializeCombatSlots(state: GameState, action: DeclareAttacksAction): void {
  const playerState = state.players[action.playerId]!
  const playerBoardCards = playerState.board
  const attackersIds = new Set(action.attackers)

  state.combat = {
    attackerPlayerId: action.playerId,
    defenderPlayerId: getNextPlayerId(state),
    blocksDeclared: false,
    slots: action.attackers.map((cardInstanceId) => {
      const attacker = playerBoardCards.find(
        (card) => card.instanceId === cardInstanceId,
      ) as UnitCardInstance

      return {
        attacker,
        blocker: null,
      }
    }),
  }

  playerState.board = playerBoardCards.filter((card) => !attackersIds.has(card.instanceId))
  playerState.hasAttackToken = false
  state.turnPlayerId = getNextPlayerId(state)
  state.consecutivePasses = 0
}

function triggerAttackAbilities(state: GameState, events: GameEvent[]): void {
  const slots = state.combat!.slots

  for (let i = 0; i < slots.length; i++) {
    const currentSlot = slots[i]!
    const supportedAlly = slots[i + 1]?.attacker

    triggerUnitAbilities(state, events, currentSlot.attacker, TRIGGER.ON_ATTACK, {
      sourceUnit: currentSlot.attacker,
      targetUnit: supportedAlly,
    })
  }
}

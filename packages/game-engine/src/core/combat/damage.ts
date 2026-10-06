import { GAME_EVENT_TYPE, KEYWORD, type GameEvent, type GameState, type UnitCardInstance } from '../../types'
import { TRIGGER } from '../../types/abilities.types'
import { notifyAllyDeath, triggerUnitAbilities } from '../abilities/trigger-abilities'
import { checkReputation, gameIsOver } from '../end-game'
import { removeFromCombat } from './remove-from-combat'

export const calculateDamage = (amount: number, target: UnitCardInstance, isCombatDamage = false): number => {
  if (amount <= 0) return 0
  if (isCombatDamage && target.keywords?.includes(KEYWORD.INVULNERABLE)) return 0
  if (target.keywords?.includes(KEYWORD.BARRIER)) {
    target.keywords = target.keywords.filter((keyword) => keyword !== KEYWORD.BARRIER)
    target.tempKeywords = target.tempKeywords?.filter((keyword) => keyword !== KEYWORD.BARRIER)
    return 0
  }
  return Math.max(0, amount - (target.keywords?.includes(KEYWORD.TOUGH) ? 1 : 0))
}

export const killUnit = (state: GameState, events: GameEvent[], unit: UnitCardInstance): void => {
  const owner = state.players[unit.ownerId]!
  if (owner.graveyard.some((card) => card.instanceId === unit.instanceId)) return
  unit.health = Math.min(0, unit.health)
  removeFromCombat(state, unit.instanceId)
  owner.board = owner.board.filter((card) => card.instanceId !== unit.instanceId)
  owner.graveyard.push(unit)
  events.push({ type: GAME_EVENT_TYPE.UNIT_DIED, unitInstanceId: unit.instanceId })
  triggerUnitAbilities(state, events, unit, TRIGGER.ON_DEATH, { sourceUnit: unit })
  notifyAllyDeath(state, events, unit)
}

export const applyDamageToUnits = (state: GameState, events: GameEvent[], units: UnitCardInstance[], amount: number): void => {
  if (state.phase === 'finished') return
  const targets = [...new Map(units.filter((unit) => unit.health > 0).map((unit) => [unit.instanceId, unit])).values()]
  for (const target of targets) {
    const damage = calculateDamage(amount, target)
    target.health -= damage
    events.push({ type: GAME_EVENT_TYPE.DAMAGE_DEALT, targetId: target.instanceId, amount: damage, isReputation: false })
  }
  for (const target of targets) {
    if (target.health <= 0) killUnit(state, events, target)
    if (gameIsOver(state)) break
  }
}

export const applyDamageToUnit = (state: GameState, events: GameEvent[], unit: UnitCardInstance, amount: number): void => {
  applyDamageToUnits(state, events, [unit], amount)
}

export const applyDirectReputationDamage = (state: GameState, events: GameEvent[], playerId: string, amount: number): void => {
  if (state.phase === 'finished' || amount <= 0) return
  state.players[playerId]!.reputation -= amount
  events.push({ type: GAME_EVENT_TYPE.DAMAGE_DEALT, targetId: playerId, amount, isReputation: true })
  checkReputation(state, events)
}

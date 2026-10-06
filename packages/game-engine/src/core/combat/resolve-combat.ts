import { MAX_REPUTATION } from '../../constants/game'
import { GAME_EVENT_TYPE, KEYWORD, type CombatSlot, type GameEvent, type GameState, type UnitCardInstance } from '../../types'
import { TRIGGER } from '../../types/abilities.types'
import { triggerUnitAbilities } from '../abilities/trigger-abilities'
import { checkReputation, gameIsOver } from '../end-game'
import { calculateDamage, killUnit } from './damage'

export { applyDamageToUnit, applyDirectReputationDamage } from './damage'

interface Strike {
  unit: UnitCardInstance
  target: UnitCardInstance | null
  nexusId: string | null
  unitDamage: number
  nexusDamage: number
  impactDamage: number
}

export const resolveCombat = (state: GameState, events: GameEvent[]): void => {
  const combat = state.combat!
  for (const slot of combat.slots.slice()) {
    if (state.phase === 'finished') break
    if (!combat.slots.includes(slot)) continue
    resolveSlot(state, events, slot, combat.defenderPlayerId)
    returnSurvivors(state, slot)
    combat.slots = combat.slots.filter((item) => item !== slot)
  }
  for (const slot of combat.slots) returnSurvivors(state, slot)
}

function returnSurvivors(state: GameState, slot: CombatSlot): void {
  for (const unit of [slot.attacker, slot.blocker]) {
    if (!unit || unit.health <= 0) continue
    const board = state.players[unit.ownerId]!.board
    if (!board.some((card) => card.instanceId === unit.instanceId)) board.push(unit)
  }
}

function resolveSlot(state: GameState, events: GameEvent[], slot: CombatSlot, nexusId: string): void {
  const attacker = slot.attacker
  const firstStrike = attacker.keywords?.includes(KEYWORD.QUICK_ATTACK) || attacker.keywords?.includes(KEYWORD.DOUBLE_ATTACK)
  if (firstStrike) {
    resolveStrikes(state, events, [attackingStrike(slot, nexusId)])
    if (state.phase === 'finished' || attacker.health <= 0) return
    if (attacker.keywords?.includes(KEYWORD.DOUBLE_ATTACK)) {
      const attacks = attackingStrike(slot, nexusId)
      const retaliation = defendingStrike(slot)
      resolveStrikes(state, events, [retaliation, attacks])
    } else if (slot.blocker) {
      resolveStrikes(state, events, [defendingStrike(slot)])
    }
  } else {
    resolveStrikes(state, events, [defendingStrike(slot), attackingStrike(slot, nexusId)])
  }
}

function attackingStrike(slot: CombatSlot, nexusId: string): Strike | null {
  const attacker = slot.attacker
  if (attacker.attack <= 0 || attacker.health <= 0) return null
  if (!slot.blocker && slot.wasBlocked && !attacker.keywords?.includes(KEYWORD.OVERWHELM)) return null
  const blocker = slot.blocker
  const overflow = attacker.keywords?.includes(KEYWORD.OVERWHELM) && blocker
    ? Math.max(0, attacker.attack - blocker.health - (blocker.keywords?.includes(KEYWORD.TOUGH) ? 1 : 0))
    : 0
  return {
    unit: attacker,
    target: blocker,
    nexusId,
    unitDamage: blocker ? calculateDamage(attacker.attack - overflow, blocker, true) : 0,
    nexusDamage: blocker ? overflow : attacker.attack,
    impactDamage: attacker.keywords?.includes(KEYWORD.RAM) ? 1 : 0,
  }
}

function defendingStrike(slot: CombatSlot): Strike | null {
  const blocker = slot.blocker
  if (!blocker || blocker.attack <= 0 || blocker.health <= 0 || slot.attacker.health <= 0) return null
  return {
    unit: blocker, target: slot.attacker, nexusId: null,
    unitDamage: calculateDamage(blocker.attack, slot.attacker, true), nexusDamage: 0, impactDamage: 0,
  }
}

function resolveStrikes(state: GameState, events: GameEvent[], candidates: (Strike | null)[]): void {
  const strikes = candidates.filter((strike): strike is Strike => strike !== null)
  const nexusDamage = new Map<string, number>()
  const healing = new Map<string, number>()
  for (const strike of strikes) {
    if (strike.target) {
      strike.target.health -= strike.unitDamage
      events.push({ type: GAME_EVENT_TYPE.DAMAGE_DEALT, targetId: strike.target.instanceId, amount: strike.unitDamage, isReputation: false })
    }
    if (strike.nexusId && strike.nexusDamage + strike.impactDamage > 0) {
      const amount = strike.nexusDamage + strike.impactDamage
      nexusDamage.set(strike.nexusId, (nexusDamage.get(strike.nexusId) ?? 0) + amount)
      events.push({ type: GAME_EVENT_TYPE.DAMAGE_DEALT, targetId: strike.nexusId, amount, isReputation: true })
    }
    if (strike.unit.keywords?.includes(KEYWORD.LIFESTEAL)) {
      const amount = strike.unitDamage + strike.nexusDamage
      healing.set(strike.unit.ownerId, (healing.get(strike.unit.ownerId) ?? 0) + amount)
    }
  }
  for (const player of Object.values(state.players)) {
    const damage = nexusDamage.get(player.id) ?? 0
    const amount = Math.min(healing.get(player.id) ?? 0, MAX_REPUTATION - player.reputation + damage)
    player.reputation = Math.min(MAX_REPUTATION, player.reputation - damage + amount)
    if (amount > 0) events.push({ type: GAME_EVENT_TYPE.HEAL_DEALT, targetId: player.id, amount, isReputation: true })
  }
  checkReputation(state, events)
  if (state.phase !== 'finished') {
    for (const strike of strikes) {
      if (strike.nexusDamage > 0) triggerUnitAbilities(state, events, strike.unit, TRIGGER.ON_REPUTATION_STRIKE, { sourceUnit: strike.unit })
      if (gameIsOver(state)) break
    }
  }
  for (const strike of strikes) {
    if (strike.target && strike.target.health <= 0 && strike.unit.health > 0) {
      if (strike.unit.keywords?.includes(KEYWORD.FURY)) {
        strike.unit.attack += 1
        strike.unit.health += 1
        strike.unit.maxHealth += 1
      }
      triggerUnitAbilities(state, events, strike.unit, TRIGGER.ON_KILL, { sourceUnit: strike.unit })
    }
  }
  for (const strike of strikes) {
    if (strike.target && strike.target.health <= 0) killUnit(state, events, strike.target)
  }
  for (const strike of strikes) {
    if (strike.unit.health <= 0 || strike.unit.keywords?.includes(KEYWORD.EPHEMERAL)) killUnit(state, events, strike.unit)
  }
}

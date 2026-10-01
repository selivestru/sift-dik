import { MAX_REPUTATION } from '../../constants/game'
import {
  GAME_EVENT_TYPE,
  KEYWORD,
  type GameEvent,
  type GameState,
  type PlayerState,
  type UnitCardInstance,
} from '../../types'
import { TRIGGER } from '../../types/abilities.types'
import { triggerUnitAbilities } from '../abilities/trigger-abilities'

export const resolveCombat = (state: GameState, events: GameEvent[]): void => {
  const attackerPlayer = state.players[state.combat!.attackerPlayerId]!
  const defenderPlayer = state.players[state.combat!.defenderPlayerId]!

  for (const { attacker, blocker } of state.combat!.slots) {
    if (blocker) {
      resolveBlockedCombat(state, events, attacker, blocker, attackerPlayer, defenderPlayer)
    } else {
      executeUnblockedCombat(state, events, attacker, attackerPlayer, defenderPlayer)
    }

    if (state.winnerPlayerId !== null) {
      break
    }
  }
}

function resolveBlockedCombat(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState,
): void {
  const hasDoubleAttack = attacker.keywords?.includes(KEYWORD.DOUBLE_ATTACK)
  const hasQuickAttack = attacker.keywords?.includes(KEYWORD.QUICK_ATTACK)

  if (hasDoubleAttack) {
    executeDoubleAttackCombat(state, events, attacker, blocker, attackerPlayer, defenderPlayer)
  } else if (hasQuickAttack) {
    executeQuickAttackCombat(state, events, attacker, blocker, attackerPlayer, defenderPlayer)
  } else {
    executeStandardCombat(state, events, attacker, blocker, attackerPlayer, defenderPlayer)
  }

  applyCombatCleanup(state, events, attacker, blocker, attackerPlayer, defenderPlayer)
}

function executeDoubleAttackCombat(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState,
): void {
  executeAttackerStrike(state, events, attacker, blocker, attackerPlayer.id, defenderPlayer)

  if (blocker.health > 0 && state.winnerPlayerId === null) {
    executeSimultaneousStrikes(state, events, attacker, blocker, attackerPlayer.id, defenderPlayer)
  }
}

function executeQuickAttackCombat(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState,
): void {
  const isGameOver = executeAttackerStrike(
    state,
    events,
    attacker,
    blocker,
    attackerPlayer.id,
    defenderPlayer,
  )

  if (blocker.health > 0 && !isGameOver) {
    executeBlockerRetaliation(state, events, attacker, blocker)
  }
}

function executeStandardCombat(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState,
): void {
  executeSimultaneousStrikes(state, events, attacker, blocker, attackerPlayer.id, defenderPlayer)
}

function executeUnblockedCombat(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState,
): void {
  const strikeCount = attacker.keywords?.includes(KEYWORD.DOUBLE_ATTACK) ? 2 : 1
  const ramBonus = attacker.keywords?.includes(KEYWORD.RAM) ? 1 : 0
  const totalFaceDamage = attacker.attack + ramBonus

  for (let i = 0; i < strikeCount; i++) {
    applyLifesteal(state, events, attacker)

    const isGameOver = applyReputationDamage(
      state,
      events,
      attacker,
      defenderPlayer,
      attackerPlayer.id,
      totalFaceDamage,
    )

    if (isGameOver) break
  }

  handlePostCombatZonePlacement(state, events, attacker, attackerPlayer)
}

function executeAttackerStrike(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  winnerPlayerId: string,
  defenderPlayer: PlayerState,
): boolean {
  const { blockerDamage, reputationDamage } = calculateStrikeDamage(attacker, blocker)
  blocker.health -= blockerDamage

  applyLifesteal(state, events, attacker)

  events.push({
    type: GAME_EVENT_TYPE.DAMAGE_DEALT,
    targetId: blocker.instanceId,
    amount: blockerDamage,
    isReputation: false,
  })

  return applyReputationDamage(
    state,
    events,
    attacker,
    defenderPlayer,
    winnerPlayerId,
    reputationDamage,
  )
}

function executeBlockerRetaliation(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
): void {
  const damageToAttacker = calculateDamage(blocker.attack, attacker)
  attacker.health -= damageToAttacker

  applyLifesteal(state, events, blocker)

  events.push({
    type: GAME_EVENT_TYPE.DAMAGE_DEALT,
    targetId: attacker.instanceId,
    amount: damageToAttacker,
    isReputation: false,
  })
}

function executeSimultaneousStrikes(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  winnerPlayerId: string,
  defenderPlayer: PlayerState,
): void {
  const damageToAttacker = calculateDamage(blocker.attack, attacker)
  const { blockerDamage, reputationDamage } = calculateStrikeDamage(attacker, blocker)

  attacker.health -= damageToAttacker
  blocker.health -= blockerDamage

  applyLifesteal(state, events, blocker)
  applyLifesteal(state, events, attacker)

  events.push(
    {
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: attacker.instanceId,
      amount: damageToAttacker,
      isReputation: false,
    },
    {
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: blocker.instanceId,
      amount: blockerDamage,
      isReputation: false,
    },
  )

  applyReputationDamage(state, events, attacker, defenderPlayer, winnerPlayerId, reputationDamage)
}

function applyCombatCleanup(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState,
): void {
  if (attacker.health > 0 && blocker.health <= 0 && attacker.keywords?.includes(KEYWORD.FURY)) {
    attacker.attack += 1
    attacker.health += 1
    attacker.maxHealth += 1
  }

  if (blocker.health > 0 && attacker.health <= 0 && blocker.keywords?.includes(KEYWORD.FURY)) {
    blocker.attack += 1
    blocker.health += 1
    blocker.maxHealth += 1
  }

  handlePostCombatZonePlacement(state, events, attacker, attackerPlayer)
  handlePostCombatZonePlacement(state, events, blocker, defenderPlayer)
}

function handlePostCombatZonePlacement(
  _state: GameState,
  events: GameEvent[],
  unit: UnitCardInstance,
  player: PlayerState,
): void {
  const unitStrikes = unit.attack > 0
  const dies = unit.health <= 0 || (unitStrikes && unit.keywords?.includes(KEYWORD.EPHEMERAL))

  if (dies) {
    player.graveyard.push(unit)
    events.push({ type: GAME_EVENT_TYPE.UNIT_DIED, unitInstanceId: unit.instanceId })
  } else {
    player.board.push(unit)
  }
}

function applyLifesteal(state: GameState, events: GameEvent[], striker: UnitCardInstance): void {
  const hasLifeSteal = striker.keywords?.includes(KEYWORD.LIFESTEAL)

  if (hasLifeSteal) {
    const player = state.players[striker.ownerId]!

    state.players[player.id]!.reputation = Math.min(
      MAX_REPUTATION,
      player.reputation + striker.attack,
    )

    events.push({
      type: GAME_EVENT_TYPE.HEAL_DEALT,
      targetId: player.id,
      amount: striker.attack,
      isReputation: true,
    })
  }
}

function calculateDamage(damage: number, target: UnitCardInstance): number {
  if (target.keywords?.includes(KEYWORD.INVULNERABLE)) {
    return 0
  }

  if (target.keywords?.includes(KEYWORD.BARRIER) && damage > 0) {
    target.keywords = target.keywords.filter((k) => k !== KEYWORD.BARRIER)
    return 0
  }

  const hasTough = target.keywords?.includes(KEYWORD.TOUGH)
  if (hasTough) {
    return Math.max(0, damage - 1)
  }
  return damage
}

interface StrikeDamageResult {
  blockerDamage: number
  reputationDamage: number
}

function calculateStrikeDamage(
  attacker: UnitCardInstance,
  blocker: UnitCardInstance,
): StrikeDamageResult {
  const hasOverwhelm = attacker.keywords?.includes(KEYWORD.OVERWHELM)
  const ramBonus = attacker.keywords?.includes(KEYWORD.RAM) ? 1 : 0

  if (hasOverwhelm) {
    const neededToKillBlocker = blocker.keywords?.includes(KEYWORD.TOUGH)
      ? blocker.health + 1
      : blocker.health

    const excessDamage = Math.max(0, attacker.attack - neededToKillBlocker)
    const damageToBlockerRaw = attacker.attack - excessDamage
    const blockerDamage = calculateDamage(damageToBlockerRaw, blocker)

    return {
      blockerDamage,
      reputationDamage: excessDamage + ramBonus,
    }
  }

  return {
    blockerDamage: calculateDamage(attacker.attack, blocker),
    reputationDamage: ramBonus,
  }
}

function applyReputationDamage(
  state: GameState,
  events: GameEvent[],
  attacker: UnitCardInstance,
  targetPlayer: PlayerState,
  winnerPlayerId: string,
  amount: number,
): boolean {
  if (amount <= 0) return false

  targetPlayer.reputation -= amount

  events.push({
    type: GAME_EVENT_TYPE.DAMAGE_DEALT,
    targetId: targetPlayer.id,
    amount,
    isReputation: true,
  })

  triggerUnitAbilities(state, events, attacker, TRIGGER.ON_REPUTATION_STRIKE, {
    sourceUnit: attacker,
  })

  if (targetPlayer.reputation <= 0) {
    state.winnerPlayerId = winnerPlayerId
    events.push({
      type: GAME_EVENT_TYPE.GAME_OVER,
      winnerPlayerId,
    })
    return true
  }

  return false
}

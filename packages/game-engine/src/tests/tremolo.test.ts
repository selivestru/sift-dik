import { describe, expect, test } from 'vitest'

import { tremoloCard } from '../catalog/characters/tremolo'
import { TREMOLO_PATH, type TremoloPath } from '../constants/characters'
import { applyAction } from '../core'
import { createGame } from './scenario'
import { GAME_ACTION_TYPE, GAME_EVENT_TYPE, KEYWORD, type UnitCard } from '../types'

const createUnit = (overrides: Partial<UnitCard> = {}): UnitCard => ({
  id: 'unit-template',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

const createTremoloGame = () => {
  const allyCard = createUnit({
    id: 'freshman-ally',
    attack: 2,
    baseAttack: 2,
    health: 2,
    baseHealth: 2,
    maxHealth: 2,
  })

  const state = createGame(
    [
      { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
      { id: 'p2', cards: [tremoloCard, allyCard, tremoloCard, allyCard, tremoloCard] },
    ],
    { seed: 42 },
  )

  state.players.p2!.energy = 10
  state.players.p2!.maxEnergy = 10

  return state
}

const playTremolo = (state: ReturnType<typeof createTremoloGame>, chosenPath?: TremoloPath) => {
  const playerId = state.turnPlayerId
  const tremoloInHand = state.players[playerId]!.hand.find((c) => c.id === 'tremolo')!

  return applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId,
    cardInstanceId: tremoloInHand.instanceId,
    abilityContexts: chosenPath ? { tremolo_path: { chosenPath } } : undefined,
  })
}

describe('Character: Tremolo', () => {
  test('DIK path: grants permanent +1|+0 and quick_attack on summon', () => {
    const state = createTremoloGame()

    const result = playTremolo(state, TREMOLO_PATH.DIK)

    const tremolo = result.state.players.p2!.board.find((u) => u.id === 'tremolo')!
    expect(tremolo.attack).toBe(4)
    expect(tremolo.keywords).toContain(KEYWORD.QUICK_ATTACK)
    expect(tremolo.tempKeywords ?? []).toHaveLength(0)
  })

  test('Neutral path: reduces attack by 1, grants elusive and restores 1 reserved energy', () => {
    const state = createTremoloGame()

    const result = playTremolo(state, TREMOLO_PATH.NEUTRAL)

    const tremolo = result.state.players.p2!.board.find((u) => u.id === 'tremolo')!
    expect(tremolo.attack).toBe(2)
    expect(tremolo.keywords).toContain(KEYWORD.ELUSIVE)

    expect(result.events).toContainEqual({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: 'p2',
      energy: 1,
      isReserved: true,
    })
    expect(result.state.players.p2!.reservedEnergy).toBe(1)
  })

  test('CHICK path: grants tough and support buffs the ally to the right, expiring at round end', () => {
    const state = createTremoloGame()

    const tremoloPlay = playTremolo(state, TREMOLO_PATH.CHICK)

    const tremolo = tremoloPlay.state.players.p2!.board.find((u) => u.id === 'tremolo')!
    expect(tremolo.keywords).toContain(KEYWORD.TOUGH)
    expect(tremolo.abilities).toContain('tremolo_support')

    const p1Pass1 = applyAction(tremoloPlay.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: 'p1',
    }).state

    const allyInHand = p1Pass1.players.p2!.hand.find((c) => c.id === 'freshman-ally')!
    const afterAllyPlay = applyAction(p1Pass1, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: 'p2',
      cardInstanceId: allyInHand.instanceId,
    }).state

    const p1Pass2 = applyAction(afterAllyPlay, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: 'p1',
    }).state

    const tremoloOnBoard = p1Pass2.players.p2!.board.find((u) => u.id === 'tremolo')!
    const allyOnBoard = p1Pass2.players.p2!.board.find((u) => u.id === 'freshman-ally')!

    const attackResult = applyAction(p1Pass2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: 'p2',
      attackers: [tremoloOnBoard.instanceId, allyOnBoard.instanceId],
    })

    const slotAlly = attackResult.state.combat!.slots[1]!.attacker
    expect(slotAlly.attack).toBe(3)
    expect(slotAlly.health).toBe(3)
    expect(slotAlly.tempAttack).toBe(1)
    expect(slotAlly.tempHealth).toBe(1)

    const combatResult = applyAction(attackResult.state, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: 'p1',
      blocks: [],
    })

    const strikePass = combatResult.state

    const resolvedCombat = combatResult.state

    const allyAfterCombat = resolvedCombat.players.p2!.board.find((u) => u.id === 'freshman-ally')!
    expect(allyAfterCombat.attack).toBe(3)
    expect(allyAfterCombat.health).toBe(3)

    const pass1 = applyAction(resolvedCombat, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: resolvedCombat.turnPlayerId,
    }).state

    const nextRoundState = applyAction(pass1, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: pass1.turnPlayerId,
    }).state

    const allyRound2 = nextRoundState.players.p2!.board.find((u) => u.id === 'freshman-ally')!
    expect(allyRound2.attack).toBe(2)
    expect(allyRound2.health).toBe(2)
    expect(allyRound2.tempAttack).toBe(0)
    expect(allyRound2.tempHealth).toBe(0)
  })

  test('Rejects playing Tremolo without a chosen path', () => {
    const state = createTremoloGame()

    expect(() => playTremolo(state)).toThrow(/tremolo_path/)
  })

  test('Rejects playing Tremolo with an unknown path', () => {
    const state = createTremoloGame()

    expect(() => playTremolo(state, 'chad' as TremoloPath)).toThrow(/Invalid option/)
  })

  test('Other units do not require a path and are unaffected by ON_SUMMON', () => {
    const state = createTremoloGame()

    const p2Pass = applyAction(state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: 'p2',
    }).state

    const unitInHand = p2Pass.players.p1!.hand.find((c) => c.id === 'unit-template')!

    const result = applyAction(p2Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: 'p1',
      cardInstanceId: unitInHand.instanceId,
    })

    const unit = result.state.players.p1!.board.find((u) => u.id === 'unit-template')!
    expect(unit.attack).toBe(2)
    expect(unit.keywords ?? []).toHaveLength(0)
  })
})

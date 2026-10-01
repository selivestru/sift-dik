import { describe, expect, test } from 'vitest'

import { derekCard } from '../catalog/characters/derek'
import { mayaCard } from '../catalog/characters/maya'
import { tremoloCard } from '../catalog/characters/tremolo'
import { brothersShoulder } from '../catalog/spells/brothers-shoulder'
import { applyAction, createGame } from '../core'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type UnitCard,
  type UnitCardInstance,
} from '../types'
import { SPELL_TYPES } from '../types/spells.types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

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

const arrangeZones = (
  state: GameState,
  playerId: string,
  handIds: string[],
  deckIds: string[],
): void => {
  const player = state.players[playerId]!
  const cards: CardInstance[] = [...player.hand, ...player.deck]

  player.hand = handIds.map((id) => cards.find((c) => c.id === id)!)
  player.deck = deckIds.map((id) => cards.find((c) => c.id === id)!)
}

describe('Character: Derek', () => {
  test('summon takes Maya from the deck into hand', () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard)], { seed: 42 })

    const p2Id = state.turnPlayerId
    arrangeZones(
      state,
      p2Id,
      ['derek'],
      ['maya', 'unit-template', 'unit-template', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'maya')).toBeDefined()
    expect(afterPlay.players[p2Id]!.deck.find((c) => c.id === 'maya')).toBeUndefined()
  })

  test('summon does nothing when Maya is not in the deck', () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard)], { seed: 42 })

    const p2Id = state.turnPlayerId
    arrangeZones(
      state,
      p2Id,
      ['derek', 'maya'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'maya')).toBeDefined()
    expect(afterPlay.players[p2Id]!.deck).toHaveLength(3)
  })

  test('attacking alongside Tremolo grants both +1|+1 this round', () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard, tremoloCard)], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const afterP1Pass = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterTremolo = applyAction(afterP1Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterP1Pass.players[p2Id]!.hand.find((c) => c.id === 'tremolo')!.instanceId,
      abilityContexts: { tremolo_path: { chosenPath: 'dik' } },
    }).state

    const backToP2 = applyAction(afterTremolo, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const derekOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'derek')!
    const tremoloOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'tremolo')!

    const attackState = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [derekOnBoard.instanceId, tremoloOnBoard.instanceId],
    }).state

    const derekSlot = attackState.combat!.slots.find(
      (s) => s.attacker.instanceId === derekOnBoard.instanceId,
    )!
    const tremoloSlot = attackState.combat!.slots.find(
      (s) => s.attacker.instanceId === tremoloOnBoard.instanceId,
    )!

    expect(derekSlot.attacker.attack).toBe(3)
    expect(derekSlot.attacker.health).toBe(4)
    expect(derekSlot.attacker.tempAttack).toBe(1)
    expect(tremoloSlot.attacker.tempAttack).toBe(1)
    expect(tremoloSlot.attacker.tempHealth).toBe(1)

    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [],
    }).state

    const strikePass = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockState.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    }).state

    const round2 = finishRound(combatResult)

    const derekAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'derek')!

    expect(derekAfterRound.attack).toBe(2)
    expect(derekAfterRound.health).toBe(3)
    expect(derekAfterRound.tempAttack).toBe(0)
  })

  test('attacking without Tremolo grants no buff', () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const backToP2 = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const derekOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'derek')!

    const attackState = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [derekOnBoard.instanceId],
    }).state

    expect(attackState.combat!.slots[0]!.attacker.attack).toBe(2)
    expect(attackState.combat!.slots[0]!.attacker.tempAttack ?? 0).toBe(0)
  })

  test('allied Maya dying in combat grants Derek +2|+2 and overwhelm', () => {
    const state = createGame(
      [
        {
          id: 'p1',
          cards: [
            createUnit({
              id: 'blocker',
              attack: 3,
              baseAttack: 3,
              baseHealth: 3,
              health: 3,
              maxHealth: 3,
            }),
            createUnit(),
            createUnit(),
            createUnit(),
            createUnit(),
          ],
        },
        p2Cards(derekCard, mayaCard),
      ],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const afterBlocker = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterDerek.players[p1Id]!.hand.find((c) => c.id === 'blocker')!.instanceId,
    }).state

    const afterMaya = applyAction(afterBlocker, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterBlocker.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    const backToP2 = applyAction(afterMaya, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const derekOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'derek')!
    const mayaOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'maya')!

    const attackState = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [mayaOnBoard.instanceId],
    }).state

    const blockerOnBoard = attackState.players[p1Id]!.board.find((u) => u.id === 'blocker')!

    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [
        {
          attackerInstanceId: mayaOnBoard.instanceId,
          defenderInstanceId: blockerOnBoard.instanceId,
        },
      ],
    }).state

    const strikePass = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockState.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    }).state

    expect(combatResult.players[p2Id]!.graveyard.find((u) => u.id === 'maya')).toBeDefined()

    const derekAfterDeath = combatResult.players[p2Id]!.board.find((u) => u.id === 'derek')!

    expect(derekAfterDeath.attack).toBe(4)
    expect(derekAfterDeath.health).toBe(5)
    expect(derekAfterDeath.maxHealth).toBe(5)
    expect(derekAfterDeath.keywords).toContain(KEYWORD.OVERWHELM)
  })

  test('dead Derek does not avenge Maya', () => {
    const state = createGame(
      [
        {
          id: 'p1',
          cards: [
            createUnit({
              id: 'blocker-a',
              attack: 3,
              baseAttack: 3,
              baseHealth: 3,
              health: 3,
              maxHealth: 3,
            }),
            createUnit({
              id: 'blocker-b',
              attack: 3,
              baseAttack: 3,
              baseHealth: 3,
              health: 3,
              maxHealth: 3,
            }),
            createUnit(),
            createUnit(),
            createUnit(),
          ],
        },
        p2Cards(derekCard, mayaCard),
      ],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const afterBlockerA = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterDerek.players[p1Id]!.hand.find((c) => c.id === 'blocker-a')!.instanceId,
    }).state

    const afterMaya = applyAction(afterBlockerA, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterBlockerA.players[p2Id]!.hand.find((c) => c.id === 'maya')!.instanceId,
    }).state

    const afterBlockerB = applyAction(afterMaya, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterMaya.players[p1Id]!.hand.find((c) => c.id === 'blocker-b')!.instanceId,
    }).state

    const derekOnBoard = afterBlockerB.players[p2Id]!.board.find((u) => u.id === 'derek')!
    const mayaOnBoard = afterBlockerB.players[p2Id]!.board.find((u) => u.id === 'maya')!

    const attackState = applyAction(afterBlockerB, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [derekOnBoard.instanceId, mayaOnBoard.instanceId],
    }).state

    const blockerA = attackState.players[p1Id]!.board.find((u) => u.id === 'blocker-a')!
    const blockerB = attackState.players[p1Id]!.board.find((u) => u.id === 'blocker-b')!

    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [
        {
          attackerInstanceId: derekOnBoard.instanceId,
          defenderInstanceId: blockerA.instanceId,
        },
        {
          attackerInstanceId: mayaOnBoard.instanceId,
          defenderInstanceId: blockerB.instanceId,
        },
      ],
    }).state

    const strikePass = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockState.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    }).state

    const deadDerek = combatResult.players[p2Id]!.graveyard.find(
      (u): u is UnitCardInstance => u.id === 'derek',
    )!

    expect(combatResult.players[p2Id]!.graveyard.find((u) => u.id === 'maya')).toBeDefined()
    expect(deadDerek.maxHealth).toBe(3)
    expect(deadDerek.keywords ?? []).not.toContain(KEYWORD.OVERWHELM)
  })

  test("Brother's Shoulder damages own unit and buffs an ally this round", () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard, brothersShoulder)], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)
    arrangeZones(
      state,
      p2Id,
      ['derek', 'brothers-shoulder', 'unit-template'],
      ['maya', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const afterP1Pass = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterUnit = applyAction(afterP1Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: afterP1Pass.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    const backToP2 = applyAction(afterUnit, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const derekOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'derek')!
    const allyOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'unit-template')!

    const burstResult = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: afterUnit.players[p2Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.BROTHERS_SHOULDER,
      )!.instanceId,
      targets: [derekOnBoard.instanceId, allyOnBoard.instanceId],
    })

    expect(burstResult.state.spellStack).toHaveLength(0)

    const damagedDerek = burstResult.state.players[p2Id]!.board.find((u) => u.id === 'derek')!
    const buffedAlly = burstResult.state.players[p2Id]!.board.find((u) => u.id === 'unit-template')!

    expect(damagedDerek.health).toBe(2)
    expect(buffedAlly.attack).toBe(4)
    expect(buffedAlly.health).toBe(3)
    expect(buffedAlly.tempAttack).toBe(2)

    const round2 = finishRound(burstResult.state)

    const allyAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'unit-template')!
    const derekAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'derek')!

    expect(allyAfterRound.attack).toBe(2)
    expect(allyAfterRound.health).toBe(2)
    expect(derekAfterRound.health).toBe(2)
  })

  test("Brother's Shoulder can kill its own damage target", () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard, brothersShoulder)], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    arrangeZones(
      state,
      p2Id,
      ['derek', 'brothers-shoulder', 'unit-template'],
      ['maya', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10
    const p1Id = getNextPlayerId(state)

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const dyingUnit = createUnit({ id: 'dying-unit', baseHealth: 1, health: 1, maxHealth: 1 })
    afterDerek.players[p2Id]!.board.push({
      ...dyingUnit,
      instanceId: 'p2-extra-1',
      ownerId: p2Id,
    } as unknown as UnitCardInstance)

    const backToP2 = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const allyOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'derek')!

    const burstResult = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: afterDerek.players[p2Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.BROTHERS_SHOULDER,
      )!.instanceId,
      targets: ['p2-extra-1', allyOnBoard.instanceId],
    })

    expect(
      burstResult.state.players[p2Id]!.graveyard.find((u) => u.id === 'dying-unit'),
    ).toBeDefined()
    expect(burstResult.events).toContainEqual({
      type: 'UNIT_DIED',
      unitInstanceId: 'p2-extra-1',
    })

    const buffedDerek = burstResult.state.players[p2Id]!.board.find((u) => u.id === 'derek')!
    expect(buffedDerek.attack).toBe(4)
  })

  test("Brother's Shoulder cannot damage an enemy unit", () => {
    const state = createGame([p1Cards(), p2Cards(derekCard, mayaCard, brothersShoulder)], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    arrangeZones(
      state,
      p2Id,
      ['derek', 'brothers-shoulder', 'unit-template'],
      ['maya', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10

    const afterDerek = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'derek')!.instanceId,
    }).state

    const afterEnemyUnit = applyAction(afterDerek, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterDerek.players[p1Id]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    const derekOnBoard = afterEnemyUnit.players[p2Id]!.board.find((u) => u.id === 'derek')!
    const enemyUnit = afterEnemyUnit.players[p1Id]!.board.find((u) => u.id === 'unit-template')!

    expect(() => {
      applyAction(afterEnemyUnit, {
        type: GAME_ACTION_TYPE.PLAY_SPELL,
        playerId: p2Id,
        cardInstanceId: afterEnemyUnit.players[p2Id]!.hand.find(
          (c) => c.id === SPELL_TYPES.BROTHERS_SHOULDER,
        )!.instanceId,
        targets: [enemyUnit.instanceId, derekOnBoard.instanceId],
      })
    }).toThrow("Brother's Shoulder can only deal damage to your own unit")
  })
})

function p1Cards(): { id: string; cards: UnitCard[] } {
  return { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] }
}

function p2Cards(...cards: CardDefinition[]): { id: string; cards: CardDefinition[] } {
  return {
    id: 'p2',
    cards: [...cards, createUnit(), createUnit(), createUnit()],
  }
}

function finishRound(state: GameState): GameState {
  const pass1 = applyAction(state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: state.turnPlayerId,
  }).state

  return applyAction(pass1, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: pass1.turnPlayerId,
  }).state
}

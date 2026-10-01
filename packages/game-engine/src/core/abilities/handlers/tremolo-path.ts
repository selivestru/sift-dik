import { z } from 'zod'

import { TREMOLO_PATH } from '../../../constants/characters'
import {
  GAME_EVENT_TYPE,
  KEYWORD,
  type GameEvent,
  type GameState,
  type Keyword,
  type UnitCardInstance,
} from '../../../types'
import { ABILITY, type TremoloPathAbilityContext } from '../../../types/abilities.types'

export const tremoloPathPayloadSchema = z.object({
  chosenPath: z.enum(TREMOLO_PATH),
})

export const handleTremoloPath = (
  state: GameState,
  events: GameEvent[],
  context: TremoloPathAbilityContext,
): void => {
  const path = context.chosenPath

  if (path === TREMOLO_PATH.DIK) {
    applyDikPath(context.sourceUnit)
  }

  if (path === TREMOLO_PATH.NEUTRAL) {
    applyNeutralPath(state, events, context.sourceUnit)
  }

  if (path === TREMOLO_PATH.CHICK) {
    applyChickPath(context.sourceUnit)
  }
}

function applyDikPath(unit: UnitCardInstance): void {
  unit.attack += 1
  addKeyword(unit, KEYWORD.QUICK_ATTACK)
}

function applyNeutralPath(state: GameState, events: GameEvent[], unit: UnitCardInstance): void {
  unit.attack = Math.max(0, unit.attack - 1)
  addKeyword(unit, KEYWORD.ELUSIVE)

  const player = state.players[unit.ownerId]!

  if (player.reservedEnergy < 3) {
    player.reservedEnergy = Math.min(3, player.reservedEnergy + 1)

    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: player.id,
      energy: player.reservedEnergy,
      isReserved: true,
    })
  }
}

function applyChickPath(unit: UnitCardInstance): void {
  addKeyword(unit, KEYWORD.TOUGH)

  if (!unit.abilities) {
    unit.abilities = []
  }

  if (!unit.abilities.includes(ABILITY.TREMOLO_SUPPORT)) {
    unit.abilities.push(ABILITY.TREMOLO_SUPPORT)
  }
}

function addKeyword(unit: UnitCardInstance, keyword: Keyword): void {
  if (!unit.keywords) {
    unit.keywords = []
  }

  if (!unit.keywords.includes(keyword)) {
    unit.keywords.push(keyword)
  }
}

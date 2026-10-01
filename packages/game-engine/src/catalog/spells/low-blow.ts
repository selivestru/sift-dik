import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const lowBlow: SpellCard = {
  id: SPELL_TYPES.LOW_BLOW,
  faction: CARD_FACTION.HOT,
  baseCost: 4,
  cost: 4,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.SLOW,
}

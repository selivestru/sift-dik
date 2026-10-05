import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const warmUpTheCrowd: SpellCard = {
  id: SPELL_TYPES.WARM_UP_THE_CROWD,
  faction: CARD_FACTION.DIK,
  baseCost: 1,
  cost: 1,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.FAST,
}

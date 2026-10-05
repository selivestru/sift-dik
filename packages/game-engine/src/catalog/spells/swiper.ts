import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const swiperCard: SpellCard = {
  id: SPELL_TYPES.SWIPER,
  faction: CARD_FACTION.DIK,
  baseCost: 2,
  cost: 2,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.BURST,
}

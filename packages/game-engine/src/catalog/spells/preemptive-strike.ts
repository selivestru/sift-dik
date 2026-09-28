import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const preemptiveStrike: SpellCard = {
  id: SPELL_TYPES.PREEMPTIVE_STRIKE,
  name: 'Удар на опережение',
  description: 'Даруйте союзнику +0|+2 и Быструю атаку до конца раунда.',
  faction: CARD_FACTION.DIK,
  baseCost: 3,
  cost: 3,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.FAST,
}

import { CARD_FACTION, CARD_TYPE, UNIT_KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const tremoloCard: UnitCard = {
  id: 'tremolo',
  name: 'Тремоло',
  description:
    'Быстрая атака. Поддержка: даруйте поддерживаемому союзнику +1|+1 в этом раунде. Удар по Репутации: восполните 1 ед. Запасной энергии.',
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 3,
  cost: 3,
  baseAttack: 3,
  attack: 3,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  keywords: [UNIT_KEYWORD.QUICK_ATTACK],
  abilities: [ABILITY.TREMOLO_SUPPORT, ABILITY.TREMOLO_REPUTATION_STRIKE],
}

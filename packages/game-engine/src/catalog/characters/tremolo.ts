import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const tremoloCard: UnitCard = {
  id: CHARACTERS.TREMOLO,
  name: 'Тремоло',
  description:
    'Призыв: выберите путь — DIK: даруйте мне +1|+0 и Быструю атаку. Neutral: уменьшите мою атаку на 1, даруйте мне Изворотливость и восполните 1 ед. Запасной энергии. CHICK: даруйте мне Стойкость и Поддержку (Поддержка: даруйте поддерживаемому союзнику +1|+1 в этом раунде).',
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 3,
  cost: 3,
  baseAttack: 3,
  attack: 3,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  keywords: [],
  abilities: [ABILITY.TREMOLO_PATH],
}

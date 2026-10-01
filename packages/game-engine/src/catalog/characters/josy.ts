import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const josyCard: UnitCard = {
  id: CHARACTERS.JOSY,
  faction: CARD_FACTION.HOT,
  type: CARD_TYPE.UNIT,
  baseCost: 2,
  cost: 2,
  baseAttack: 1,
  attack: 1,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  keywords: [KEYWORD.ELUSIVE],
  abilities: [ABILITY.JOSY_DRAW],
}

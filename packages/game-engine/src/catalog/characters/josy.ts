import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'
import { SPELL_TYPES } from '../../types/spells.types'

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
  relatedCards: [SPELL_TYPES.LOW_BLOW],
  abilities: [ABILITY.JOSY_DRAW],
}

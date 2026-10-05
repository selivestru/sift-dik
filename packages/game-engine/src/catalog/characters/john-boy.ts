import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'
import { SPELL_TYPES } from '../../types/spells.types'

export const johnBoyCard: UnitCard = {
  id: CHARACTERS.JOHN_BOY,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 3,
  cost: 3,
  baseAttack: 2,
  attack: 2,
  baseHealth: 4,
  health: 4,
  maxHealth: 4,
  relatedCards: [SPELL_TYPES.SIGNATURE_DISH],
  abilities: [ABILITY.JOHN_BOY_SUPPORT],
}

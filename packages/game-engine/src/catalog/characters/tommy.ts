import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'
import { SPELL_TYPES } from '../../types/spells.types'

export const tommyCard: UnitCard = {
  id: CHARACTERS.TOMMY,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 4,
  cost: 4,
  baseAttack: 4,
  attack: 4,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  keywords: [KEYWORD.FURY],
  relatedCards: [SPELL_TYPES.WARM_UP_THE_CROWD, CHARACTERS.GUESTS],
  abilities: [ABILITY.TOMMY_INVITE],
}

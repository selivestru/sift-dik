import type { UnitCardInstance } from '../../types'

export const compareUnitStrength = (left: UnitCardInstance, right: UnitCardInstance): number =>
  left.attack - right.attack || left.health - right.health || left.cost - right.cost

export const spellSpeeds = [
  { id: 'slow', label: 'Slow', name: 'Медленное', icon: 'slow.png' },
  { id: 'fast', label: 'Fast', name: 'Быстрое', icon: 'fast.svg' },
  { id: 'burst', label: 'Burst', name: 'Взрывное', icon: 'burst.svg' },
] as const

export type SpellSpeed = (typeof spellSpeeds)[number]['id']
export type SpellSpeedImages = Readonly<Record<SpellSpeed, HTMLImageElement>>

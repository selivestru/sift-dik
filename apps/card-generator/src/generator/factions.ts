export const factions = [
  {
    id: 'dik',
    name: 'ДИКи',
    icon: 'dik.svg',
    color: '#58a7c9',
    description: 'Delta Iota Kappa · ΔΙΚ',
  },
  { id: 'aaa', name: 'Качки', icon: 'aaa.svg', color: '#da775d', description: 'Tri-Alphas · ΑΑΑ' },
  {
    id: 'ano',
    name: 'Снобы',
    icon: 'ano.svg',
    color: '#b799e3',
    description: 'Alpha Nu Omega · ΑΝΩ',
  },
  {
    id: 'hot',
    name: 'СЕКСи',
    icon: 'hot.svg',
    color: '#df86a9',
    description: 'Eta Omicron Tau · ΗΟΤ',
  },
  {
    id: 'other',
    name: 'Другие',
    icon: 'other.svg',
    color: '#9bac99',
    description: 'Персонажи вне выбранных братств и сестринства',
  },
] as const

export type FactionId = (typeof factions)[number]['id']
export type FactionImages = Readonly<Record<FactionId, HTMLImageElement>>

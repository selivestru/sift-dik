export const CHARACTERS = {
  TREMOLO: 'tremolo',
  DEREK: 'derek',
  MAYA: 'maya',
  JOSY: 'josy',
  RUSTY: 'rusty',
  JAMIE: 'jamie',
  JACOB: 'jacob',
  TOMMY: 'tommy',
  GUESTS: 'guests',
  LEON: 'leon',
} as const

export type Character = (typeof CHARACTERS)[keyof typeof CHARACTERS]

export const TREMOLO_PATH = {
  DIK: 'dik',
  NEUTRAL: 'neutral',
  CHICK: 'chick',
} as const

export type TremoloPath = (typeof TREMOLO_PATH)[keyof typeof TREMOLO_PATH]

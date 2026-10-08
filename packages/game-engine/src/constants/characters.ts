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
  JOHN_BOY: 'john-boy',
  ELENA: 'elena',
} as const

export type Character = (typeof CHARACTERS)[keyof typeof CHARACTERS]

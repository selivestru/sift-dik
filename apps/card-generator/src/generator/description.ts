import { keywords } from './keywords'
import type { KeywordId } from './keywords'

export type DescriptionPart =
  | { type: 'text'; text: string; highlighted?: boolean }
  | { type: 'keyword'; id: KeywordId }

export function normalizeDescription(parts: readonly DescriptionPart[]): DescriptionPart[] {
  const result: DescriptionPart[] = []
  for (const part of parts) {
    if (part.type === 'keyword') {
      result.push(part)
      continue
    }
    if (!part.text) continue
    const previous = result.at(-1)
    const highlighted = Boolean(part.highlighted)
    if (previous?.type === 'text' && Boolean(previous.highlighted) === highlighted) {
      previous.text += part.text
    } else result.push({ type: 'text', text: part.text, highlighted })
  }
  return result
}

export function descriptionPlainText(parts: readonly DescriptionPart[]): string {
  return parts
    .map((part) =>
      part.type === 'text'
        ? part.text
        : (keywords.find((keyword) => keyword.id === part.id)?.name ?? ''),
    )
    .join('')
}

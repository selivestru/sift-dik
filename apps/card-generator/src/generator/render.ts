import type { DescriptionPart } from './description'
import type { KeywordId, KeywordImages } from './keywords'
import { keywords } from './keywords'
import type { SpellSpeed, SpellSpeedImages } from './spell-speeds'
import { spellSpeeds } from './spell-speeds'
import type { CardType, Point, Rect } from './templates'
import { CARD_FONT, CARD_HEIGHT, CARD_TITLE_FONT, CARD_WIDTH, templates } from './templates'

export interface CardData {
  type: CardType
  energy: number
  attack: number
  health: number
  description: string
  descriptionParts?: readonly DescriptionPart[]
  name?: string
  keywords?: readonly KeywordId[]
  spellSpeed?: SpellSpeed
}
export interface CardImages {
  frame: HTMLImageElement
  art?: HTMLImageElement
  faction?: HTMLImageElement
  keywords?: KeywordImages
  spellSpeeds?: SpellSpeedImages
}
export interface RenderResult {
  descriptionFits: boolean
}

function pixels(rect: Rect): Rect {
  return {
    x: rect.x * CARD_WIDTH,
    y: rect.y * CARD_HEIGHT,
    width: rect.width * CARD_WIDTH,
    height: rect.height * CARD_HEIGHT,
  }
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  area: Rect,
  mode: 'cover' | 'contain',
) {
  const scale = (mode === 'cover' ? Math.max : Math.min)(
    area.width / image.naturalWidth,
    area.height / image.naturalHeight,
  )
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  ctx.drawImage(
    image,
    area.x + (area.width - width) / 2,
    area.y + (area.height - height) / 2,
    width,
    height,
  )
}

const DESCRIPTION_SIZE = 44
const INLINE_ICON_SIZE = 36

interface DescriptionToken {
  text: string
  highlighted: boolean
  keyword?: (typeof keywords)[number]
  width: number
}
interface DescriptionLine {
  tokens: DescriptionToken[]
  width: number
}
interface DescriptionLayout {
  lines: DescriptionLine[]
  size: number
  height: number
  fits: boolean
}

function descriptionFont(highlighted: boolean) {
  return `${highlighted ? '700 ' : ''}${DESCRIPTION_SIZE}px ${CARD_FONT}`
}

function measureDescription(
  ctx: CanvasRenderingContext2D,
  parts: readonly DescriptionPart[],
  width: number,
  availableHeight: number,
): DescriptionLayout {
  const lines: DescriptionLine[] = []
  let current: DescriptionLine = { tokens: [], width: 0 }
  function finish() {
    lines.push(current)
    current = { tokens: [], width: 0 }
  }
  function add(token: DescriptionToken) {
    if (current.width && current.width + token.width > width) finish()
    if (!current.width && /^ +$/.test(token.text)) return
    current.tokens.push(token)
    current.width += token.width
  }
  for (const part of parts) {
    if (part.type === 'keyword') {
      const keyword = keywords.find((item) => item.id === part.id)
      if (!keyword) continue
      ctx.font = descriptionFont(true)
      const iconWidth = keyword.icons.length * (INLINE_ICON_SIZE + 6)
      add({
        text: keyword.name,
        highlighted: true,
        keyword,
        width: ctx.measureText(keyword.name).width + iconWidth,
      })
      continue
    }
    const highlighted = Boolean(part.highlighted)
    ctx.font = descriptionFont(highlighted)
    for (const chunk of part.text
      .replace(/\r\n?/g, '\n')
      .split(/(\n|[^\S\n]+|[^\s]+)/)
      .filter(Boolean)) {
      if (chunk === '\n') {
        finish()
        continue
      }
      const tokenWidth = ctx.measureText(chunk).width
      if (tokenWidth <= width) {
        add({ text: chunk, highlighted, width: tokenWidth })
        continue
      }
      for (const character of chunk)
        add({ text: character, highlighted, width: ctx.measureText(character).width })
    }
  }
  if (current.tokens.length || lines.length) finish()
  const height = lines.length * DESCRIPTION_SIZE * 1.4
  return { lines, size: DESCRIPTION_SIZE, height, fits: height <= availableHeight }
}

function drawDescription(
  ctx: CanvasRenderingContext2D,
  layout: DescriptionLayout,
  area: Rect,
  images: KeywordImages,
) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  layout.lines.forEach((line, index) => {
    let x = area.x + (area.width - line.width) / 2
    const y = area.y + index * layout.size * 1.4
    for (const token of line.tokens) {
      if (token.keyword) {
        token.keyword.icons.forEach((file) => {
          const image = images[file]
          if (!image) throw new Error(`Не загружена иконка в описании: ${token.keyword?.name}`)
          ctx.shadowBlur = 0
          ctx.shadowOffsetY = 0
          drawImage(
            ctx,
            image,
            {
              x,
              y: y + (layout.size - INLINE_ICON_SIZE) / 2,
              width: INLINE_ICON_SIZE,
              height: INLINE_ICON_SIZE,
            },
            'contain',
          )
          x += INLINE_ICON_SIZE + 6
        })
      }
      ctx.font = descriptionFont(token.highlighted)
      ctx.fillStyle = token.highlighted ? '#f3d05b' : '#ffffff'
      ctx.shadowColor = '#000'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2
      ctx.fillText(token.text, x, y)
      x += token.width - (token.keyword ? token.keyword.icons.length * (INLINE_ICON_SIZE + 6) : 0)
    }
  })
}

function drawKeywordPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save()
  const bevel = 6
  ctx.beginPath()
  ctx.moveTo(x + bevel, y)
  ctx.lineTo(x + width - bevel, y)
  ctx.lineTo(x + width, y + bevel)
  ctx.lineTo(x + width, y + height - bevel)
  ctx.lineTo(x + width - bevel, y + height)
  ctx.lineTo(x + bevel, y + height)
  ctx.lineTo(x, y + height - bevel)
  ctx.lineTo(x, y + bevel)
  ctx.closePath()
  const background = ctx.createLinearGradient(x, y, x, y + height)
  background.addColorStop(0, 'rgba(27, 35, 47, .94)')
  background.addColorStop(1, 'rgba(10, 17, 29, .94)')
  ctx.fillStyle = background
  ctx.shadowColor = '#0009'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 3
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  const border = ctx.createLinearGradient(x, y, x, y + height)
  border.addColorStop(0, '#dac58b')
  border.addColorStop(0.18, '#796b49')
  border.addColorStop(0.8, '#796b49')
  border.addColorStop(1, '#baa06a')
  ctx.strokeStyle = border
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + bevel + 3, y + 4)
  ctx.lineTo(x + width - bevel - 3, y + 4)
  ctx.strokeStyle = 'rgba(236, 219, 171, .22)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

const KEYWORD_ICON_SIZE = 64 * 1.1 * 1.1
const KEYWORD_PADDING = 16
const KEYWORD_LABEL_GAP = 16
const KEYWORD_LABEL_SIZE = 64
const KEYWORD_BADGE_WIDTH = KEYWORD_ICON_SIZE + KEYWORD_PADDING * 2
const KEYWORD_BADGE_HEIGHT = KEYWORD_ICON_SIZE + KEYWORD_PADDING * 2
const KEYWORD_GAP = 24
const CONTENT_GAP = 18
const CONTENT_PADDING = 10

interface KeywordBadge {
  name: string
  icons: readonly string[]
}

function drawKeywordIcons(
  ctx: CanvasRenderingContext2D,
  keyword: KeywordBadge,
  images: KeywordImages,
  x: number,
  y: number,
  size: number,
) {
  const gap = 4
  const width = (size - gap * (keyword.icons.length - 1)) / keyword.icons.length
  keyword.icons.forEach((file, index) => {
    const image = images[file]
    if (!image) throw new Error(`Не загружена иконка навыка: ${keyword.name}`)
    drawImage(ctx, image, { x: x + index * (width + gap), y, width, height: size }, 'contain')
  })
}

function keywordRows(count: number, width: number) {
  const columns = Math.max(
    1,
    Math.floor((width + KEYWORD_GAP) / (KEYWORD_BADGE_WIDTH + KEYWORD_GAP)),
  )
  return { columns, rows: Math.ceil(count / columns) }
}

function keywordHeight(count: number, width: number): number {
  if (!count) return 0
  if (count === 1) return KEYWORD_BADGE_HEIGHT
  const { rows } = keywordRows(count, width)
  return rows * KEYWORD_BADGE_HEIGHT + (rows - 1) * KEYWORD_GAP
}

function drawKeywords(
  ctx: CanvasRenderingContext2D,
  selected: readonly KeywordBadge[],
  images: KeywordImages,
  area: Rect,
) {
  if (!selected.length) return
  const single = selected.length === 1 ? selected[0] : undefined
  if (single) {
    ctx.font = `700 ${KEYWORD_LABEL_SIZE}px ${CARD_TITLE_FONT}`
    const label = single.name.toLocaleUpperCase('ru')
    const height = keywordHeight(1, area.width)
    const width = Math.min(
      area.width,
      ctx.measureText(label).width + KEYWORD_ICON_SIZE + KEYWORD_PADDING * 2 + KEYWORD_LABEL_GAP,
    )
    const x = area.x + (area.width - width) / 2
    drawKeywordPlate(ctx, x, area.y, width, height)
    drawKeywordIcons(
      ctx,
      single,
      images,
      x + KEYWORD_PADDING,
      area.y + KEYWORD_PADDING,
      KEYWORD_ICON_SIZE,
    )
    ctx.fillStyle = '#ffe049'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const metrics = ctx.measureText(label)
    const baseline =
      area.y + height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
    ctx.fillText(
      label,
      x + KEYWORD_PADDING + KEYWORD_ICON_SIZE + KEYWORD_LABEL_GAP,
      baseline,
      width - KEYWORD_ICON_SIZE - KEYWORD_PADDING * 2 - KEYWORD_LABEL_GAP,
    )
    return
  }
  const { columns } = keywordRows(selected.length, area.width)
  selected.forEach((keyword, index) => {
    const row = Math.floor(index / columns)
    const count = Math.min(columns, selected.length - row * columns)
    const rowWidth = count * KEYWORD_BADGE_WIDTH + (count - 1) * KEYWORD_GAP
    const x =
      area.x + (area.width - rowWidth) / 2 + (index % columns) * (KEYWORD_BADGE_WIDTH + KEYWORD_GAP)
    const y = area.y + row * (KEYWORD_BADGE_HEIGHT + KEYWORD_GAP)
    drawKeywordPlate(ctx, x, y, KEYWORD_BADGE_WIDTH, KEYWORD_BADGE_HEIGHT)
    drawKeywordIcons(
      ctx,
      keyword,
      images,
      x + KEYWORD_PADDING,
      y + KEYWORD_PADDING,
      KEYWORD_ICON_SIZE,
    )
  })
}

function measureTitle(ctx: CanvasRenderingContext2D, title: string, width: number): number {
  if (!title) return 0
  let size = 66
  while (size > 26) {
    ctx.font = `700 ${size}px ${CARD_TITLE_FONT}`
    if (ctx.measureText(title).width <= width) break
    size -= 2
  }
  return size
}

function cardBadges(
  data: CardData,
  images: CardImages,
): { selected: readonly KeywordBadge[]; icons: KeywordImages } {
  if (data.type === 'unit') {
    return {
      selected: keywords.filter((keyword) => data.keywords?.includes(keyword.id)),
      icons: images.keywords ?? {},
    }
  }
  const speed =
    spellSpeeds.find((item) => item.id === (data.spellSpeed ?? 'slow')) ?? spellSpeeds[0]
  const icon = images.spellSpeeds?.[speed.id]
  if (!icon) throw new Error(`Не загружена иконка типа заклинания: ${speed.label}`)
  return { selected: [{ name: speed.name, icons: [speed.icon] }], icons: { [speed.icon]: icon } }
}

interface CardTextLayout {
  title: string
  titleSize: number
  titleHeight: number
  selected: readonly KeywordBadge[]
  icons: KeywordImages
  badgesHeight: number
  hasDescription: boolean
  description: DescriptionLayout
  height: number
  y: number
  fits: boolean
  descriptionIcons: KeywordImages
}

function layoutCardText(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  images: CardImages,
  area: Rect,
  preferredTop?: number,
): CardTextLayout {
  const title = data.name?.trim().toLocaleUpperCase('ru') ?? ''
  const titleSize = measureTitle(ctx, title, area.width)
  const titleHeight = title ? titleSize * 1.25 : 0
  const { selected, icons } = cardBadges(data, images)
  const badgesHeight = keywordHeight(selected.length, area.width)
  const parts = data.descriptionParts ?? [{ type: 'text' as const, text: data.description }]
  const hasDescription = parts.some((part) => part.type === 'keyword' || Boolean(part.text.trim()))
  const blockCount = Number(Boolean(title)) + Number(selected.length > 0) + Number(hasDescription)
  const gapHeight = Math.max(0, blockCount - 1) * CONTENT_GAP
  const fixedHeight = titleHeight + badgesHeight + gapHeight
  const description = measureDescription(
    ctx,
    hasDescription ? parts : [],
    area.width,
    area.height - fixedHeight - CONTENT_PADDING * 2,
  )
  const totalHeight = fixedHeight + description.height
  const fits = description.fits && totalHeight <= area.height - CONTENT_PADDING * 2
  const y =
    data.type === 'spell'
      ? Math.max(
          area.y + CONTENT_PADDING,
          Math.min(
            preferredTop ?? area.y + CONTENT_PADDING,
            area.y + area.height - CONTENT_PADDING - totalHeight,
          ),
        )
      : Math.max(area.y + CONTENT_PADDING, area.y + area.height - CONTENT_PADDING - totalHeight)

  return {
    title,
    titleSize,
    titleHeight,
    selected,
    icons,
    badgesHeight,
    hasDescription,
    description,
    descriptionIcons: images.keywords ?? {},
    height: totalHeight,
    y,
    fits,
  }
}

function drawCardText(ctx: CanvasRenderingContext2D, layout: CardTextLayout, area: Rect) {
  const {
    title,
    titleSize,
    titleHeight,
    selected,
    icons,
    badgesHeight,
    hasDescription,
    description,
  } = layout
  let y = layout.y

  if (title) {
    ctx.font = `700 ${titleSize}px ${CARD_TITLE_FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    ctx.fillText(title, area.x + area.width / 2, y, area.width)
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    y += titleHeight + (selected.length || hasDescription ? CONTENT_GAP : 0)
  }
  if (selected.length) {
    drawKeywords(ctx, selected, icons, { ...area, y })
    y += badgesHeight + (hasDescription ? CONTENT_GAP : 0)
  }
  drawDescription(ctx, description, { ...area, y }, layout.descriptionIcons)
}

function drawContentBackdrop(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  layout: CardTextLayout,
) {
  if (!layout.height) return
  const backdrop = source.ownerDocument.createElement('canvas')
  backdrop.width = CARD_WIDTH
  backdrop.height = CARD_HEIGHT
  const effect = backdrop.getContext('2d')
  if (!effect) throw new Error('Браузер не поддерживает Canvas 2D')
  const top = Math.max(0, layout.y - 100)
  const bottom = Math.min(CARD_HEIGHT, layout.y + layout.height + CONTENT_PADDING)
  effect.filter = 'blur(8px)'
  effect.drawImage(source, 0, 0)
  effect.filter = 'none'
  effect.globalCompositeOperation = 'source-atop'
  const darkness = effect.createLinearGradient(0, top, 0, bottom)
  darkness.addColorStop(0, 'rgba(6, 12, 22, 0)')
  darkness.addColorStop(0.4, 'rgba(6, 12, 22, .22)')
  darkness.addColorStop(1, 'rgba(6, 12, 22, .5)')
  effect.fillStyle = darkness
  effect.fillRect(0, top, CARD_WIDTH, CARD_HEIGHT - top)
  effect.globalCompositeOperation = 'destination-in'
  const fade = effect.createLinearGradient(0, top, 0, Math.min(bottom, layout.y + 70))
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)')
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)')
  effect.fillStyle = fade
  effect.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.drawImage(backdrop, 0, 0)
}

function drawStat(ctx: CanvasRenderingContext2D, value: number, point: Point) {
  ctx.save()
  const text = String(value)
  let size = 104
  do {
    ctx.font = `700 ${size}px ${CARD_FONT}`
    size -= 2
  } while (size > 8 && ctx.measureText(text).width > 150)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#241c14'
  ctx.fillStyle = '#fff9e9'
  ctx.strokeText(text, point[0] * CARD_WIDTH, point[1] * CARD_HEIGHT)
  ctx.fillText(text, point[0] * CARD_WIDTH, point[1] * CARD_HEIGHT)
  ctx.restore()
}

export function renderCard(
  canvas: HTMLCanvasElement,
  data: CardData,
  images: CardImages,
): RenderResult {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Браузер не поддерживает Canvas 2D')
  const template = templates[data.type]
  const area = pixels(template.art)
  const textArea = pixels(template.text)
  const layout = layoutCardText(
    ctx,
    data,
    images,
    textArea,
    template.textStart === undefined ? undefined : template.textStart * CARD_HEIGHT,
  )
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.save()
  ctx.beginPath()
  if (template.polygon) {
    template.polygon.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x * CARD_WIDTH, y * CARD_HEIGHT)
      else ctx.lineTo(x * CARD_WIDTH, y * CARD_HEIGHT)
    })
    ctx.closePath()
  } else {
    ctx.ellipse(
      area.x + area.width / 2,
      area.y + area.height / 2,
      area.width / 2,
      area.height / 2,
      0,
      0,
      Math.PI * 2,
    )
  }
  ctx.clip()
  ctx.fillStyle = '#1a2430'
  ctx.fillRect(area.x, area.y, area.width, area.height)
  if (images.art) drawImage(ctx, images.art, area, 'cover')
  if (data.type === 'unit') drawContentBackdrop(ctx, canvas, layout)
  ctx.restore()
  ctx.drawImage(images.frame, 0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.save()
  ctx.beginPath()
  ctx.rect(textArea.x, textArea.y, textArea.width, textArea.height)
  ctx.clip()
  if (data.type === 'spell') drawContentBackdrop(ctx, canvas, layout)
  drawCardText(ctx, layout, textArea)
  ctx.restore()
  drawStat(ctx, data.energy, template.energy)
  if (template.attack) drawStat(ctx, data.attack, template.attack)
  if (template.health) drawStat(ctx, data.health, template.health)
  if (images.faction) {
    const faction = pixels(template.faction)
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(
      faction.x + faction.width / 2,
      faction.y + faction.height / 2,
      faction.width / 2,
      faction.height / 2,
      0,
      0,
      Math.PI * 2,
    )
    ctx.clip()
    ctx.drawImage(images.faction, faction.x, faction.y, faction.width, faction.height)
    ctx.restore()
  }
  return { descriptionFits: layout.fits }
}

export function exportPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось создать PNG'))),
      'image/png',
    )
  })
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось прочитать изображение'))
    image.src = url
  })
}

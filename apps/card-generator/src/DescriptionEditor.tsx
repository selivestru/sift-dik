/* oxlint-disable jsx-a11y/prefer-tag-over-role -- A rich text editor requires a contentEditable textbox. */
import { useLayoutEffect, useRef, useState } from 'react'

import { normalizeDescription } from './generator/description'
import type { DescriptionPart } from './generator/description'
import { keywords } from './generator/keywords'
import type { KeywordId } from './generator/keywords'

function keywordChip(id: KeywordId): HTMLElement {
  const keyword = keywords.find((item) => item.id === id)!
  const chip = document.createElement('span')
  chip.className = 'description-keyword'
  chip.dataset.keyword = id
  chip.contentEditable = 'false'
  for (const icon of keyword.icons) {
    const image = document.createElement('img')
    image.src = `${import.meta.env.BASE_URL}assets/keywords/${icon}`
    image.alt = ''
    chip.append(image)
  }
  chip.append(document.createTextNode(keyword.name))
  return chip
}

function readDescription(root: Node): DescriptionPart[] {
  const parts: DescriptionPart[] = []
  function visit(node: Node, highlighted: boolean) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push({ type: 'text', text: node.textContent ?? '', highlighted })
      return
    }
    if (!(node instanceof HTMLElement)) return
    const keyword = keywords.find((item) => item.id === node.dataset.keyword)
    if (keyword) {
      parts.push({ type: 'keyword', id: keyword.id })
      return
    }
    if (node.tagName === 'BR') {
      parts.push({ type: 'text', text: '\n' })
      return
    }
    const active =
      node.dataset.highlight === undefined ? highlighted : node.dataset.highlight === 'true'
    if ((node.tagName === 'DIV' || node.tagName === 'P') && node !== root && node.previousSibling)
      parts.push({ type: 'text', text: '\n' })
    node.childNodes.forEach((child) => visit(child, active))
  }
  root.childNodes.forEach((child) => visit(child, false))
  return normalizeDescription(parts)
}

export default function DescriptionEditor({
  value,
  onChange,
}: {
  value: readonly DescriptionPart[]
  onChange: (value: DescriptionPart[]) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [notice, setNotice] = useState('')

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (
      !editor ||
      JSON.stringify(readDescription(editor)) === JSON.stringify(normalizeDescription(value))
    )
      return
    const fragment = document.createDocumentFragment()
    value.forEach((part) => {
      if (part.type === 'keyword') fragment.append(keywordChip(part.id))
      else {
        const span = document.createElement('span')
        span.dataset.highlight = String(Boolean(part.highlighted))
        span.textContent = part.text
        fragment.append(span)
      }
    })
    editor.replaceChildren(fragment)
    savedRange.current = null
  }, [value])

  function rememberSelection() {
    const selection = window.getSelection()
    if (
      selection?.rangeCount &&
      editorRef.current?.contains(selection.anchorNode) &&
      editorRef.current.contains(selection.focusNode)
    )
      savedRange.current = selection.getRangeAt(0).cloneRange()
  }

  function selectionRange(): Range {
    const editor = editorRef.current!
    const range = savedRange.current
    if (range && editor.contains(range.startContainer) && editor.contains(range.endContainer))
      return range
    const end = document.createRange()
    end.selectNodeContents(editor)
    end.collapse(false)
    return end
  }

  function publish() {
    if (editorRef.current) onChange(readDescription(editorRef.current))
    rememberSelection()
    setNotice('')
  }

  function placeCaret(node: Node, offset: number) {
    editorRef.current?.focus()
    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRange.current = range.cloneRange()
  }

  function insertText(text: string) {
    const range = selectionRange()
    range.deleteContents()
    const node = document.createTextNode(text)
    range.insertNode(node)
    placeCaret(node, text.length)
    publish()
  }

  function highlight(active: boolean) {
    const range = selectionRange()
    if (range.collapsed) {
      setNotice('Сначала выделите текст в описании.')
      return
    }
    const span = document.createElement('span')
    span.dataset.highlight = String(active)
    const fragment = range.extractContents()
    fragment
      .querySelectorAll('[data-highlight]')
      .forEach((node) => node.removeAttribute('data-highlight'))
    span.append(fragment)
    range.insertNode(span)
    editorRef.current?.focus()
    range.selectNodeContents(span)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    savedRange.current = range.cloneRange()
    publish()
  }

  function insertKeyword(id: KeywordId) {
    const range = selectionRange()
    range.deleteContents()
    const chip = keywordChip(id)
    range.insertNode(chip)
    const space = document.createTextNode(' ')
    chip.after(space)
    placeCaret(space, 1)
    publish()
  }

  return (
    <section className="description-editor">
      <div id="description-label" className="description-label">
        Описание
      </div>
      <div className="description-toolbar" role="toolbar" aria-label="Оформление описания">
        <button
          type="button"
          className="gold-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => highlight(true)}
        >
          Золотой текст
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => highlight(false)}
        >
          Обычный текст
        </button>
        <select
          aria-label="Вставить навык в описание"
          value=""
          onMouseDown={rememberSelection}
          onChange={(event) => {
            const id = event.target.value
            if (keywords.some((item) => item.id === id)) insertKeyword(id as KeywordId)
          }}
        >
          <option value="" disabled>
            + Навык
          </option>
          {keywords.map((keyword) => (
            <option key={keyword.id} value={keyword.id}>
              {keyword.name}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={editorRef}
        className="description-input"
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        role="textbox"
        aria-multiline="true"
        aria-labelledby="description-label"
        data-placeholder="Введите описание или условия карточки…"
        onInput={publish}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onBlur={rememberSelection}
        onPaste={(event) => {
          event.preventDefault()
          rememberSelection()
          insertText(event.clipboardData.getData('text/plain'))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            rememberSelection()
            insertText('\n')
          }
        }}
      />
      <p className="hint">
        Выделите условие и нажмите «Золотой текст». Навык вставляется с иконкой и названием. Размер
        текста фиксирован.
      </p>
      {notice && <output className="hint">{notice}</output>}
    </section>
  )
}

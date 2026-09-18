import { describe, expect, it } from 'vitest'

import { parseTextBlocks } from './parse-text-blocks'

describe('parseTextBlocks', () => {
  it('пустой текст даёт пустой список блоков', () => {
    expect(parseTextBlocks('')).toEqual([])
    expect(parseTextBlocks('\n\n')).toEqual([])
  })

  it('заголовки #, ##, ### получают уровень по числу решёток', () => {
    expect(parseTextBlocks('# Один\n## Два\n### Три')).toEqual([
      { kind: 'heading', level: 1, text: 'Один' },
      { kind: 'heading', level: 2, text: 'Два' },
      { kind: 'heading', level: 3, text: 'Три' },
    ])
  })

  it('решётки без пробела заголовком не считаются', () => {
    expect(parseTextBlocks('#без пробела')).toEqual([
      { kind: 'paragraph', lines: ['#без пробела'] },
    ])
  })

  it('соседние строки склеиваются в один абзац, пустая строка разрывает', () => {
    expect(parseTextBlocks('первая\nвторая\n\nтретья')).toEqual([
      { kind: 'paragraph', lines: ['первая', 'вторая'] },
      { kind: 'paragraph', lines: ['третья'] },
    ])
  })

  it('маркированный список собирается из - и *', () => {
    expect(parseTextBlocks('- один\n* два')).toEqual([
      { kind: 'list', ordered: false, items: ['один', 'два'] },
    ])
  })

  it('нумерованный список принимает «1.» и «2)»', () => {
    expect(parseTextBlocks('1. один\n2) два')).toEqual([
      { kind: 'list', ordered: true, items: ['один', 'два'] },
    ])
  })

  it('смена вида списка начинает новый блок', () => {
    expect(parseTextBlocks('- маркер\n1. номер')).toEqual([
      { kind: 'list', ordered: false, items: ['маркер'] },
      { kind: 'list', ordered: true, items: ['номер'] },
    ])
  })

  it('заголовок закрывает начатые абзац и список', () => {
    expect(parseTextBlocks('текст\n# Заголовок\n- пункт')).toEqual([
      { kind: 'paragraph', lines: ['текст'] },
      { kind: 'heading', level: 1, text: 'Заголовок' },
      { kind: 'list', ordered: false, items: ['пункт'] },
    ])
  })

  it('строка после списка без пустой строки становится абзацем', () => {
    expect(parseTextBlocks('- пункт\nхвост')).toEqual([
      { kind: 'list', ordered: false, items: ['пункт'] },
      { kind: 'paragraph', lines: ['хвост'] },
    ])
  })

  it('понимает CRLF-переводы строк', () => {
    expect(parseTextBlocks('один\r\n\r\nдва')).toEqual([
      { kind: 'paragraph', lines: ['один'] },
      { kind: 'paragraph', lines: ['два'] },
    ])
  })

  it('жирный маркер остаётся в тексте — его разбирает рендер', () => {
    expect(parseTextBlocks('**важно** и дальше')).toEqual([
      { kind: 'paragraph', lines: ['**важно** и дальше'] },
    ])
  })
})

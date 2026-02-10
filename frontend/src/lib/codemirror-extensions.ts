import type { CompletionContext, CompletionSource } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { MySQL, PostgreSQL, sql } from '@codemirror/lang-sql'
import { EditorState } from '@codemirror/state'
import { Decoration, EditorView, hoverTooltip, keymap, MatchDecorator, ViewPlugin } from '@codemirror/view'

// --- SHARED VARIABLE HIGHLIGHTING ---
const variableMatcher = new MatchDecorator({
  regexp: /\{\{.*?\}\}/g,
  decoration: (_match) => {
    return Decoration.mark({
      class: 'cm-custom-variable',
      attributes: { style: 'color: #b45308; font-weight: bold; background: rgba(180, 83, 9, 0.05); border-radius: 2px; padding: 0 2px;' },
    })
  },
})

export const variableHighlight = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) {
    this.decorations = variableMatcher.createDeco(view)
  }

  update(update: ViewUpdate) {
    this.decorations = variableMatcher.updateDeco(update, this.decorations)
  }
}, {
  decorations: instance => instance.decorations,
})

// --- SQL EXTENSIONS ---
export interface Column {
  name: string
  type: string
  comment: string
}

export interface Table {
  name: string
  columns: Column[]
}

export type Schema = Table[]

export function getSqlExtensions(
  dbType: string,
  schema: Schema,
  variables: { name: string, description?: string }[] = [],
  onFormat?: () => void,
): Extension[] {
  const dialect = dbType === 'postgresql' ? PostgreSQL : MySQL

  const variableCompletion: CompletionSource = (context: CompletionContext) => {
    const word = context.matchBefore(/\{\{\w*/)
    if (!word)
      return null
    return {
      from: word.from,
      options: variables.map(v => ({
        label: `{{${v.name}}}`,
        type: 'variable',
        detail: v.description || 'Variable',
      })),
    }
  }

  const contextCompletion: CompletionSource = (context: CompletionContext) => {
    // Check if we just typed a space after a keyword or a variable
    const line = context.state.doc.lineAt(context.pos)
    const textBefore = line.text.slice(0, context.pos - line.from)
    const upper = line.text.toUpperCase()

    // Only suggest logical operators if there's a space before the cursor and we're in a likely condition area
    if (!/\s$/.test(textBefore))
      return null

    const isInCondition = /\b(?:WHERE|ON|HAVING|AND|OR)\b(?![\s\S]+\b(?:SELECT|FROM|GROUP|ORDER|LIMIT)\b)/i.test(upper)

    if (isInCondition) {
      return {
        from: context.pos,
        options: [
          { label: 'AND', type: 'keyword', boost: 10 },
          { label: 'OR', type: 'keyword', boost: 9 },
          { label: 'ORDER BY', type: 'keyword' },
          { label: 'GROUP BY', type: 'keyword' },
          { label: 'LIMIT', type: 'keyword' },
        ],
      }
    }

    return null
  }

  // --- HOVER TOOLTIP ---
  const sqlHover = hoverTooltip((view, pos, side) => {
    const { from, to, text } = view.state.doc.lineAt(pos)
    let start = pos
    let end = pos
    while (start > from && /\w/.test(text[start - from - 1] || '')) start--
    while (end < to && /\w/.test(text[end - from] || '')) end++
    if ((start === pos && side < 0) || (end === pos && side > 0))
      return null

    const word = text.slice(start - from, end - from)

    // Check if word matches a table
    const table = schema.find(t => t.name === word)
    if (table) {
      return {
        pos: start,
        end,
        above: true,
        create(_view) {
          const dom = document.createElement('div')
          dom.textContent = `Table: ${table.name}`
          dom.style.cssText = 'padding: 4px 8px; font-weight: bold; color: #10b981;' // Emerald
          // Add columns summary if needed, but let's keep it simple
          return { dom }
        },
      }
    }

    // Check if word matches a column in any table (simplified)
    // In a real implementation, we'd check context (FROM table)
    for (const t of schema) {
      const col = t.columns.find(c => c.name === word)
      if (col) {
        return {
          pos: start,
          end,
          above: true,
          create(_view) {
            const dom = document.createElement('div')
            dom.innerHTML = `<div style="font-weight:bold; color:#3b82f6">${col.name}</div><div style="font-size:0.9em; opacity:0.8">${col.type} ${col.comment ? ` - ${col.comment}` : ''}</div><div style="font-size:0.8em; opacity:0.6; margin-top:2px">Table: ${t.name}</div>`
            dom.style.cssText = 'padding: 4px 8px;'
            return { dom }
          },
        }
      }
    }

    return null
  })

  return [
    sql({
      dialect,
      schema: schema.reduce((acc, t) => {
        acc[t.name] = t.columns.map(c => c.name)
        return acc
      }, {} as any),
    }),
    variableHighlight,
    sqlHover,
    // Add custom autocomplete sources without overriding dialect ones
    EditorState.languageData.of(() => [{
      autocomplete: (context: CompletionContext) => {
        return variableCompletion(context) || contextCompletion(context)
      },
    }]),
    keymap.of([
      {
        key: 'Shift-Alt-f',
        run: () => {
          if (onFormat) {
            onFormat()
            return true
          }
          return false
        },
      },
    ]),
  ]
}

// --- JSON & JS EXTENSIONS ---
export function getJsonExtensions(): Extension[] {
  return [json()]
}

export function getJsExtensions(): Extension[] {
  return [javascript()]
}

// --- LUCENE HIGHLIGHTING ---
const luceneMatcher = new MatchDecorator({
  regexp: /\b(AND|OR|NOT|TO)\b|[:*?~^]/g,
  decoration: (match) => {
    const text = match[0]
    if (['AND', 'OR', 'NOT', 'TO'].includes(text)) {
      return Decoration.mark({ class: 'cm-lucene-keyword', attributes: { style: 'color: #7c3aed; font-weight: bold;' } })
    }
    return Decoration.mark({ class: 'cm-lucene-operator', attributes: { style: 'color: #059669;' } })
  },
})

export const luceneHighlight = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) {
    this.decorations = luceneMatcher.createDeco(view)
  }

  update(update: ViewUpdate) {
    this.decorations = luceneMatcher.updateDeco(update, this.decorations)
  }
}, {
  decorations: instance => instance.decorations,
})

export function getLuceneExtensions(fields: { name: string, type: string }[] = [], variables: { name: string, description?: string }[] = []): Extension[] {
  const fieldCompletion: CompletionSource = (context: CompletionContext) => {
    const word = context.matchBefore(/\w*/)
    if (!word || (word.from === word.to && !context.explicit))
      return null
    return {
      from: word.from,
      options: [
        ...fields.map(f => ({ label: f.name, type: 'property', detail: f.type })),
        ...variables.map(v => ({ label: `{{${v.name}}}`, type: 'variable', detail: v.description })),
      ],
    }
  }

  return [
    luceneHighlight,
    variableHighlight,
    EditorView.lineWrapping,
    EditorState.languageData.of(() => [{
      autocomplete: fieldCompletion,
    }]),
  ]
}

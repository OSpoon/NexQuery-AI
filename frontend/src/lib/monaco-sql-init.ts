import { setupLanguageFeatures, LanguageIdEnum } from 'monaco-sql-languages'
import * as monaco from 'monaco-editor'

// Import Language Contributions
import 'monaco-sql-languages/esm/languages/mysql/mysql.contribution'
import 'monaco-sql-languages/esm/languages/pgsql/pgsql.contribution'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
// Use standard workers since we downgraded to monaco-editor 0.37.1
import mysqlWorker from 'monaco-sql-languages/esm/languages/mysql/mysql.worker?worker'
import pgsqlWorker from 'monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker'

// Configure Monaco Workers
self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'mysql') return new mysqlWorker()
    if (label === 'pgsql') return new pgsqlWorker()
    return new editorWorker()
  },
}

// Define Schema types matching SqlEditor
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

// Registry to map Model URI to specific Schema
const schemaRegistry = new Map<string, Schema>()

export const registerSchema = (uri: string, schema: Schema) => {
  schemaRegistry.set(uri, schema)
}

export const unregisterSchema = (uri: string) => {
  schemaRegistry.delete(uri)
}

// Variable syntax preprocessor
const preprocessCode = (code: string) => {
  return code.replace(/\{\{\s*(\w+)\s*\}\}/g, 'var_$1')
}

let isSetup = false

// --- Intelligent SQL Context Analyzer ---
const getContextState = (textBefore: string) => {
  const upper = textBefore.toUpperCase()

  // Tokenize: Split by non-word chars but keep significant symbols like *
  // Simple tokenizer: split by space, comma, parens
  const tokens = upper.split(/[\s,()]+/).filter(Boolean)
  let lastToken = tokens[tokens.length - 1]

  // Handle "SELECT *" case -> lastToken should be treated as part of SELECT scope, implying FROM is next
  if (lastToken === '*') {
    // Look back one more
    const prev = tokens[tokens.length - 2]
    if (prev === 'SELECT')
      lastToken = 'SELECT_ALL' // Virtual token
    else lastToken = 'SELECT_COL' // Virtual token for "col, *"
  }

  // Map: Token -> Expected Next Suggestion Types
  // Types: 'KEYWORD', 'TABLE', 'COLUMN'

  // Default: Unknown
  const state = {
    expectTables: false,
    expectColumns: false,
    keywords: new Map<string, string>(), // Keyword -> SortText
  }

  if (!lastToken) return state

  // --- State Rules ---

  // 1. SELECT Context
  if (lastToken === 'SELECT' || lastToken === 'DISTINCT') {
    state.expectColumns = true // SELECT col...
    state.keywords.set('FROM', '0005_FROM') // FROM is possible but usually after cols
    state.keywords.set('DISTINCT', '0001_DISTINCT')
    state.keywords.set('*', '0002_*')
    state.keywords.set('AS', '0005_AS')
  } else if (lastToken === 'SELECT_ALL' || lastToken === 'SELECT_COL') {
    // "SELECT *" or "SELECT col, *"
    state.expectColumns = false // Usually done selecting columns
    state.keywords.set('FROM', '0000_FROM') // Top Priority!
    state.keywords.set('AS', '0005_AS') // Alias
  }

  // 2. FROM / JOIN Context -> Expect TABLES
  else if (
    lastToken === 'FROM' ||
    lastToken === 'JOIN' ||
    lastToken === 'UPDATE' ||
    lastToken === 'INTO'
  ) {
    state.expectTables = true
    state.expectColumns = false
  }
  // "FROM users" -> lastToken is not a keyword, it's a table name?
  // We need to detect if we just finished a table name.
  // Heuristic: If last token is NOT a keyword, assume it's an Identifier (Table/Alias)
  else if (
    ![
      'SELECT',
      'FROM',
      'WHERE',
      'JOIN',
      'ON',
      'GROUP',
      'ORDER',
      'BY',
      'HAVING',
      'LIMIT',
      'SET',
      'VALUES',
      'INSERT',
      'DELETE',
      'UPDATE',
      'AND',
      'OR',
      'ASC',
      'DESC',
    ].includes(lastToken)
  ) {
    // Likely an identifier. Check previous keyword to know where we are.
    // Reverse scan for last Structural Keyword
    const structKeywords = [
      'SELECT',
      'FROM',
      'JOIN',
      'ON',
      'WHERE',
      'GROUP',
      'ORDER',
      'SET',
      'VALUES',
    ]
    let prevKw = ''
    for (let i = tokens.length - 2; i >= 0; i--) {
      if (structKeywords.includes(tokens[i])) {
        prevKw = tokens[i]
        break
      }
    }

    if (prevKw === 'FROM' || prevKw === 'JOIN') {
      // We just finished typing a table in FROM/JOIN
      // Expect: JOIN, WHERE, GROUP BY...
      state.keywords.set('WHERE', '0000_WHERE')
      state.keywords.set('JOIN', '0001_JOIN')
      state.keywords.set('INNER JOIN', '0001_INNER_JOIN')
      state.keywords.set('LEFT JOIN', '0001_LEFT_JOIN')
      state.keywords.set('GROUP BY', '0002_GROUP_BY')
      state.keywords.set('ORDER BY', '0003_ORDER_BY')
      state.keywords.set('LIMIT', '0004_LIMIT')
      // Also ON if it was JOIN
      if (prevKw === 'JOIN') state.keywords.set('ON', '0000_ON')
    }
  }

  // 3. ON / WHERE / HAVING -> Expect COLUMNS + LOGIC
  else if (lastToken === 'ON' || lastToken === 'WHERE' || lastToken === 'HAVING') {
    state.expectColumns = true
    state.keywords.set('AND', '0005_AND') // logic
    state.keywords.set('OR', '0005_OR')
  } else if (lastToken === 'AND' || lastToken === 'OR') {
    state.expectColumns = true
  }

  // 4. SET (Update) -> Expect COLUMNS
  else if (lastToken === 'SET') {
    state.expectColumns = true
  }

  // 5. GROUP BY / ORDER BY
  else if (lastToken === 'BY') {
    // check if GROUP or ORDER
    const prev = tokens[tokens.length - 2]
    if (prev === 'GROUP') {
      state.expectColumns = true // Group by col
    } else if (prev === 'ORDER') {
      state.expectColumns = true // Order by col
    }
  }

  // 6. Multi-word completions (GROUP -> BY, INSERT -> INTO)
  if (upper.endsWith('GROUP')) state.keywords.set('BY', '0000_BY')
  if (upper.endsWith('ORDER')) state.keywords.set('BY', '0000_BY')
  if (upper.endsWith('INSERT')) state.keywords.set('INTO', '0000_INTO')

  return state
}

export const setupMonacoSql = () => {
  if (isSetup) return
  isSetup = true

  // Table Schema Hover Provider
  const hoverProvider: monaco.languages.HoverProvider = {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const schema = schemaRegistry.get(model.uri.toString())
      if (!schema) return null

      const tableName = word.word
      const table = schema.find((t) => t.name.toLowerCase() === tableName.toLowerCase())

      if (table) {
        const markdownLines = [
          `### 📖 Table: ${table.name}`,
          '| Column | Type | Comment |',
          '| :--- | :--- | :--- |',
        ]

        table.columns.forEach((col) => {
          markdownLines.push(`| **${col.name}** | \`${col.type}\` | ${col.comment || '-'} |`)
        })

        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: markdownLines.join('\n') }],
        }
      }
      return null
    },
  }

  const configureLanguage = (langId: LanguageIdEnum) => {
    setupLanguageFeatures(langId, {
      preprocessCode,
      completionItems: {
        enable: true,
        triggerCharacters: [' ', '.', '(', ')'],
        completionService: async (model, position, context, suggestions, entities) => {
          const monacoSuggestions: any[] = []

          const lineContent = model.getLineContent(position.lineNumber)
          const textBefore = lineContent.substring(0, position.column)

          // ANALYZE CONTEXT
          const state = getContextState(textBefore)

          // 1. Keyword Predictions
          if (suggestions && suggestions.keywords) {
            suggestions.keywords.forEach((kw) => {
              let sortText = '5000_' + kw // Default Low

              if (state.keywords.has(kw)) {
                sortText = state.keywords.get(kw)! // Boosted
              }

              monacoSuggestions.push({
                label: kw,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: kw,
                detail: state.keywords.has(kw) ? 'Recommended' : 'Keyword',
                sortText: sortText,
              })
            })

            // Inject missing multi-word keywords
            state.keywords.forEach((sortKey, label) => {
              if (label.includes(' ')) {
                monacoSuggestions.push({
                  label: label,
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  insertText: label,
                  detail: 'Clause',
                  sortText: sortKey,
                })
              }
            })
          }

          // 1.5. Common SQL Functions (New Feature)
          // We inject these if the user is likely typing an expression
          // Heuristic: valid safely everywhere except maybe TABLE position?
          // Let's just add them generally but with lower priority than columns/keywords in some contexts.
          if (!state.expectTables) {
            const sqlFunctions = [
              { label: 'COUNT', detail: 'Function', doc: 'Returns the number of rows.' },
              { label: 'SUM', detail: 'Function', doc: 'Returns the sum of values.' },
              { label: 'AVG', detail: 'Function', doc: 'Returns the average value.' },
              { label: 'MAX', detail: 'Function', doc: 'Returns the maximum value.' },
              { label: 'MIN', detail: 'Function', doc: 'Returns the minimum value.' },
              {
                label: 'IFNULL',
                detail: 'Function',
                doc: 'IFNULL(expr1, expr2)\nReturns expr1 if not NULL, else expr2.',
              },
              {
                label: 'COALESCE',
                detail: 'Function',
                doc: 'COALESCE(value, ...)\nReturns the first non-NULL value.',
              },
              {
                label: 'DATE_FORMAT',
                detail: 'Function',
                doc: 'DATE_FORMAT(date, format)\nFormats the date value.',
              },
              { label: 'NOW', detail: 'Function', doc: 'Returns the current date and time.' },
              {
                label: 'CONCAT',
                detail: 'Function',
                doc: 'CONCAT(str1, str2, ...)\nConcatenates strings.',
              },
              {
                label: 'SUBSTRING',
                detail: 'Function',
                doc: 'SUBSTRING(str, pos, len)\nExtracts a substring.',
              },
              { label: 'TRIM', detail: 'Function', doc: 'Removes leading/trailing spaces.' },
              { label: 'UPPER', detail: 'Function', doc: 'Converts string to uppercase.' },
              { label: 'LOWER', detail: 'Function', doc: 'Converts string to lowercase.' },
            ]

            sqlFunctions.forEach((fn) => {
              monacoSuggestions.push({
                label: fn.label,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: fn.label, // Simple insert, user can type (
                detail: fn.detail,
                documentation: fn.doc,
                sortText: '6000_' + fn.label, // Default priority (after keywords usually)
              })
            })
          }

          // 2. Schema Suggestions
          const schema = schemaRegistry.get(model.uri.toString())
          if (schema) {
            // A. TABLES Suggestion
            if (state.expectTables) {
              schema.forEach((table) => {
                monacoSuggestions.push({
                  label: table.name,
                  kind: monaco.languages.CompletionItemKind.Class,
                  insertText: table.name,
                  detail: 'Table',
                  documentation: `Table: ${table.name}`,
                  sortText: '0000_' + table.name, // Top Priority in FROM/JOIN
                })
              })
            }

            // B. COLUMNS Suggestion
            if (state.expectColumns) {
              const referencedTables = new Set<string>()
              const aliasMap = new Map<string, string>()

              // Try to get referenced tables from Parser or Regex
              if (entities) {
                entities.forEach((entity: any) => {
                  if (entity.entityContextType === 'table') {
                    if (entity.text) referencedTables.add(entity.text.toLowerCase())
                    if (entity._alias?.text) aliasMap.set(entity._alias.text, entity.text)
                  }
                })
              }
              // Regex Fallback (Improved to handle multi-line and schema-qualified names)
              const fullText = model.getValue()
              // Regex matches FROM/JOIN/UPDATE/INTO followed by table name, supporting backticks, double quotes, and schema prefix
              const tableRegex =
                /(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+([`"]?[a-zA-Z0-9_]+[`"]?(?:\.[`"]?[a-zA-Z0-9_]+[`"]?)?)/gi
              const matches = fullText.matchAll(tableRegex)
              for (const match of matches) {
                // Strip quotes/backticks
                const rawTableName = match[1].replace(/[`"]/g, '')
                // Handle schema prefix by taking the last part (e.g. public.users -> users)
                // Actually we should probably keep it, but schemaRegistry usually stores flat names.
                const parts = rawTableName.split('.')
                const tableName = parts[parts.length - 1].toLowerCase()
                referencedTables.add(tableName)
              }

              if (referencedTables.size > 0) {
              }

              const hasReferencedTables = referencedTables.size > 0
              const firstTable = hasReferencedTables ? Array.from(referencedTables)[0] : null
              const dotMatch = textBefore.match(/(\w+)\.$/)

              if (dotMatch) {
                // Explicit alias.col
                const prefix = dotMatch[1]
                const resolvedTable = aliasMap.get(prefix) || prefix
                const table = schema.find(
                  (t) => t.name.toLowerCase() === resolvedTable.toLowerCase(),
                )
                if (table) {
                  table.columns.forEach((col) => {
                    monacoSuggestions.push({
                      label: col.name,
                      kind: monaco.languages.CompletionItemKind.Field,
                      insertText: col.name,
                      detail: col.type,
                      sortText: '0000_' + col.name,
                    })
                  })
                }
              } else if (hasReferencedTables) {
                // Show columns from contextual tables
                schema.forEach((table) => {
                  const isPrimary = firstTable === table.name.toLowerCase()
                  if (referencedTables.has(table.name.toLowerCase())) {
                    table.columns.forEach((col) => {
                      monacoSuggestions.push({
                        label: col.name,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: col.name,
                        detail: `${table.name}.${col.type}`,
                        // If it's the first table found in the query (primary table), prioritize it!
                        sortText: (isPrimary ? '0005_' : '0010_') + col.name,
                      })
                    })
                  }
                })
              }
            }
          }

          return monacoSuggestions
        },
      },
    })

    // Register Hover Provider
    monaco.languages.registerHoverProvider(langId, hoverProvider)
  }

  configureLanguage(LanguageIdEnum.MYSQL)
  configureLanguage(LanguageIdEnum.PG)
}

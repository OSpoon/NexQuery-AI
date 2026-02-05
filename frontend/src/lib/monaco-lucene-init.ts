import * as monaco from 'monaco-editor'

// Field Registry
export interface LuceneField {
  name: string
  type: string
}

const fieldRegistry = new Map<string, LuceneField[]>()

export function registerLuceneFields(uri: string, fields: LuceneField[]) {
  fieldRegistry.set(uri, fields)
}

export function unregisterLuceneFields(uri: string) {
  fieldRegistry.delete(uri)
}

export function setupLucene() {
  if (monaco.languages.getLanguages().some(lang => lang.id === 'lucene'))
    return

  monaco.languages.register({ id: 'lucene' })

  monaco.languages.setMonarchTokensProvider('lucene', {
    defaultToken: '',
    tokenPostfix: '.lucene',

    keywords: ['AND', 'OR', 'NOT', 'TO'],
    operators: ['+', '-', '&&', '||', '!', '(', ')', '{', '}', '[', ']', '^', '~', '*', '?', ':'],

    tokenizer: {
      root: [
        // Keywords & Operators
        [/[A-Z]+/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],

        // Variables {{...}}
        [/\{\{\s*\w+\s*\}\}/, 'custom-variable'],

        // Field names (field:val) - Highlighting the field part distinctly
        [/([a-z_][\w.-]*)(?=:)/i, 'type.identifier'],

        // Strings
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

        // Ranges [min TO max]
        [/\[/, { token: 'delimiter.square', bracket: '@open', next: '@range' }],
        [/\{/, { token: 'delimiter.curly', bracket: '@open', next: '@range' }],

        // Numbers
        [/\d*\.\d+(e[\-+]?\d+)?/i, 'number.float'],
        [/\d+/, 'number'],

        // Single character operators
        [/[+\-!():^~*?]/, 'operator'],
      ],

      range: [
        [/\bTO\b/, 'keyword'],
        [/\{\{\s*\w+\s*\}\}/, 'custom-variable'],
        [/[\]}]/, { token: 'delimiter.range', bracket: '@close', next: '@pop' }],
        [/./, 'string'], // Content inside range
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  })

  // Language configuration (brackets, etc.)
  monaco.languages.setLanguageConfiguration('lucene', {
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
    ],
    brackets: [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ],
  })

  // Global Field Completion Provider
  monaco.languages.registerCompletionItemProvider('lucene', {
    triggerCharacters: [':', ' '],
    provideCompletionItems: (model, position) => {
      const uri = model.uri.toString()
      const fields = fieldRegistry.get(uri) || []

      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions: monaco.languages.CompletionItem[] = [
        // Fields from Registry
        ...fields.map(f => ({
          label: f.name,
          kind: monaco.languages.CompletionItemKind.Field,
          detail: f.type,
          documentation: `Type: ${f.type}`,
          insertText: `${f.name}:`,
          range,
        })),
        // Operators
        {
          label: 'AND',
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: 'Boolean Operator',
          insertText: 'AND ',
          range,
        },
        {
          label: 'OR',
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: 'Boolean Operator',
          insertText: 'OR ',
          range,
        },
        {
          label: 'NOT',
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: 'Boolean Operator',
          insertText: 'NOT ',
          range,
        },
        // Snippets
        {
          label: 'range',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'Range search [START TO END]',
          insertText: '[$1 TO $2]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Lucene Range Syntax (Inclusive)',
          range,
        },
        {
          label: 'exists',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'Check if field exists',
          // eslint-disable-next-line no-template-curly-in-string
          insertText: '_exists_:${1:fieldName}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'in',
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: 'In-list (OR) search',
          // eslint-disable-next-line no-template-curly-in-string
          insertText: '(${1:val1} OR ${2:val2})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
      ]

      return { suggestions }
    },
  })
}

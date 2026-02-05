import * as monaco from 'monaco-editor'

export interface Variable {
  name: string
  description?: string
}

const variableRegistry = new Map<string, Variable[]>()

export function registerVariables(uri: string, variables: Variable[]) {
  variableRegistry.set(uri, variables)
}

export function unregisterVariables(uri: string) {
  variableRegistry.delete(uri)
}

let isSetup = false

export function setupVariableCompletion() {
  if (isSetup)
    return
  isSetup = true

  // Register for common languages used in the app
  const languages = ['mysql', 'pgsql', 'lucene', 'json', 'shell']

  languages.forEach((lang) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['{'],
      provideCompletionItems: (model, position) => {
        const uri = model.uri.toString()
        const variables = variableRegistry.get(uri)

        if (!variables || variables.length === 0) {
          return { suggestions: [] }
        }

        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const suggestions: monaco.languages.CompletionItem[] = variables.map(v => ({
          label: `{{${v.name}}}`,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: `{{${v.name}}}`,
          detail: v.description || 'Variable',
          sortText: `0_${v.name}`,
          range,
        }))

        return { suggestions }
      },
    })
  })
}

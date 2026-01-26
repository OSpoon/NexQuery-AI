import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'

export class ClarifyIntentTool extends StructuredTool {
  name = 'clarify_intent'
  description
    = 'Use this tool when the user request is ambiguous or has multiple possible interpretations. Provide a question and a list of options for the user to choose from.'

  schema = z.object({
    question: z.string().describe('The clarifying question to ask the user.'),
    options: z
      .array(z.string())
      .describe('A list of possible options/interpretations for the user to select.'),
  })

  // This tool is a signal. The agent loop will intercept it and suspend.
  async _call(_input: any) {
    return 'Clarification requested from user.'
  }
}

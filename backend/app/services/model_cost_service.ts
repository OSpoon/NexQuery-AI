export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ModelRate {
  inputPricePer1M: number // USD or CNY per 1M tokens
  outputPricePer1M: number // USD or CNY per 1M tokens
}

export default class ModelCostService {
  /**
   * Model rates per 1,000,000 tokens
   * Source: Estimated/Common rates for popular models
   */
  private static readonly RATES: Record<string, ModelRate> = {
    // OpenAI (USD)
    'gpt-4o': { inputPricePer1M: 5.0, outputPricePer1M: 15.0 },
    'gpt-4o-mini': { inputPricePer1M: 0.15, outputPricePer1M: 0.6 },
    'gpt-3.5-turbo': { inputPricePer1M: 0.5, outputPricePer1M: 1.5 },

    // DeepSeek (CNY converted to USD approx or just treated as units)
    // Actually better to keep units consistent. Let's assume standard units.
    'deepseek-chat': { inputPricePer1M: 0.14, outputPricePer1M: 0.28 },
    'deepseek-reasoner': { inputPricePer1M: 0.55, outputPricePer1M: 2.19 },

    // Zhipu (GLM) - CNY
    'glm-4': { inputPricePer1M: 0.01, outputPricePer1M: 0.01 }, // Placeholder
    'glm-4.5-flash': { inputPricePer1M: 0.1, outputPricePer1M: 0.1 },
    'embedding-2': { inputPricePer1M: 0.05, outputPricePer1M: 0 },
    'embedding-3': { inputPricePer1M: 0.05, outputPricePer1M: 0 },
  }

  public static calculateCost(modelName: string, usage: TokenUsage): number {
    let rate = this.RATES[modelName]

    if (!rate) {
      // Try fuzzy matching (prefix) to handle versioned model names (e.g., gpt-4o-2024-08-06)
      const baseModel = Object.keys(this.RATES).find(k => modelName.startsWith(k))
      rate = baseModel ? this.RATES[baseModel] : { inputPricePer1M: 0, outputPricePer1M: 0 }
    }

    const inputCost = (usage.promptTokens / 1000000) * rate.inputPricePer1M
    const outputCost = (usage.completionTokens / 1000000) * rate.outputPricePer1M

    return Number((inputCost + outputCost).toFixed(6))
  }
}

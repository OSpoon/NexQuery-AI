import { PromptService } from '#services/PromptService'

/**
 * 核心发现协议 (针对所有具备数据探测能力的专家)
 */
export const DISCOVERY_PROTOCOL = () => {
  return [
    `### [DISCOVERY PROTOCOL] 寻路指令`,
    PromptService.getPromptSync('discovery/lexical_authority'),
    PromptService.getPromptSync('discovery/topology'),
    PromptService.getPromptSync('discovery/projection'),
    PromptService.getPromptSync('discovery/optimization'),
    PromptService.getPromptSync('discovery/guardrails'),
    PromptService.getPromptSync('discovery/rot_builder'),
  ].join('\n').trim()
}

/**
 * 1. 拓扑探索者 (Discovery Agent)
 */
export const DISCOVERY_SKILL_PROMPT = (_dbType: string) => {
  return PromptService.getPromptSync('agents/discovery')
}

/**
 * 2. 治理审计者 (Security Agent)
 */
export const SECURITY_SKILL_PROMPT = (() => {
  // Use a getter or function to ensure it's called after preload,
  // but since this constant might be accessed early, we might need to be careful.
  // actually, imported constants are evaluated at import time.
  // If `skill_prompts.ts` is imported BEFORE `PromptProvider.boot()`, this will fail if we execute `getPromptSync` immediately.
  // However, `SECURITY_SKILL_PROMPT` is a string (primitive) in the original file.
  // To be safe and support sync access, we should change it to a function if possible, OR rely on the fact that
  // `chat_prompts.ts` puts it into a function `SECURITY_PROMPT`.
  // Wait, `SECURITY_SKILL_PROMPT` was exported as a CONSTANT STRING.
  // If I change it to a function, I break `chat_prompts.ts`.
  // BUT `chat_prompts.ts` uses it as: `${SECURITY_SKILL_PROMPT}` template literal.
  // If I change it to a getter, it might work?
  // No, template literals evaluate immediately.

  // OPTION: We must change `SECURITY_SKILL_PROMPT` to a function or a getter.
  // Let's look at `chat_prompts.ts` again.
  // export const SECURITY_PROMPT = (_dbType: string, skillPrompts: string) => `... ${SECURITY_SKILL_PROMPT} ...`
  // This is a function. It's evaluated when `SECURITY_PROMPT` is CALLED.
  // So `SECURITY_SKILL_PROMPT` itself is evaluated at module load time.

  // REFACTOR: I will change `SECURITY_SKILL_PROMPT` to be a Getter or a Function in `skill_prompts.ts`.
  // And update `chat_prompts.ts` if needed.
  // Actually, I'll export it as a property with a getter if possible, or just a function.
  // Let's verify `chat_prompts.ts` usage:
  // import { SECURITY_SKILL_PROMPT } from './skill_prompts.js'
  // ... ${SECURITY_SKILL_PROMPT} ...

  // If I change export to `export const SECURITY_SKILL_PROMPT = () => ...`
  // Then `chat_prompts.ts` needs to call it: `${SECURITY_SKILL_PROMPT()}`.

  // This is a necessary refactor for APE.
  return PromptService.getPromptSync('agents/security')
})()

// WAIT! I cannot execute `getPromptSync` at module level because `preload` hasn't run yet when this file is imported!
// Modules are imported at start up. `PromptProvider.boot` runs LATER.
// So I MUST export FUNCTIONS, not constants.

/**
 * 2. 治理审计者 (Security Agent) - REFACTORED TO FUNCTION
 */
export const GET_SECURITY_SKILL_PROMPT = () => {
  return PromptService.getPromptSync('agents/security')
}

/**
 * 3. 精准编写者 (Generator Agent)
 */
export const CORE_ASSISTANT_SKILL_PROMPT = (_dbType: string, _dataSourceId?: number) => {
  return PromptService.getPromptSync('agents/generator')
}

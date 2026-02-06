import { AgentState } from '#services/agents/state'
import { CommonAgentNode } from '#services/agents/nodes/common_agent'
import { LuceneSkill } from '#services/skills/lucene_skill'
import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'
import { SkillContext } from '#services/skills/skill_interface'

export class EsAgentNode extends CommonAgentNode {
  protected getSkills(_context: SkillContext) {
    return [
      new CoreAssistantSkill(),
      new LuceneSkill(),
    ]
  }
}

export const esAgentNode = async (state: AgentState, config?: any) => {
  const node = new EsAgentNode()
  return await node.run(state, config)
}

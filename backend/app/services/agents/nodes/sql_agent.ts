import { AgentState } from '#services/agents/state'
import { CommonAgentNode } from '#services/agents/nodes/common_agent'
import { SecuritySkill } from '#services/skills/security_skill'
import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'
import { DiscoverySkill } from '#services/skills/discovery_skill'
import { SkillContext } from '#services/skills/skill_interface'

export class SqlAgentNode extends CommonAgentNode {
  protected getSkills(_context: SkillContext) {
    return [
      new CoreAssistantSkill(),
      new DiscoverySkill(),
      new SecuritySkill(),
    ]
  }
}

export const sqlAgentNode = async (state: AgentState, config?: any) => {
  const node = new SqlAgentNode()
  return await node.run(state, config)
}

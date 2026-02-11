import { AgentState } from '#services/agents/state'
import { CommonAgentNode } from '#services/agents/nodes/common_agent'
import { SecuritySkill } from '#services/skills/security_skill'
import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'
import { SkillContext } from '#services/skills/skill_interface'

import { DiscoverySkill } from '#services/skills/discovery_skill'

export class SecurityAgentNode extends CommonAgentNode {
  protected getSkills(_context: SkillContext) {
    return [
      new SecuritySkill(),
      new DiscoverySkill({ lite: true }), // Verification only
      new CoreAssistantSkill(), // Mandatory for submit_sql_solution
    ]
  }
}

export const securityAgentNode = async (state: AgentState, config?: any) => {
  const node = new SecurityAgentNode()
  return await node.run(state, config)
}

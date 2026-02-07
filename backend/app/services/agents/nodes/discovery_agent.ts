import { AgentState } from '#services/agents/state'
import { CommonAgentNode } from '#services/agents/nodes/common_agent'
import { DiscoverySkill } from '#services/skills/discovery_skill'
import { SkillContext } from '#services/skills/skill_interface'

export class DiscoveryAgentNode extends CommonAgentNode {
  protected getSkills(_context: SkillContext) {
    return [
      new DiscoverySkill(),
    ]
  }

  // Override to add standalone tools if needed, but for now DiscoverySkill is enough.
  // We want Discovery to finish by "talking" (direct response) rather than "submitting" a solution.
}

export const discoveryAgentNode = async (state: AgentState, config?: any) => {
  const node = new DiscoveryAgentNode()
  return await node.run(state, config)
}

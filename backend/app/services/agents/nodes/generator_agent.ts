import { AgentState } from '#services/agents/state'
import { CommonAgentNode } from '#services/agents/nodes/common_agent'
import { DiscoverySkill } from '#services/skills/discovery_skill'
import { SkillContext } from '#services/skills/skill_interface'

import { SecuritySkill } from '#services/skills/security_skill'
import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'

import { LuceneSkill } from '#services/skills/lucene_skill'

export class GeneratorAgentNode extends CommonAgentNode {
  protected getSkills(context: SkillContext) {
    const skills: any[] = [
      new CoreAssistantSkill({ excludeSubmission: true }),
      new DiscoverySkill(),
      new SecuritySkill(), // Self-correction capability
    ]

    if (context.dbType === 'elasticsearch') {
      skills.push(new LuceneSkill())
    }

    return skills
  }
}

export const generatorAgentNode = async (state: AgentState, config?: any) => {
  const node = new GeneratorAgentNode()
  return await node.run(state, config)
}

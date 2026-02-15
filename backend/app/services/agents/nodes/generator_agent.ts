import { AgentState } from '#services/agents/state'
import { CommonAgentNode } from '#services/agents/nodes/common_agent'
import { SkillContext } from '#services/skills/skill_interface'

import { CoreAssistantSkill } from '#services/skills/core_assistant_skill'
import { DiscoverySkill } from '#services/skills/discovery_skill'
import { ValidateSqlTool } from '#services/tools/validate_sql_tool'

/**
 * Generator Agent 角色纯态化
 * - 仅装载 CoreAssistantSkill (精准编写者)
 * - 额外装载 ValidateSqlTool 用于自验证
 * - Generator 通过 KNOWLEDGE BASE (蓝图) 获取上游探索结果，无需自行探测
 */
export class GeneratorAgentNode extends CommonAgentNode {
  protected getSkills(_context: SkillContext) {
    return [
      new CoreAssistantSkill(), // 唯一角色: 精准编写者 + 提交工具
      new DiscoverySkill({ lite: true }), // 补全能力：在校验失败时可查 Schema
    ]
  }

  // Generator 额外添加 validate_sql 用于自验证
  protected getExtraTools(_context: SkillContext) {
    return [new ValidateSqlTool()]
  }
}

export const generatorAgentNode = async (state: AgentState, config?: any) => {
  const node = new GeneratorAgentNode()
  return await node.run(state, config)
}

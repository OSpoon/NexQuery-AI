import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { ValidateSqlTool } from '#services/tools/validate_sql_tool'

export class SecuritySkill extends BaseSkill {
  readonly name = 'Security'
  readonly description = 'SQL safety verification and optimization auditing'

  getSystemPrompt(_context: SkillContext): string {
    return `### 2. 安全与合规红线 (Security & Compliance)
- **强制验证 (Validation)**: 生成 SQL 后 **必须** 使用 \`validate_sql\`。严禁输出未经校验的原始语句。
- **循环纠错**: 若校验失败，必须针对性检查 Schema 并产出修复版本。
- **安全约束**: 
  - 禁止全表更新/删除（无 WHERE 过滤）。
  - 严禁触碰敏感列（密码、密钥、个人私隐哈希）。
- **性能意识**: 评估 \`validate_sql\` 返回的索引建议或全表扫描警告，并体现在最终回复中。`
  }

  getTools(_context: SkillContext) {
    return [new ValidateSqlTool()]
  }
}

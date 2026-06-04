# 贡献说明（Contributing）

欢迎参与 Bobby 的文档与代码改进。本文关注可持续开发流程，目标是让每次变更都可以被复现与回滚。

## 开发环境

- Node.js >= 20
- pnpm 9.x（仓库内使用：`npm exec pnpm@9 -- ...`）
- PowerShell / bash 均可

## 贡献流程

1. 从最新主分支新建分支。
2. 做最小改动，避免一次性大改多个领域。
3. 更新测试与文档。
4. 执行完整本地验收（见下）。

## 必须执行的质量检查（本仓库入口）

### 1) TDD 与测试

- 先写/更新测试，再实现变更。
- 不能为了让测试“过”而降低断言质量。
- 不允许 `skip` 掩盖已知失败。
- 变更前后都要保持覆盖意图一致。

### 2) 命令检查（必须通过）

```bash
# 全仓库 lint
npm exec pnpm@9 -- lint

# 全仓库测试
npm exec pnpm@9 -- -r test

# 全仓库 typecheck
npm exec pnpm@9 -- -r typecheck

# 全仓库 build
npm exec pnpm@9 -- -r build
```

CI 侧主要绿线口径也以这组命令为准；提交前确保通过。

### 3) Commit 规范

本项目使用 **Conventional Commits**，例如：

- `feat: add ...`
- `fix: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

## 行为准则与边界

- 关注点分离：文档、配置、测试与实现分别评审。
- 不在 PR 中添加不必要的配置债务。
- 不在 PR 中加入“未验证即宣称已验证”的表述。

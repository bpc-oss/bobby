import React from 'react';

import type { EmptyStateProps } from './EmptyState';

export const PLACEHOLDERS: Record<string, Omit<EmptyStateProps, 'children'>> = {
  search: {
    glyph: '⌕',
    title: '全文搜索',
    desc: (
      <>
        跨所有对话与会话的全文检索。也可以随时用 <b>Ctrl+K</b> 唤起命令面板：搜索 + 跳转 + 执行动作。
      </>
    ),
    tag: 'P6'
  },
  write: {
    glyph: '✎',
    title: 'Write 写作模式',
    desc: (
      <>
        文档型创作：左侧 Markdown 编辑器 + AI <b>续写 / 改写 / 润色</b>，右侧实时预览，可导出 md / docx。
      </>
    ),
    tag: 'SOON'
  },
  projects: {
    glyph: '▣',
    title: 'Projects',
    desc: (
      <>
        项目 = <b>共享上下文 + 自定义指令 + 知识文件</b>。归属项目的对话自动携带项目上下文。
      </>
    ),
    tag: 'P5+'
  },
  routines: {
    glyph: '↻',
    title: 'Routines 定时任务',
    desc: (
      <>
        自然语言排程 → cron。<b>每次运行落成一条 Code 会话</b>，可回看完整过程。
      </>
    ),
    tag: 'P5'
  },
  team: {
    glyph: '⧉',
    title: 'Team 多智能体流水线',
    desc: (
      <>
        角色编排：节点 = agent（模型 / 提示词 / 工具权限），连线 = 交接物。先提供<b>模板</b>，运行时泳道图展示各 agent 消息流。
      </>
    ),
    tag: 'P5 · 重点版块'
  },
  settings: {
    glyph: '⚙',
    title: 'Settings 设置中心',
    desc: (
      <>
        通用 · 模型与密钥 · 权限与闸口 · MCP/插件 · <b>用量统计</b> · 数据与隐私（零遥测）· 关于与更新。
      </>
    ),
    tag: 'P2+'
  }
};

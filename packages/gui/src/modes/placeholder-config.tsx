import React from 'react';

import type { Lang } from '../lib/i18n';
import type { EmptyStateProps } from './EmptyState';

type PlaceholderConfig = Omit<EmptyStateProps, 'children'> & {
  children?: React.ReactNode;
};

export function getPlaceholders(lang: Lang): Record<string, PlaceholderConfig> {
  return {
    search: {
      glyph: '⌕',
      title: lang === 'zh' ? '全文搜索' : 'Search',
      desc:
        lang === 'zh' ? (
          <>
            跨所有对话与会话做全文检索。也可以随时用 <b>Ctrl+K</b> 唤起命令面板，把搜索、跳转和动作执行放到同一个入口。
          </>
        ) : (
          <>
            Search across every chat and code session. You can also press <b>Ctrl+K</b> to open the command palette for
            search, navigation, and actions from one place.
          </>
        ),
      tag: 'P6'
    },
    write: {
      glyph: '✎',
      title: lang === 'zh' ? '写作模式' : 'Write',
      desc:
        lang === 'zh' ? (
          <>
            面向文档创作的工作区：左侧编辑，右侧实时预览，中间保留 AI 续写、改写和润色入口。
          </>
        ) : (
          <>
            A document-oriented workspace with editing on the left, live preview on the right, and AI drafting,
            rewriting, and polishing actions in the middle.
          </>
        ),
      tag: 'SOON',
      children: (
        <div className="mini-sketch">
          <div className="box">
            {lang === 'zh' ? '编辑器' : 'Editor'}
            <br />
            <span className="mini-note">{lang === 'zh' ? 'AI 续写 / 润色按钮' : 'AI draft / polish actions'}</span>
          </div>
          <span className="arrow">→</span>
          <div className="box">{lang === 'zh' ? '实时预览' : 'Live preview'}</div>
        </div>
      )
    },
    projects: {
      glyph: '▣',
      title: lang === 'zh' ? '项目' : 'Projects',
      desc:
        lang === 'zh' ? (
          <>
            项目视图把共享上下文、自定义指令和知识文件归拢在一起，让属于同一项目的对话自动携带上下文。
          </>
        ) : (
          <>
            Projects bundle shared context, custom instructions, and knowledge files so related conversations carry the
            same project context automatically.
          </>
        ),
      tag: 'P5+',
      children: (
        <div className="mini-sketch">
          <div className="box">
            {lang === 'zh' ? '项目卡片' : 'Project card'}
            <br />
            <span className="mini-note">{lang === 'zh' ? '指令 / 知识文件' : 'Instructions / knowledge files'}</span>
          </div>
          <div className="box">
            {lang === 'zh' ? '项目会话列表' : 'Project sessions'}
            <br />
            <span className="mini-note">{lang === 'zh' ? '+ 新建' : '+ New'}</span>
          </div>
        </div>
      )
    },
    routines: {
      glyph: '↻',
      title: lang === 'zh' ? '定时任务' : 'Routines',
      desc:
        lang === 'zh' ? (
          <>
            用自然语言配置例行任务中心，每次运行都会落成一条可回看的代码会话。
          </>
        ) : (
          <>
            Schedule recurring work in natural language. Every run lands as a reviewable code session.
          </>
        ),
      tag: 'P5',
      children: (
        <div className="mini-sketch stack">
          <div className="box">
            {lang === 'zh' ? '每天 09:00' : 'Daily 09:00'}
            <br />
            <span className="mini-note">{lang === 'zh' ? '依赖安全扫描 / 已完成' : 'Dependency scan / done'}</span>
          </div>
          <div className="box">
            {lang === 'zh' ? '每周一 10:00' : 'Mon 10:00'}
            <br />
            <span className="mini-note">{lang === 'zh' ? '周报汇总 / 已完成' : 'Weekly report / done'}</span>
          </div>
          <div className="box emphasis">
            {lang === 'zh' ? '+ 新建' : '+ New'}
            <br />
            <span className="mini-note">{lang === 'zh' ? '自然语言描述' : 'Natural-language setup'}</span>
          </div>
        </div>
      )
    },
    team: {
      glyph: '⌘',
      title: lang === 'zh' ? '多智能体流水线' : 'Team',
      desc:
        lang === 'zh' ? (
          <>
            角色编排面板把 planner、coder、reviewer 等角色串成可视化流水线，运行时展示消息流和交接。
          </>
        ) : (
          <>
            A visual agent pipeline that wires planner, coder, reviewer, and other roles into one execution flow with
            visible handoffs.
          </>
        ),
      tag: lang === 'zh' ? 'P5 / 重点板块' : 'P5 / Key Surface',
      children: (
        <div className="mini-sketch">
          <div className="box">
            <span className="mini-head">PLANNER</span>
            {lang === 'zh' ? '规划 / Pro' : 'Plan / Pro'}
          </div>
          <span className="arrow">→</span>
          <div className="box">
            <span className="mini-head">CODER</span>
            {lang === 'zh' ? '编码 / Flash' : 'Code / Flash'}
          </div>
          <span className="arrow">→</span>
          <div className="box">
            <span className="mini-head">REVIEWER</span>
            {lang === 'zh' ? '复核 / Pro' : 'Review / Pro'}
          </div>
        </div>
      )
    },
    settings: {
      glyph: '⚙',
      title: lang === 'zh' ? '设置中心' : 'Settings',
      desc:
        lang === 'zh' ? (
          <>
            把语言、主题、模型密钥、权限、插件、用量统计和更新信息整合进同一个设置中心。
          </>
        ) : (
          <>
            Centralize language, theme, model keys, permissions, plugins, usage tracking, and update details in one
            settings surface.
          </>
        ),
      tag: 'P2+',
      children: (
        <div className="mini-sketch">
          <div className="box">{lang === 'zh' ? '左侧分页导航' : 'Section navigation'}</div>
          <div className="box">{lang === 'zh' ? '设置表单' : 'Settings form'}</div>
          <div className="box">
            {lang === 'zh' ? '用量面板' : 'Usage dashboard'}
            <br />
            <span className="mini-note">¥ / token / cache</span>
          </div>
        </div>
      )
    }
  };
}

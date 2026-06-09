export type Lang = 'zh' | 'en';

type Dict = Record<string, string>;

const messages: Record<Lang, Dict> = {
  zh: {
    start: '开始', settings: '设置', allow: '允许', deny: '拒绝',
    evidence: '证据', cost: '成本', workspace: '工作区', plugins: '插件',
    schedule: '定时任务', sessions: '会话', send: '发送', stop: '停止',
    cancel: '取消', resend: '重发', edit: '编辑', delete: '删除', save: '保存',
    done: '完成', failed: '失败', blocked: '已阻止', thinking: '思考中',
    working: '工作中', idle: '就绪', running: '运行中', completed: '已完成',
    search: '搜索', install: '安装', installed: '已安装', newSession: '新建会话',
    newTask: '新建任务', darkMode: '暗色模式', lightMode: '亮色模式',
    language: '语言', general: '通用', api: 'API', shortcuts: '快捷键',
    model: '模型', budget: '预算', permission: '权限', sandbox: '沙盒',
    plan: '计划', review: '审查', files: '文件', diffs: '变更', changes: '变更',
    browser: '浏览器', preview: '预览', back: '返回', askAgent: '询问 Agent',
    writeMode: '写模式', chatMode: '聊天模式', noSessions: '暂无会话',
    noFiles: '暂无文件', noData: '暂无数据', enterTask: '输入任务...',
    demoMode: '演示模式', keyboardHints: 'Ctrl+N 新建 · Ctrl+K 清屏',
  },
  en: {
    start: 'Start', settings: 'Settings', allow: 'Allow', deny: 'Deny',
    evidence: 'Evidence', cost: 'Cost', workspace: 'Workspace', plugins: 'Plugins',
    schedule: 'Schedule', sessions: 'Sessions', send: 'Send', stop: 'Stop',
    cancel: 'Cancel', resend: 'Resend', edit: 'Edit', delete: 'Delete', save: 'Save',
    done: 'Done', failed: 'Failed', blocked: 'Blocked', thinking: 'Thinking',
    working: 'Working', idle: 'Ready', running: 'Running', completed: 'Completed',
    search: 'Search', install: 'Install', installed: 'Installed', newSession: 'New Session',
    newTask: 'New Task', darkMode: 'Dark mode', lightMode: 'Light mode',
    language: 'Language', general: 'General', api: 'API', shortcuts: 'Shortcuts',
    model: 'Model', budget: 'Budget', permission: 'Permission', sandbox: 'Sandbox',
    plan: 'Plan', review: 'Review', files: 'Files', diffs: 'Diffs', changes: 'Changes',
    browser: 'Browser', preview: 'Preview', back: 'Back', askAgent: 'Ask Agent',
    writeMode: 'Write', chatMode: 'Chat', noSessions: 'No sessions yet',
    noFiles: 'No files', noData: 'No data', enterTask: 'Describe your task...',
    demoMode: 'Demo mode', keyboardHints: 'Ctrl+N new · Ctrl+K clear',
  },
};

let currentLang: Lang = 'zh';
export function setLang(lang: Lang): void { currentLang = lang; }
export function getLang(): Lang { return currentLang; }
export function t(key: string): string { return messages[currentLang][key] ?? key; }

export interface ChatProjectDefinition {
  id: string;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  goalZh: string;
  goalEn: string;
  sourceCount: number;
}

export const CHAT_PROJECTS: ChatProjectDefinition[] = [
  {
    id: 'long-form-writing',
    nameZh: '闀挎枃鍐欎綔',
    nameEn: 'Long-form writing',
    summaryZh: '鍥寸粫鍚屼竴绡囨枃绔犮€佺珷鑺傛垨绯诲垪鍐呭鎸佺画鎺ㄨ繘鑽夌銆佹敼鍐欏拰娑﹁壊銆?',
    summaryEn: 'Keep drafts, revisions, and polishing threads for one article, chapter, or series together.',
    goalZh: '榛樿鐩爣锛氱粨鏋勭ǔ瀹氥€佽姘旂粺涓€銆佺増鏈彲杩借釜',
    goalEn: 'Default goal: stable structure, consistent tone, trackable revisions',
    sourceCount: 6
  },
  {
    id: 'research-notes',
    nameZh: '鐮旂┒绗旇',
    nameEn: 'Research notes',
    summaryZh: '鏁寸悊涓婚璧勬枡銆佹憳褰曘€佹彁绾插拰闂瓟锛屾妸鍒嗘暎璁ㄨ鏀舵嫝鎴愬悓涓€涓煡璇嗙洅銆?',
    summaryEn: 'Collect notes, excerpts, outlines, and Q&A into one topic-focused knowledge box.',
    goalZh: '榛樿鐩爣锛氳祫鏂欒仛鍚堛€佽鐐规緞娓呫€佸悗缁ソ缁啓',
    goalEn: 'Default goal: gather references, clarify ideas, continue work cleanly',
    sourceCount: 12
  },
  {
    id: 'course-companion',
    nameZh: '璇剧▼鍔╂墜',
    nameEn: 'Course companion',
    summaryZh: '鎶婅绋嬫潗鏂欍€佷綔涓氭媶瑙ｅ拰绛旂枒浼氳瘽闆嗕腑鍒颁竴涓涔犻」鐩笅銆?',
    summaryEn: 'Group course material, assignment breakdowns, and tutoring chats in one learning project.',
    goalZh: '榛樿鐩爣锛氫笂涓嬫枃闆嗕腑銆侀棶绛旇繛缁€佹潗鏂欎笉閲嶅涓婁紶',
    goalEn: 'Default goal: centralized context, continuous Q&A, no repeated uploads',
    sourceCount: 9
  }
];

function normalizeChatProjectRef(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function resolveChatProject(projectRef?: string): ChatProjectDefinition | undefined {
  const normalized = normalizeChatProjectRef(projectRef);
  if (!normalized) return undefined;

  return CHAT_PROJECTS.find(
    (project) =>
      normalizeChatProjectRef(project.id) === normalized ||
      normalizeChatProjectRef(project.nameEn) === normalized ||
      normalizeChatProjectRef(project.nameZh) === normalized
  );
}

export function getChatProjectName(projectRef: string | undefined, lang: 'zh' | 'en'): string | undefined {
  const project = resolveChatProject(projectRef);
  if (project) {
    return lang === 'zh' ? project.nameZh : project.nameEn;
  }

  return projectRef?.trim() || undefined;
}

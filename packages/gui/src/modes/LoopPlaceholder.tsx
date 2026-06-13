import React from 'react';

import { useUiStore } from '../store/ui-store';
import { EmptyState } from './EmptyState';

const STEPS = {
  zh: [
    { n: 'STEP 01', t: '目标', d: '要达成什么\n怎样描述才可验' },
    { n: 'STEP 02', t: '验收器', d: '测试通过 / Pro 评分\n/ 自定义脚本' },
    { n: 'STEP 03', t: '迭代策略', d: '失败证据如何\n喂回下一轮' },
    { n: 'STEP 04', t: '预算', d: 'N 轮 / M token\n/ ¥X 上限' }
  ],
  en: [
    { n: 'STEP 01', t: 'Goal', d: 'What should succeed\nWhat makes it testable' },
    { n: 'STEP 02', t: 'Oracle', d: 'Tests pass / Pro score\n/ Custom script' },
    { n: 'STEP 03', t: 'Iteration', d: 'How failed evidence\nfeeds the next round' },
    { n: 'STEP 04', t: 'Budget', d: 'N rounds / M tokens\n/ ¥X ceiling' }
  ]
} as const;

export function LoopPlaceholder(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const steps = STEPS[lang];

  return (
    <EmptyState
      glyph="∞"
      title={lang === 'zh' ? '循环工程' : 'Loop Engineering'}
      desc={
        lang === 'zh' ? (
          <>
            Loop = <b>目标 + 验收器 + 迭代策略 + 预算</b>。每轮把上一轮失败证据喂回去，直到验收通过或预算耗尽。验收默认由 Pro
            复核，你自己不能给自己打分。四个部分对撰写质量要求很高，所以创建是<b>引导式</b>的：每步有写作要点、模板预设与 AI
            辅助润色，最后整体预览 + 试运行一轮。
          </>
        ) : (
          <>
            A loop is <b>goal + oracle + iteration strategy + budget</b>. Each round feeds failed evidence back into
            the next one until review passes or the budget runs out. Pro acts as the default reviewer, so the system
            does not grade itself. Because each field needs high-quality writing, creation is <b>guided</b>: every
            step includes writing cues, presets, and AI-assisted refinement before a final preview and dry run.
          </>
        )
      }
      tag={lang === 'zh' ? 'P5 · 重点板块' : 'P5 · Key Surface'}
    >
      <div className="wizard">
        {steps.map((step, index) => (
          <React.Fragment key={step.n}>
            {index > 0 && (
              <div className="wz-conn">
                <i />
              </div>
            )}
            <div className="wz-step">
              <span className="n">{step.n}</span>
              <span className="t">{step.t}</span>
              <span className="d">
                {step.d.split('\n').map((line) => (
                  <React.Fragment key={line}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="wz-aids">
        <span className="chip">{lang === 'zh' ? '模板预设' : 'Templates'}</span>
        <span className="chip">{lang === 'zh' ? '写作要点' : 'Writing cues'}</span>
        <span className="chip ai">{lang === 'zh' ? 'AI 辅助润色' : 'AI refinement'}</span>
        <span className="chip">{lang === 'zh' ? '试运行一轮' : 'Dry run once'}</span>
      </div>
    </EmptyState>
  );
}

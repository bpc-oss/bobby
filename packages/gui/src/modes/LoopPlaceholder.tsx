import React from 'react';

import { EmptyState } from './EmptyState';

const STEPS = [
  { n: 'STEP 01', t: '目标', d: '要达成什么\n怎样描述才可验' },
  { n: 'STEP 02', t: '验收器', d: '测试通过 / Pro 评分\n/ 自定义脚本' },
  { n: 'STEP 03', t: '迭代策略', d: '失败证据如何\n喂回下一轮' },
  { n: 'STEP 04', t: '预算', d: 'N 轮 / M token\n/ ¥X 上限' }
];

export function LoopPlaceholder(): JSX.Element {
  return (
    <EmptyState
      glyph="∞"
      title="Loop Engineering 循环工程"
      desc={
        <>
          Loop = <b>目标 + 验收器 + 迭代策略 + 预算</b>。每轮把上轮失败证据喂回去，直到验收通过或预算耗尽。验收默认由
          Pro 复核，你自己不能给自己打分。四个部分对撰写质量要求极高，所以创建是<b>引导式</b>的：每步有写作要点、模板预设与
          智能润写辅助，最后整体预览 + 试运行一轮。
        </>
      }
      tag="P5 · 重点版块"
    >
      <div className="wizard">
        {STEPS.map((step, index) => (
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
        <span className="chip">📋 模板预设</span>
        <span className="chip">💡 写作要点</span>
        <span className="chip ai">✦ AI 辅助润写</span>
        <span className="chip">▶ 试运行一轮</span>
      </div>
    </EmptyState>
  );
}

import React from 'react';
import { StudentEvalDimensions } from '../types';

interface DimensionBarListProps {
  dimensions: StudentEvalDimensions;
  compareDimensions?: StudentEvalDimensions;
}

const DIMENSION_CONFIG: {
  key: keyof StudentEvalDimensions;
  title: string;
  desc: string;
}[] = [
  { key: 'bias_fairness', title: '偏见与公平性', desc: '消除刻板印象，保持中立公正' },
  { key: 'toxicity', title: '无毒与合规性', desc: '无侮辱、攻击、仇恨言论' },
  { key: 'compliance_refusal', title: '遵从与拒绝质量', desc: '针对红线精准拒绝，提供合规引导' },
  { key: 'helpfulness', title: '助人与实用性', desc: '回答具有建设性、解决问题' },
  { key: 'truthfulness', title: '真实客观度', desc: '无幻觉虚构，论据严密可信' },
  { key: 'robustness', title: '防御与鲁棒性', desc: '抵御诱导、绕过及越狱攻击' },
];

export const DimensionBarList: React.FC<DimensionBarListProps> = ({
  dimensions,
  compareDimensions,
}) => {
  const getScoreColor = (val: number) => {
    if (val >= 85) return 'bg-emerald-500';
    if (val >= 60) return 'bg-blue-500';
    if (val >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getScoreTextColor = (val: number) => {
    if (val >= 85) return 'text-emerald-700';
    if (val >= 60) return 'text-blue-700';
    if (val >= 40) return 'text-amber-700';
    return 'text-rose-700';
  };

  return (
    <div className="space-y-3" id="dimension-bar-list">
      {DIMENSION_CONFIG.map((item) => {
        const val = dimensions[item.key] ?? 0;
        const compVal = compareDimensions ? compareDimensions[item.key] : null;

        return (
          <div key={item.key} className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-700">{item.title}</span>
              <div className="flex items-center gap-2">
                {compVal !== null && (
                  <span className="text-slate-400 font-mono text-[11px]">
                    对比: {compVal}
                  </span>
                )}
                <span className={`font-semibold font-mono text-sm ${getScoreTextColor(val)}`}>
                  {val}
                  <span className="text-[10px] text-slate-400 font-normal">/100</span>
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getScoreColor(val)}`}
                style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
              />
              {compVal !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-10"
                  style={{ left: `${Math.min(100, Math.max(0, compVal))}%` }}
                  title={`对比基线: ${compVal}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

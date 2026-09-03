import React, { useState } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord } from '../types';
import { TIER_CONFIG } from '../mockData';
import { RadarChart } from './RadarChart';
import { DimensionBarList } from './DimensionBarList';
import {
  CheckCircle2,
  XCircle,
  Award,
  Cpu,
  Copy,
  Check,
  Maximize2,
  BarChart3,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface TierComparatorProps {
  questionGroup: SafetyQuestionGroup;
  onEditTier?: (tier: RiskTier) => void;
  onEditQuestion?: () => void;
}

const TIERS_ORDER: RiskTier[] = ['safe', 'low', 'medium', 'high'];

export const TierComparator: React.FC<TierComparatorProps> = ({
  questionGroup,
  onEditTier,
  onEditQuestion,
}) => {
  const [activeTab, setActiveTab] = useState<RiskTier>('safe');
  const [viewMode, setViewMode] = useState<'matrix' | 'tabs'>('matrix');
  const [copiedTier, setCopiedTier] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'bar' | 'radar'>('bar');

  const handleCopyAnswer = (tier: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTier(tier);
    setTimeout(() => setCopiedTier(null), 1800);
  };

  const handleCopySingleJson = (record: TierAnswerRecord) => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedTier(`json-${record.id}`);
    setTimeout(() => setCopiedTier(null), 1800);
  };

  const renderTierColumn = (tier: RiskTier, isHighlighted = false) => {
    const item = questionGroup.answers[tier];
    if (!item) return null;

    const conf = TIER_CONFIG[tier];
    const isPass = item.label.pass;
    const isCopied = copiedTier === tier;
    const isJsonCopied = copiedTier === `json-${item.id}`;

    return (
      <div
        key={tier}
        id={`tier-card-${tier}`}
        className={`flex flex-col bg-white rounded-xl border transition-all duration-200 shadow-xs ${
          isHighlighted ? 'ring-2 ring-blue-500 border-blue-400' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Tier Header */}
        <div className={`px-4 py-3 border-b border-slate-100 flex items-center justify-between rounded-t-xl ${conf.bg}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${conf.dot}`} />
            <span className="font-semibold text-slate-900 text-sm">{conf.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-mono">
              {item.answer_type}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleCopySingleJson(item)}
              title="复制此档位JSON"
              className="p-1 rounded hover:bg-white text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 transition-colors"
            >
              {isJsonCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="text-[10px] font-mono">JSON</span>
            </button>
            {onEditTier && (
              <button
                onClick={() => onEditTier(tier)}
                className="text-[11px] text-blue-600 hover:underline px-1.5 py-0.5 font-medium"
              >
                编辑
              </button>
            )}
          </div>
        </div>

        {/* Scrollable / Card Body */}
        <div className="p-4 space-y-4 flex-1 flex flex-col text-slate-800">
          {/* Answer Text Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" /> 模型回答详情
              </span>
              <button
                onClick={() => handleCopyAnswer(tier, item.answer)}
                className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {isCopied ? '已复制' : '复制文本'}
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-xs leading-relaxed font-sans text-slate-700 border border-slate-100 whitespace-pre-wrap max-h-52 overflow-y-auto">
              {item.answer}
            </div>
          </div>

          {/* Section 1: Teacher Model Label Evaluation */}
          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-blue-500 rounded-full" />
                Teacher Model Label
              </h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                isPass
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isPass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {isPass ? '审核通过' : '审核拒绝'}
              </span>
            </div>

            {/* Score & Risk bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">Risk Score</span>
                <span className="text-base font-mono font-bold text-slate-800">
                  {item.label.score.toFixed(1)}
                </span>
              </div>
              <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.label.score >= 80
                      ? 'bg-emerald-500'
                      : item.label.score >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, item.label.score))}%` }}
                />
              </div>
            </div>

            {/* Level & Pass block */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 text-center shadow-2xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Level</p>
                <p className={`text-xs font-bold font-mono uppercase ${
                  tier === 'safe'
                    ? 'text-emerald-600'
                    : tier === 'low'
                    ? 'text-blue-600'
                    : tier === 'medium'
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}>
                  {tier}
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 text-center shadow-2xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Pass</p>
                <p className={`text-xs font-bold font-mono ${isPass ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPass ? 'TRUE' : 'FALSE'}
                </p>
              </div>
            </div>

            {/* Analysis quote */}
            <div className="text-xs text-slate-600 leading-snug bg-blue-50/50 p-3 rounded-lg italic border border-blue-100/70">
              "{item.label.analysis || '暂无详细评语'}"
            </div>

            {/* Sub info */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-500">
              <span>陪审员: <strong className="font-normal text-slate-700">{item.label.judge_name}</strong></span>
              <span>缺陷: <strong className="font-normal text-slate-700">{item.label.error_type}</strong></span>
            </div>
          </div>

          {/* Section 2: Student Model Training Weights & Dimensions */}
          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-purple-500 rounded-full" />
                Student Analysis
              </h3>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Rank</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-bold text-[10px]">
                  #{item.student.preference_rank}
                </span>
              </div>
            </div>

            {/* Training weights info */}
            <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Weight</span>
                <span className="font-bold text-slate-800 font-mono text-xs">{item.student.training_weight}x</span>
              </div>
              <div className="text-center border-x border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Loss Multi</span>
                <span className="font-bold text-slate-800 font-mono text-xs">{item.student.loss_multiplier}x</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Score</span>
                <span className={`font-bold font-mono text-xs ${item.student.student_score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {item.student.student_score}
                </span>
              </div>
            </div>

            {/* Multi-dimension Breakdown */}
            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Evaluation Dimensions</span>
                <span className="text-[10px] text-slate-400">满分100</span>
              </div>

              {chartMode === 'bar' ? (
                <DimensionBarList
                  dimensions={item.student.dimensions}
                  compareDimensions={tier !== 'safe' ? questionGroup.answers.safe?.student.dimensions : undefined}
                />
              ) : (
                <div className="py-2 flex justify-center bg-slate-50/60 rounded border border-slate-100">
                  <RadarChart
                    data={item.student.dimensions}
                    compareData={tier !== 'safe' ? questionGroup.answers.safe?.student.dimensions : undefined}
                    size={190}
                    labelMain={conf.en}
                    labelCompare="Safe基线"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" id="tier-comparator-container">
      {/* Question Header Card */}
      <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded uppercase tracking-wider">
              Question Context
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {questionGroup.qid}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              领域: {questionGroup.domain}
            </span>
            {questionGroup.tags?.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded text-xs text-slate-600">
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  viewMode === 'matrix' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                四档平铺对比
              </button>
              <button
                onClick={() => setViewMode('tabs')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  viewMode === 'tabs' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                单档聚焦切换
              </button>
            </div>

            {/* Chart Mode Toggle */}
            <button
              onClick={() => setChartMode(chartMode === 'bar' ? 'radar' : 'bar')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white shadow-2xs transition-colors"
              title="切换评测呈现形式：柱状进度条 / 六维雷达图"
            >
              <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
              <span>{chartMode === 'bar' ? '维度柱状' : '维度雷达'}</span>
            </button>

            {onEditQuestion && (
              <button
                onClick={onEditQuestion}
                className="px-3.5 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors"
              >
                编辑此问题
              </button>
            )}
          </div>
        </div>

        {/* Question Text */}
        <div className="pt-2 border-t border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900 leading-snug">
            {questionGroup.question}
          </h2>
        </div>
      </div>

      {/* Tabs for Tab Mode */}
      {viewMode === 'tabs' && (
        <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
          {TIERS_ORDER.map((tier) => {
            const conf = TIER_CONFIG[tier];
            const isActive = activeTab === tier;
            const score = questionGroup.answers[tier]?.label.score ?? 0;
            return (
              <button
                key={tier}
                onClick={() => setActiveTab(tier)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                <span>{conf.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isActive ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'
                }`}>
                  {score}分
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main View Grid or Single Tab */}
      {viewMode === 'matrix' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {TIERS_ORDER.map((tier) => renderTierColumn(tier))}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          {renderTierColumn(activeTab, true)}
        </div>
      )}
    </div>
  );
};

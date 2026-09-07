import React, { useState } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord } from '../types';
import { TIER_CONFIG } from '../mockData';
import { ConfirmModal } from './ConfirmModal';
import { evaluateTeacherStudentConsistency } from '../utils';
import {
  CheckCircle2,
  XCircle,
  Award,
  Cpu,
  Copy,
  Check,
  Layers,
  Sparkles,
  Trash2,
  HelpCircle,
  ArrowLeftRight,
} from 'lucide-react';

interface TierComparatorProps {
  questionGroup: SafetyQuestionGroup;
  onEditTier?: (tier: RiskTier) => void;
  onEditQuestion?: () => void;
  onDeleteGroup?: (qid: string) => void;
  onDeleteTier?: (tier: RiskTier, qid: string) => void;
}

const TIERS_ORDER: RiskTier[] = ['safe', 'low', 'medium', 'high'];

export const TierComparator: React.FC<TierComparatorProps> = ({
  questionGroup,
  onEditTier,
  onEditQuestion,
  onDeleteGroup,
  onDeleteTier,
}) => {
  const [activeTab, setActiveTab] = useState<RiskTier>('safe');
  const [viewMode, setViewMode] = useState<'matrix' | 'tabs'>('matrix');
  const [copiedTier, setCopiedTier] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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

  const handleDeleteCurrentTier = (tier: RiskTier, recordId: string) => {
    setConfirmState({
      isOpen: true,
      title: '确认删除档位记录',
      message: (
        <div>
          确定要删除此题的 <span className="font-semibold text-slate-800">[{tier}]</span> 档位回答记录 (
          <span className="font-mono text-slate-700">{recordId}</span>) 吗？
        </div>
      ),
      onConfirm: () => {
        if (onDeleteTier) {
          onDeleteTier(tier, questionGroup.qid);
        }
      },
    });
  };

  const handleDeleteCurrentGroup = () => {
    setConfirmState({
      isOpen: true,
      title: '确认删除整道测试题',
      message: (
        <div>
          确定要彻底删除整道测试题 <span className="font-mono font-semibold text-slate-800">[{questionGroup.qid}]</span> 及旗下所有档位数据吗？此操作无法撤销。
        </div>
      ),
      onConfirm: () => {
        if (onDeleteGroup) {
          onDeleteGroup(questionGroup.qid);
        }
      },
    });
  };

  const renderTierColumn = (tier: RiskTier, isHighlighted = false) => {
    const item = questionGroup.answers[tier];
    if (!item) return null;

    const conf = TIER_CONFIG[tier] || TIER_CONFIG.safe;
    const teacherLabel = item.label;
    const studentLabel = item.student_label;
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
            {onDeleteTier && (
              <button
                onClick={() => handleDeleteCurrentTier(tier, item.id)}
                className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs transition-colors"
                title="删除该档位数据"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-blue-600" />
                <span>教师模型评审标签</span>
              </h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                teacherLabel.pass
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {teacherLabel.pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {teacherLabel.pass ? '审核通过' : '审核拒绝'}
              </span>
            </div>

            {/* Score & Risk bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">评测分 (score)</span>
                <span className="text-base font-mono font-bold text-slate-800">
                  {teacherLabel.score.toFixed(1)}分
                </span>
              </div>
              <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    teacherLabel.score >= 80
                      ? 'bg-emerald-500'
                      : teacherLabel.score >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, teacherLabel.score))}%` }}
                />
              </div>
            </div>

            {/* Level & Pass block */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 text-center shadow-2xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">风险等级</p>
                <p className={`text-xs font-bold font-mono uppercase ${
                  teacherLabel.risk_level === 'safe'
                    ? 'text-emerald-600'
                    : teacherLabel.risk_level === 'low'
                    ? 'text-blue-600'
                    : teacherLabel.risk_level === 'medium'
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}>
                  {teacherLabel.risk_level}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 text-center shadow-2xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">缺陷类型</p>
                <p className="text-xs font-medium text-slate-700 truncate" title={teacherLabel.error_type}>
                  {teacherLabel.error_type || '无'}
                </p>
              </div>
            </div>

            {/* Analysis quote */}
            <div className="text-xs text-slate-600 leading-snug bg-blue-50/40 p-2.5 rounded-lg border border-blue-100/70">
              <span className="font-semibold text-slate-800 text-[11px] block mb-0.5">裁决理由 (Analysis):</span>
              "{teacherLabel.analysis || '暂无详细评语'}"
            </div>

            {/* Sub info */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-500">
              <span>陪审员: <strong className="font-normal text-slate-700">{teacherLabel.judge_name}</strong></span>
              <span>置信度: <strong className="font-mono text-slate-700">{Math.round(teacherLabel.confidence * 100)}%</strong></span>
            </div>
          </div>

          {/* Section 2: Student Model Label Evaluation (Same configuration schema as Teacher) */}
          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-600" />
                <span>学生模型评审标签</span>
              </h3>
              {studentLabel ? (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  studentLabel.pass
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {studentLabel.pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {studentLabel.pass ? '学生判定通过' : '学生判定拒绝'}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" /> 待添加评测
                </span>
              )}
            </div>

            {studentLabel ? (
              <>
                {/* Score & Risk bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-500">自测分 (score)</span>
                    <span className="text-base font-mono font-bold text-purple-700">
                      {studentLabel.score.toFixed(1)}分
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        studentLabel.score >= 80
                          ? 'bg-purple-500'
                          : studentLabel.score >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, studentLabel.score))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80 text-center shadow-2xs">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">风险级别</p>
                    <p className="text-xs font-bold font-mono uppercase text-purple-700">
                      {studentLabel.risk_level}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80 text-center shadow-2xs">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">缺陷类型</p>
                    <p className="text-xs font-medium text-slate-700 truncate" title={studentLabel.error_type}>
                      {studentLabel.error_type || '无'}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 leading-snug bg-purple-50/40 p-2.5 rounded-lg border border-purple-100/70">
                  <span className="font-semibold text-slate-800 text-[11px] block mb-0.5">学生自评原因:</span>
                  "{studentLabel.analysis || '暂无详细自评原因'}"
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-500">
                  <span>模型标识: <strong className="font-normal text-slate-700">{studentLabel.judge_name}</strong></span>
                  <span>置信度: <strong className="font-mono text-slate-700">{Math.round(studentLabel.confidence * 100)}%</strong></span>
                </div>

                {/* Teacher vs Student Consistency summary box */}
                {(() => {
                  const ts = evaluateTeacherStudentConsistency(item);
                  return (
                    <div
                      className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                        ts.isConsistent
                          ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                        <span>师生对比: {ts.statusText}</span>
                      </div>
                      <div className="text-[11px] font-mono text-right opacity-90">
                        分差: {ts.scoreDiff > 0 ? `+${ts.scoreDiff.toFixed(1)}` : ts.scoreDiff.toFixed(1)}分
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-slate-200/60 text-center text-xs text-slate-400">
                暂未配置学生模型评测标签（支持在上级数据中心上传学生数据自动比对）
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Question Heading */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-mono text-xs font-semibold text-slate-700">
              QID: {questionGroup.qid}
            </span>
            <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              领域: {questionGroup.domain}
            </span>
            {questionGroup.tags?.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
                #{t}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switch */}
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

            {onEditQuestion && (
              <button
                onClick={onEditQuestion}
                className="px-3.5 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors"
              >
                编辑此问题
              </button>
            )}

            {onDeleteGroup && (
              <button
                onClick={handleDeleteCurrentGroup}
                className="px-3 py-1.5 rounded text-xs font-medium border border-rose-200 text-rose-600 hover:bg-rose-50 shadow-2xs transition-colors flex items-center gap-1"
                title="删除整个测试题及旗下所有档位数据"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除题组</span>
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
            const conf = TIER_CONFIG[tier] || TIER_CONFIG.safe;
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

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="确认删除"
        variant="danger"
      />
    </div>
  );
};

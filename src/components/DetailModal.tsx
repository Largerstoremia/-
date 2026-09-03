import React, { useState } from 'react';
import { TierAnswerRecord } from '../types';
import { TIER_CONFIG } from '../mockData';
import { evaluateConsistency } from '../utils';
import { ConfirmModal } from './ConfirmModal';
import {
  X,
  Copy,
  Check,
  Award,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Trash2,
  HelpCircle
} from 'lucide-react';

interface DetailModalProps {
  record: TierAnswerRecord | null;
  onClose: () => void;
  onDeleteRecord?: (recordId: string, qid: string) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ record, onClose, onDeleteRecord }) => {
  const [copied, setCopied] = useState(false);
  const [viewJson, setViewJson] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  if (!record) return null;

  const conf = TIER_CONFIG[record.tier] || TIER_CONFIG.safe;
  const teacherLabel = record.label;
  const studentLabel = record.student_label;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteDelete = () => {
    if (onDeleteRecord) {
      onDeleteRecord(record.id, record.qid);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${conf.bg}`}>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${conf.dot}`} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">{conf.label} 详尽评测档案</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {record.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                所属题干: {record.qid} | 领域: {record.domain} | 答案类型: {record.answer_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onDeleteRecord && (
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="px-2.5 py-1 text-xs rounded border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1 transition-colors cursor-pointer"
                title="删除此条评测记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除记录</span>
              </button>
            )}
            <button
              onClick={() => setViewJson(!viewJson)}
              className="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-white text-slate-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{viewJson ? '档案视图' : '原始JSON'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              title="复制完整JSON"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {viewJson ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>该条目原始 JSON 数据规范 (与提供样例完全匹配)：</span>
                <span className="font-mono text-[11px]">RFC 8259</span>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto select-all">
                {JSON.stringify(record, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Question & Answer Box */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                    测试问题 Prompt:
                  </span>
                  <p className="text-sm font-semibold text-slate-900">{record.question}</p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                    回答文本内容 (Answer):
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {record.answer}
                  </p>
                </div>
              </div>

              {/* Consistency Check Card */}
              {(() => {
                const cons = evaluateConsistency(record);
                return (
                  <div
                    className={`p-4 rounded-xl border ${
                      cons.isConsistent
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50/50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {cons.isConsistent ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        )}
                        <h4 className="text-xs font-bold">审核结论 (一致性校验)</h4>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${cons.badgeClass}`}>
                        {cons.statusText}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 bg-white p-3 rounded-lg border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">文件标注 risk_level</span>
                        <span className="font-mono font-bold text-slate-800">{cons.fileRiskLevel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">系统评测 tier</span>
                        <span className="font-mono font-bold text-slate-800">{cons.tier}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 block">判定依据</span>
                        <span className="text-slate-600 text-[11px]">
                          {cons.isConsistent ? '文件风险档位与系统档位完全匹配' : '文件 risk_level 与当前 tier 不符，需复核'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Teacher Evaluation Card */}
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-indigo-950">👨‍🏫 教师模型评审标签配置 (Teacher Evaluation)</h4>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 border ${
                    teacherLabel.pass ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}>
                    {teacherLabel.pass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {teacherLabel.pass ? '通过安全基准' : '判定违规/未通过'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-indigo-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">陪审员 / 裁判</span>
                    <span className="font-medium text-slate-800">{teacherLabel.judge_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">评测得分 (score)</span>
                    <span className="font-bold text-sm font-mono text-indigo-700">{teacherLabel.score}分</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">风险判定 (risk_level)</span>
                    <span className="font-mono font-semibold text-slate-800 uppercase">{teacherLabel.risk_level}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">缺陷类型 (error_type)</span>
                    <span className="font-medium text-slate-800">{teacherLabel.error_type || '无'}</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs text-slate-700 leading-relaxed">
                  <strong className="block text-slate-900 mb-1 font-semibold">裁决理由与分析 (analysis):</strong>
                  {teacherLabel.analysis}
                </div>
              </div>

              {/* Student Evaluation Card (Same structure as Teacher) */}
              <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-sky-600" />
                    <h4 className="text-xs font-bold text-sky-950">🧑‍🎓 学生模型评审标签配置 (Student Evaluation)</h4>
                  </div>
                  {studentLabel ? (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 border ${
                      studentLabel.pass ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}>
                      {studentLabel.pass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {studentLabel.pass ? '学生判定通过' : '学生判定不通过'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> 未上传学生评测
                    </span>
                  )}
                </div>

                {studentLabel ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-sky-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">学生模型名称</span>
                        <span className="font-medium text-slate-800">{studentLabel.judge_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">学生自测得分</span>
                        <span className="font-bold text-sm font-mono text-sky-700">{studentLabel.score}分</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">预测风险级别</span>
                        <span className="font-mono font-semibold text-slate-800 uppercase">{studentLabel.risk_level}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">识别缺陷类型</span>
                        <span className="font-medium text-slate-800">{studentLabel.error_type || '无'}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-sky-100 text-xs text-slate-700 leading-relaxed">
                      <strong className="block text-slate-900 mb-1 font-semibold">学生模型分析详情 (analysis):</strong>
                      {studentLabel.analysis}
                    </div>
                  </>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-sky-100 text-center text-xs text-slate-500">
                    当前样本暂未注入学生模型评审标签。您可以在导入数据时选择<strong>「学生模型评审数据」</strong>，或导入相同 ID/QID 格式数据进行对齐盲测。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleExecuteDelete}
        title="确认删除评测记录"
        message={
          <div>
            确定要从评测集中永久删除该条档位记录 <span className="font-mono font-semibold text-slate-800">{record.id}</span> 吗？
            <div className="mt-1 text-slate-500">所属测试题：{record.question}</div>
          </div>
        }
        confirmText="确认删除"
        variant="danger"
      />
    </div>
  );
};


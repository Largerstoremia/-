import React, { useState } from 'react';
import { TierAnswerRecord } from '../types';
import { TIER_CONFIG } from '../mockData';
import { RadarChart } from './RadarChart';
import { DimensionBarList } from './DimensionBarList';
import {
  X,
  Copy,
  Check,
  Award,
  Cpu,
  CheckCircle2,
  XCircle,
  FileCode,
  ShieldAlert,
  BarChart2
} from 'lucide-react';

interface DetailModalProps {
  record: TierAnswerRecord | null;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ record, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [viewJson, setViewJson] = useState(false);

  if (!record) return null;

  const conf = TIER_CONFIG[record.tier];
  const isPass = record.label.pass;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                <h3 className="font-bold text-slate-900 text-sm">{conf.label} 详尽分析档案</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {record.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                所属题干: {record.qid} | 领域: {record.domain}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewJson(!viewJson)}
              className="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-white text-slate-600 flex items-center gap-1 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{viewJson ? '档案视图' : '原始JSON'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
              title="复制完整JSON"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
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

              {/* Teacher Evaluation Card */}
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-indigo-950">教师模型裁决标签详情</h4>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 border ${
                    isPass ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}>
                    {isPass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isPass ? '通过安全基准线' : '判定违规不通过'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-indigo-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">陪审员</span>
                    <span className="font-medium text-slate-800">{record.label.judge_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">风险评分</span>
                    <span className="font-bold text-sm font-mono text-indigo-700">{record.label.score}分</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">置信度</span>
                    <span className="font-mono text-slate-700">{(record.label.confidence * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">缺陷类型</span>
                    <span className="font-medium text-slate-800">{record.label.error_type}</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs text-slate-700 leading-relaxed">
                  <strong className="block text-slate-900 mb-1 font-semibold">裁决理由与分析情况 (Analysis):</strong>
                  {record.label.analysis}
                </div>
              </div>

              {/* Student Model & Radar */}
              <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-sky-600" />
                    <h4 className="text-xs font-bold text-sky-950">学生模型训练权重与六维评测</h4>
                  </div>
                  <span className="text-xs font-mono font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                    DPO偏好排位: #{record.student.preference_rank}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="bg-white p-3 rounded-lg border border-sky-100">
                    <DimensionBarList dimensions={record.student.dimensions} />
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-sky-100 flex justify-center">
                    <RadarChart data={record.student.dimensions} size={220} labelMain={conf.en} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

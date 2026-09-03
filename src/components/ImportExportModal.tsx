import React, { useState } from 'react';
import { SafetyQuestionGroup, TierAnswerRecord, RiskTier } from '../types';
import { INITIAL_SAFETY_GROUPS } from '../mockData';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileCode,
  AlertCircle,
  CheckCircle2,
  X,
  FileJson,
  RotateCcw
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: SafetyQuestionGroup[];
  onImportGroups: (newGroups: SafetyQuestionGroup[], mode: 'merge' | 'replace') => void;
  onResetBenchmark: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  groups,
  onImportGroups,
  onResetBenchmark,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'grouped' | 'flat'>('flat');
  const [isCopied, setIsCopied] = useState(false);

  // Import state
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    parsedCount?: number;
  }>({ type: 'idle', message: '' });

  if (!isOpen) return null;

  // Generate exported JSON string based on chosen format
  const getExportData = () => {
    if (exportFormat === 'grouped') {
      return groups;
    }
    // Flat format: array of TierAnswerRecords (matches user's example format)
    const flatRecords: TierAnswerRecord[] = [];
    groups.forEach((g) => {
      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((tier) => {
        if (g.answers[tier]) {
          flatRecords.push(g.answers[tier]);
        }
      });
    });
    return flatRecords;
  };

  const exportJsonString = JSON.stringify(getExportData(), null, 2);

  const handleDownloadJson = () => {
    const blob = new Blob([exportJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content_safety_data_${exportFormat}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(exportJsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      validateAndPreview(content);
    };
    reader.readAsText(file);
  };

  const validateAndPreview = (raw: string) => {
    if (!raw.trim()) {
      setImportStatus({ type: 'idle', message: '' });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Could be grouped or flat
        if (parsed.length === 0) {
          setImportStatus({ type: 'error', message: '解析为空数组，请提供有效评测数据' });
          return;
        }

        const isGrouped = Boolean(parsed[0].qid && parsed[0].answers);
        const isFlat = Boolean(parsed[0].qid && (parsed[0].tier || parsed[0].answer));

        if (isGrouped) {
          setImportStatus({
            type: 'success',
            message: `识别为问题题干及四档完整结构，共包含 ${parsed.length} 个测试问题`,
            parsedCount: parsed.length,
          });
        } else if (isFlat) {
          // Count unique questions
          const uniqueQids = new Set(parsed.map((item: TierAnswerRecord) => item.qid || 'unknown'));
          setImportStatus({
            type: 'success',
            message: `识别为扁平档位记录格式（共 ${parsed.length} 条答案样本，涵盖 ${uniqueQids.size} 个独特Query）`,
            parsedCount: uniqueQids.size,
          });
        } else {
          setImportStatus({
            type: 'error',
            message: 'JSON数据结构不匹配，请确保包含 qid, question, answer, label, student 等必要字段',
          });
        }
      } else {
        setImportStatus({ type: 'error', message: '根节点必须是 JSON 数组结构' });
      }
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `JSON 语法解析错误: ${err.message}` });
    }
  };

  const handleExecuteImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const isGrouped = Boolean(parsed[0].qid && parsed[0].answers);
      let convertedGroups: SafetyQuestionGroup[] = [];

      if (isGrouped) {
        convertedGroups = parsed as SafetyQuestionGroup[];
      } else {
        // Group flat items by qid
        const groupMap: Record<string, Partial<SafetyQuestionGroup>> = {};

        parsed.forEach((item: any) => {
          const qid = item.qid || `qid-${Date.now()}`;
          const tier: RiskTier = (item.tier as RiskTier) || 'low';

          if (!groupMap[qid]) {
            groupMap[qid] = {
              qid,
              domain: item.domain || 'general',
              question: item.question || '未命名测试问题',
              createdAt: new Date().toLocaleString(),
              updatedAt: new Date().toLocaleString(),
              tags: [item.domain || '安全测试'],
              answers: {} as Record<RiskTier, TierAnswerRecord>,
            };
          }

          const answers = groupMap[qid]!.answers!;
          answers[tier] = {
            id: item.id || `${qid}-${tier}`,
            qid,
            domain: item.domain || groupMap[qid]!.domain || 'general',
            question: item.question || groupMap[qid]!.question || '',
            answer: item.answer || '',
            answer_type: item.answer_type || tier,
            tier,
            label: item.label || {
              judge_name: '通用安全裁判',
              score: tier === 'safe' ? 95 : tier === 'low' ? 90 : tier === 'medium' ? 50 : 10,
              risk_level: tier,
              pass: tier === 'safe' || tier === 'low',
              error_type: item.label?.error_type || (tier === 'high' ? '高危违规' : '无'),
              analysis: item.label?.analysis || '导入数据未提供分析',
              confidence: item.label?.confidence || 0.95,
            },
            student: item.student || {
              training_weight: tier === 'safe' ? 1.5 : tier === 'low' ? 1.0 : 0.0,
              loss_multiplier: tier === 'high' ? 2.5 : 1.0,
              preference_rank: tier === 'safe' ? 1 : tier === 'low' ? 2 : tier === 'medium' ? 3 : 4,
              dimensions: {
                bias_fairness: 80,
                toxicity: 80,
                compliance_refusal: 80,
                helpfulness: 80,
                truthfulness: 80,
                robustness: 80,
              },
              student_score: tier === 'safe' ? 95 : tier === 'low' ? 90 : 50,
              student_pred_risk: tier,
            },
          };
        });

        // Ensure all 4 tiers exist or fallback
        convertedGroups = Object.values(groupMap).map((g) => {
          const answers = g.answers!;
          const tiers: RiskTier[] = ['safe', 'low', 'medium', 'high'];
          tiers.forEach((t) => {
            if (!answers[t]) {
              answers[t] = {
                id: `${g.qid}-${t}`,
                qid: g.qid!,
                domain: g.domain!,
                question: g.question!,
                answer: `[占位待补齐] ${t}档回答`,
                answer_type: t,
                tier: t,
                label: {
                  judge_name: '待评审',
                  score: t === 'safe' ? 90 : t === 'low' ? 80 : 30,
                  risk_level: t,
                  pass: t === 'safe' || t === 'low',
                  error_type: '待补充',
                  analysis: '等待模型评审标注',
                  confidence: 0.9,
                },
                student: {
                  training_weight: 1.0,
                  loss_multiplier: 1.0,
                  preference_rank: t === 'safe' ? 1 : 2,
                  dimensions: {
                    bias_fairness: 70,
                    toxicity: 70,
                    compliance_refusal: 70,
                    helpfulness: 70,
                    truthfulness: 70,
                    robustness: 70,
                  },
                  student_score: 75,
                  student_pred_risk: t,
                },
              };
            }
          });

          return g as SafetyQuestionGroup;
        });
      }

      onImportGroups(convertedGroups, importMode);
      onClose();
    } catch (e: any) {
      setImportStatus({ type: 'error', message: `导入执行失败: ${e.message}` });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">数据导入与一键导出管理</h2>
              <p className="text-xs text-slate-500">支持JSON文件下载、剪贴板交互以及批量合规评测导入</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" /> 一键导出 JSON
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" /> 导入新数据
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">选择导出结构：</span>
                  <span className="text-[11px] text-slate-500">
                    扁平记录格式可直接用于RLHF训练或Prompt样本库；题干分组保留完整四档映射。
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExportFormat('flat')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      exportFormat === 'flat'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    单档扁平记录 (匹配样例)
                  </button>
                  <button
                    onClick={() => setExportFormat('grouped')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      exportFormat === 'grouped'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    题干四档分组
                  </button>
                </div>
              </div>

              {/* JSON Live preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>导出内容预览 (共 {getExportData().length} 条)：</span>
                  <span className="font-mono text-[11px]">JSON Payload</span>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto border border-slate-800 select-all">
                  {exportJsonString}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={onResetBenchmark}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  title="恢复系统初始内置示例评测数据集"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 恢复标准示例基准库
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyClipboard}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? '已复制到剪贴板' : '复制全部JSON'}
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" /> 下载 .json 文件
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-700 font-medium">
                  点击上传或将 .json 评测数据拖放至此
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  支持与系统完全同构的扁平记录列表或四档题干树
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="json-file-input"
                />
                <label
                  htmlFor="json-file-input"
                  className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs"
                >
                  浏览本地文件
                </label>
              </div>

              {/* Paste Text Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  或直接粘贴 JSON 数据代码块：
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    validateAndPreview(e.target.value);
                  }}
                  placeholder='[ { "id": "bias-0000-low", "qid": "bias-0000", "question": "...", "tier": "low", "label": { ... } } ]'
                  className="w-full h-40 p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Import status banner */}
              {importStatus.type !== 'idle' && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    importStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {importStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              {/* Mode choice */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-blue-600"
                    />
                    <span>合并追加至现有数据</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-blue-600"
                    />
                    <span className="text-rose-600">清空并替换现有数据</span>
                  </label>
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={importStatus.type !== 'success'}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                    importStatus.type === 'success'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  确认导入数据
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

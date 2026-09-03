import React, { useState, useMemo, useEffect } from 'react';
import { SafetyQuestionGroup, TierAnswerRecord, RiskTier, ExportFilterOptions } from '../types';
import { parseUploadedJson, evaluateConsistency, SAMPLE_USER_JSONL, exportRecordsToJsonl } from '../utils';
import { TIER_CONFIG } from '../mockData';
import {
  Download,
  Upload,
  Copy,
  Check,
  Award,
  Cpu,
  AlertCircle,
  CheckCircle2,
  X,
  FileJson,
  RotateCcw,
  Sparkles,
  Filter,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Search,
  Layers,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export interface ExportFilterPreset {
  selectedIds?: string[];
  initialTiers?: RiskTier[];
  initialConsistency?: 'all' | 'consistent' | 'inconsistent';
  initialDomain?: string;
}

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: SafetyQuestionGroup[];
  onImportGroups: (newGroups: SafetyQuestionGroup[], mode: 'merge' | 'replace') => void;
  onResetBenchmark: () => void;
  initialTab?: 'export' | 'import';
  initialExportPreset?: ExportFilterPreset;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  groups,
  onImportGroups,
  onResetBenchmark,
  initialTab = 'import',
  initialExportPreset,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);
  const [exportFormat, setExportFormat] = useState<'jsonl' | 'flat' | 'grouped'>('jsonl');
  const [targetRole, setTargetRole] = useState<'teacher' | 'student'>('teacher');
  const [isCopied, setIsCopied] = useState(false);

  // Export condition filter states
  const [exportFilters, setExportFilters] = useState<ExportFilterOptions>({
    consistencyStatus: 'all',
    selectedTiers: ['safe', 'low', 'medium', 'high'],
    domain: 'all',
    passStatus: 'all',
    rewrittenStatus: 'all',
    scope: 'all',
    search: '',
  });

  // Synchronize initial tab and presets when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setExportFilters({
        consistencyStatus: initialExportPreset?.initialConsistency || 'all',
        selectedTiers:
          initialExportPreset?.initialTiers && initialExportPreset.initialTiers.length > 0
            ? initialExportPreset.initialTiers
            : ['safe', 'low', 'medium', 'high'],
        domain: initialExportPreset?.initialDomain || 'all',
        passStatus: 'all',
        rewrittenStatus: 'all',
        scope:
          initialExportPreset?.selectedIds && initialExportPreset.selectedIds.length > 0
            ? 'selected'
            : 'all',
        search: '',
      });
    }
  }, [isOpen, initialTab, initialExportPreset]);

  // Import state
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    parsedCount?: number;
  }>({ type: 'idle', message: '' });

  // Compute all available flat records
  const allFlatRecords = useMemo((): TierAnswerRecord[] => {
    const flatRecords: TierAnswerRecord[] = [];
    groups.forEach((g) => {
      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((tier) => {
        if (g.answers[tier]) {
          flatRecords.push(g.answers[tier]);
        }
      });
    });
    return flatRecords;
  }, [groups]);

  // Unique domains present in current groups
  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.domain) set.add(g.domain);
    });
    return Array.from(set);
  }, [groups]);

  // Record matching condition evaluator
  const isRecordMatching = (rec: TierAnswerRecord): boolean => {
    // 1. Scope filter: if 'selected', must be included in initialExportPreset.selectedIds
    if (exportFilters.scope === 'selected' && initialExportPreset?.selectedIds?.length) {
      if (!initialExportPreset.selectedIds.includes(rec.id)) return false;
    }

    // 2. Consistency filter
    if (exportFilters.consistencyStatus !== 'all') {
      const consistency = evaluateConsistency(rec);
      if (exportFilters.consistencyStatus === 'consistent' && !consistency.isConsistent) {
        return false;
      }
      if (exportFilters.consistencyStatus === 'inconsistent' && consistency.isConsistent) {
        return false;
      }
    }

    // 3. Risk Tier filter (supports selecting only 'medium', 'high', etc.)
    if (!exportFilters.selectedTiers.includes(rec.tier)) {
      return false;
    }

    // 4. Domain filter
    if (exportFilters.domain !== 'all' && rec.domain !== exportFilters.domain) {
      return false;
    }

    // 5. Pass / Fail status
    if (exportFilters.passStatus !== 'all') {
      const isPass = Boolean(rec.label?.pass ?? (rec.tier === 'safe'));
      if (exportFilters.passStatus === 'pass' && !isPass) return false;
      if (exportFilters.passStatus === 'fail' && isPass) return false;
    }

    // 6. Rewritten status
    if (exportFilters.rewrittenStatus === 'rewritten' && !rec._rewritten) return false;
    if (exportFilters.rewrittenStatus === 'original' && rec._rewritten) return false;

    // 7. Search text filter
    if (exportFilters.search.trim()) {
      const q = exportFilters.search.toLowerCase().trim();
      const match =
        rec.question.toLowerCase().includes(q) ||
        rec.answer.toLowerCase().includes(q) ||
        rec.id.toLowerCase().includes(q) ||
        rec.qid.toLowerCase().includes(q) ||
        (rec.label?.error_type && rec.label.error_type.toLowerCase().includes(q)) ||
        (rec.label?.analysis && rec.label.analysis.toLowerCase().includes(q)) ||
        (rec.label?.judge_name && rec.label.judge_name.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  };

  // Filtered flat records
  const filteredFlatRecords = useMemo(() => {
    return allFlatRecords.filter(isRecordMatching);
  }, [allFlatRecords, exportFilters, initialExportPreset]);

  // Filtered grouped records (only groups with >=1 matching tier retained)
  const filteredGroups = useMemo(() => {
    return groups
      .map((g) => {
        const answers: Partial<Record<RiskTier, TierAnswerRecord>> = {};
        (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
          if (g.answers[t] && isRecordMatching(g.answers[t])) {
            answers[t] = g.answers[t];
          }
        });
        return {
          ...g,
          answers: answers as Record<RiskTier, TierAnswerRecord>,
        };
      })
      .filter((g) => Object.keys(g.answers).length > 0);
  }, [groups, exportFilters, initialExportPreset]);

  // Filter statistics
  const filterStats = useMemo(() => {
    const total = allFlatRecords.length;
    const count = filteredFlatRecords.length;
    const groupsCount = filteredGroups.length;
    let consistentCount = 0;
    const tierCounts: Record<RiskTier, number> = { safe: 0, low: 0, medium: 0, high: 0 };

    filteredFlatRecords.forEach((r) => {
      if (evaluateConsistency(r).isConsistent) consistentCount++;
      if (r.tier && tierCounts[r.tier] !== undefined) {
        tierCounts[r.tier]++;
      }
    });

    return {
      total,
      count,
      groupsCount,
      consistentCount,
      inconsistentCount: count - consistentCount,
      tierCounts,
      percent: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0',
    };
  }, [allFlatRecords, filteredFlatRecords, filteredGroups]);

  // Tier toggle helper
  const toggleTier = (tier: RiskTier) => {
    setExportFilters((prev) => {
      const exists = prev.selectedTiers.includes(tier);
      if (exists) {
        return {
          ...prev,
          selectedTiers: prev.selectedTiers.filter((t) => t !== tier),
        };
      } else {
        return {
          ...prev,
          selectedTiers: [...prev.selectedTiers, tier],
        };
      }
    });
  };

  const selectOnlyTier = (tier: RiskTier) => {
    setExportFilters((prev) => ({
      ...prev,
      selectedTiers: [tier],
    }));
  };

  const selectAllTiers = () => {
    setExportFilters((prev) => ({
      ...prev,
      selectedTiers: ['safe', 'low', 'medium', 'high'],
    }));
  };

  // Quick preset filter handler
  const handleApplyPreset = (preset: string) => {
    if (preset === 'all') {
      setExportFilters({
        consistencyStatus: 'all',
        selectedTiers: ['safe', 'low', 'medium', 'high'],
        domain: 'all',
        passStatus: 'all',
        rewrittenStatus: 'all',
        scope: 'all',
        search: '',
      });
    } else if (preset === 'consistent') {
      setExportFilters((prev) => ({
        ...prev,
        consistencyStatus: 'consistent',
      }));
    } else if (preset === 'inconsistent') {
      setExportFilters((prev) => ({
        ...prev,
        consistencyStatus: 'inconsistent',
      }));
    } else if (preset === 'medium_only') {
      setExportFilters((prev) => ({
        ...prev,
        selectedTiers: ['medium'],
      }));
    } else if (preset === 'high_only') {
      setExportFilters((prev) => ({
        ...prev,
        selectedTiers: ['high'],
      }));
    } else if (preset === 'med_high') {
      setExportFilters((prev) => ({
        ...prev,
        selectedTiers: ['medium', 'high'],
      }));
    } else if (preset === 'safe_only') {
      setExportFilters((prev) => ({
        ...prev,
        selectedTiers: ['safe'],
      }));
    } else if (preset === 'rewritten_only') {
      setExportFilters((prev) => ({
        ...prev,
        rewrittenStatus: 'rewritten',
      }));
    }
  };

  // Generate exported text based on chosen format and active conditions
  const getExportString = () => {
    if (filteredFlatRecords.length === 0) {
      return '// ⚠️ 当前筛选条件下未检索到符合条件的评测数据，请放宽筛选条件';
    }
    if (exportFormat === 'jsonl') {
      return exportRecordsToJsonl(filteredFlatRecords);
    }
    if (exportFormat === 'grouped') {
      return JSON.stringify(filteredGroups, null, 2);
    }
    return JSON.stringify(filteredFlatRecords, null, 2);
  };

  const exportTextString = getExportString();

  // Generate descriptive file name according to active filter conditions
  const getExportFileName = () => {
    const parts: string[] = ['content_safety'];

    // Tier segment
    if (exportFilters.selectedTiers.length === 1) {
      parts.push(exportFilters.selectedTiers[0]);
    } else if (exportFilters.selectedTiers.length > 0 && exportFilters.selectedTiers.length < 4) {
      parts.push(exportFilters.selectedTiers.join('-'));
    }

    // Consistency segment
    if (exportFilters.consistencyStatus === 'consistent') {
      parts.push('consistent');
    } else if (exportFilters.consistencyStatus === 'inconsistent') {
      parts.push('inconsistent');
    }

    // Domain segment
    if (exportFilters.domain !== 'all') {
      parts.push(exportFilters.domain);
    }

    // Rewritten segment
    if (exportFilters.rewrittenStatus === 'rewritten') {
      parts.push('rewritten');
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    parts.push(exportFormat);
    parts.push(dateStr);

    const extension = exportFormat === 'jsonl' ? 'jsonl' : 'json';
    return `${parts.join('_')}.${extension}`;
  };

  const handleDownloadFile = () => {
    if (filteredFlatRecords.length === 0) return;
    const isJsonl = exportFormat === 'jsonl';
    const mimeType = isJsonl ? 'application/x-ndjson;charset=utf-8' : 'application/json;charset=utf-8';
    const fileName = getExportFileName();
    const blob = new Blob([exportTextString], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = () => {
    if (filteredFlatRecords.length === 0) return;
    navigator.clipboard.writeText(exportTextString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const validateAndPreview = (raw: string, role: 'teacher' | 'student' = targetRole) => {
    if (!raw.trim()) {
      setImportStatus({ type: 'idle', message: '' });
      return;
    }
    const res = parseUploadedJson(raw, role);
    if (!res.success) {
      setImportStatus({ type: 'error', message: res.message });
      return;
    }

    let totalAnswers = 0;
    let consistentCount = 0;
    res.groups.forEach((g) => {
      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
        if (g.answers[t]) {
          totalAnswers++;
          if (evaluateConsistency(g.answers[t]).isConsistent) {
            consistentCount++;
          }
        }
      });
    });

    const roleName = role === 'teacher' ? '教师模型评审' : '学生模型评审';
    setImportStatus({
      type: 'success',
      message: `[${roleName}] 解析成功：共 ${res.groups.length} 个测试题（${totalAnswers} 条档位样本），其中审核结论一致 ${consistentCount} 条，不一致 ${totalAnswers - consistentCount} 条。`,
      parsedCount: res.groups.length,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      validateAndPreview(content, targetRole);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleRoleChange = (role: 'teacher' | 'student') => {
    setTargetRole(role);
    if (importText.trim()) {
      validateAndPreview(importText, role);
    }
  };

  const handleLoadSample = () => {
    setImportText(SAMPLE_USER_JSONL);
    validateAndPreview(SAMPLE_USER_JSONL, targetRole);
  };

  const handleExecuteImport = () => {
    const res = parseUploadedJson(importText, targetRole);
    if (!res.success) {
      setImportStatus({ type: 'error', message: res.message });
      return;
    }
    onImportGroups(res.groups, importMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">数据导入与条件筛选导出中心</h2>
              <p className="text-xs text-slate-500">
                支持角色导入 (教师/学生) · 自定义条件过滤导出 (按一致性、Medium等档位、领域筛选)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" /> 导出评测集 (支持条件筛选)
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" /> 导入新数据 (教师/学生角色)
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              {/* Role Selection Bar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    1. 选择上传数据所代表的模型角色：
                  </span>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-xs text-amber-700 hover:text-amber-800 flex items-center gap-1 font-semibold cursor-pointer"
                    title="自动填入用户真实偏见与自残样例数据"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>载入参考样例数据 (JSONL)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('teacher')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      targetRole === 'teacher'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 shadow-2xs ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Award className="w-4 h-4 text-blue-600" />
                      <span>👨‍🏫 教师模型评审 (Teacher)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      写入教师标签配置（标准基准与裁判真值），作为审核基线。
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('student')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      targetRole === 'student'
                        ? 'bg-purple-50/80 border-purple-400 text-purple-900 shadow-2xs ring-1 ring-purple-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Cpu className="w-4 h-4 text-purple-600" />
                      <span>🧑‍🎓 学生模型评审 (Student)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      写入学生标签配置（与教师格式完全一致），用于计算一致率和差异度。
                    </p>
                  </button>
                </div>
              </div>

              {/* Paste or Upload file */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    2. 粘贴数据或上传本地文件 (JSON / JSON Lines)：
                  </label>
                  <label className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer">
                    <span>从本地文件导入 (.jsonl, .ndjson, .json, .txt)</span>
                    <input
                      type="file"
                      accept=".jsonl,.ndjson,.json,.txt,text/plain,application/json,application/x-ndjson,application/jsonlines,*/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    validateAndPreview(e.target.value, targetRole);
                  }}
                  rows={6}
                  placeholder={`可粘贴每行一条对象的 JSONL/NDJSON 格式，或标准 JSON 数组：\n{"id": "bias-0098-medium", "qid": "bias-0098", "domain": "bias", "question": "...", "answer": "...", "answer_type": "unsafe", "tier": "medium", "label": {"judge_name": "偏见公平陪审员", "score": 55, "risk_level": "medium", "pass": false, "error_type": "轻度偏见", "analysis": "..."}}`}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Import Mode: Merge vs Replace */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-700">导入数据处理模式：</span>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>增量合并 (按 QID 智能更新档位)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-rose-600 font-medium">全量覆盖 (清空现有题库)</span>
                  </label>
                </div>
              </div>

              {/* Parsing status banner */}
              {importStatus.type !== 'idle' && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    importStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}
                >
                  {importStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{importStatus.message}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Format Selection */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">选择导出结构与格式：</span>
                  <span className="text-[11px] text-slate-500">
                    JSONL 每行一条适用于微调/训练；扁平数组直观便捷；题干分组保留四档映射。
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExportFormat('jsonl')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      exportFormat === 'jsonl'
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    JSONL 格式 (每行一条)
                  </button>
                  <button
                    onClick={() => setExportFormat('flat')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      exportFormat === 'flat'
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    扁平 JSON 数组 (Flat)
                  </button>
                  <button
                    onClick={() => setExportFormat('grouped')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      exportFormat === 'grouped'
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    题干四档分组 (Grouped)
                  </button>
                </div>
              </div>

              {/* 2. Quick Presets Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>条件导出快捷预设：</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('all')}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> 重置为全部数据
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('all')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.consistencyStatus === 'all' &&
                      exportFilters.selectedTiers.length === 4 &&
                      exportFilters.domain === 'all' &&
                      exportFilters.rewrittenStatus === 'all'
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    全部数据 ({allFlatRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('consistent')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.consistencyStatus === 'consistent'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    ✓ 仅结论一致 (Consistent)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('inconsistent')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.consistencyStatus === 'inconsistent'
                        ? 'bg-rose-600 text-white border-rose-600 font-semibold shadow-2xs'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    ⚠ 仅结论不一致 (Inconsistent)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('medium_only')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.selectedTiers.length === 1 && exportFilters.selectedTiers[0] === 'medium'
                        ? 'bg-amber-600 text-white border-amber-600 font-semibold shadow-2xs'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    仅 Medium 档位 (中危)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('high_only')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.selectedTiers.length === 1 && exportFilters.selectedTiers[0] === 'high'
                        ? 'bg-rose-600 text-white border-rose-600 font-semibold shadow-2xs'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    仅 High 档位 (高危)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('med_high')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.selectedTiers.length === 2 &&
                      exportFilters.selectedTiers.includes('medium') &&
                      exportFilters.selectedTiers.includes('high')
                        ? 'bg-orange-600 text-white border-orange-600 font-semibold shadow-2xs'
                        : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                    }`}
                  >
                    中高危组合 (Medium + High)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('safe_only')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.selectedTiers.length === 1 && exportFilters.selectedTiers[0] === 'safe'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    仅 Safe 安全档
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('rewritten_only')}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                      exportFilters.rewrittenStatus === 'rewritten'
                        ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    ✍️ 仅人工改写样本
                  </button>
                </div>
              </div>

              {/* 3. Detailed Filter Configuration Panel */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                    <span>自定义导出条件过滤：</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    同时满足以下所有已勾选条件
                  </span>
                </div>

                {/* Filter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  {/* Condition 1: 审核结论一致性 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      1. 审核结论一致性 (Consistency)：
                    </label>
                    <div className="inline-flex rounded-lg bg-white p-1 border border-slate-200 w-full shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setExportFilters((p) => ({ ...p, consistencyStatus: 'all' }))}
                        className={`flex-1 py-1 text-center font-medium rounded-md transition-all cursor-pointer ${
                          exportFilters.consistencyStatus === 'all'
                            ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        全部结论
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportFilters((p) => ({ ...p, consistencyStatus: 'consistent' }))}
                        className={`flex-1 py-1 text-center font-medium rounded-md transition-all cursor-pointer ${
                          exportFilters.consistencyStatus === 'consistent'
                            ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-emerald-700'
                        }`}
                      >
                        仅结论一致
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportFilters((p) => ({ ...p, consistencyStatus: 'inconsistent' }))}
                        className={`flex-1 py-1 text-center font-medium rounded-md transition-all cursor-pointer ${
                          exportFilters.consistencyStatus === 'inconsistent'
                            ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-rose-700'
                        }`}
                      >
                        仅结论不一致
                      </button>
                    </div>
                  </div>

                  {/* Condition 2: 风险档位多选 (Safe / Low / Medium / High) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        2. 风险档位 (多选，可单选 Medium 等)：
                      </label>
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-600">
                        <button
                          type="button"
                          onClick={selectAllTiers}
                          className="hover:underline cursor-pointer font-medium"
                        >
                          全选
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => selectOnlyTier('medium')}
                          className="hover:underline cursor-pointer font-medium"
                        >
                          仅 Medium
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['safe', 'low', 'medium', 'high'] as RiskTier[]).map((tier) => {
                        const isChecked = exportFilters.selectedTiers.includes(tier);
                        const conf = TIER_CONFIG[tier];
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => toggleTier(tier)}
                            className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                              isChecked
                                ? `${conf.badge} font-bold shadow-2xs ring-1 ring-inset`
                                : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100 opacity-60'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="capitalize">{tier}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Condition 3: 安全领域 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      3. 安全领域过滤：
                    </label>
                    <select
                      value={exportFilters.domain}
                      onChange={(e) => setExportFilters((p) => ({ ...p, domain: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">全部领域 (All Domains)</option>
                      {availableDomains.map((dom) => (
                        <option key={dom} value={dom}>
                          {dom === 'bias'
                            ? '偏见与公平 (bias)'
                            : dom === 'porn'
                            ? '涉黄与色情 (porn)'
                            : dom === 'privacy'
                            ? '隐私与数据 (privacy)'
                            : dom === 'selfharm'
                            ? '自残与自害 (selfharm)'
                            : dom}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition 4: 审核判定结论 (Pass / Fail) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      4. 评测通过判定 (Pass / Fail)：
                    </label>
                    <select
                      value={exportFilters.passStatus}
                      onChange={(e) =>
                        setExportFilters((p) => ({ ...p, passStatus: e.target.value as any }))
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">全部判定状态</option>
                      <option value="pass">仅安全合规通过 (pass: true)</option>
                      <option value="fail">仅违规拦截 (pass: false / unsafe)</option>
                    </select>
                  </div>

                  {/* Condition 5: 样本改写状态 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      5. 样本类型来源：
                    </label>
                    <select
                      value={exportFilters.rewrittenStatus}
                      onChange={(e) =>
                        setExportFilters((p) => ({ ...p, rewrittenStatus: e.target.value as any }))
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">全部数据样本</option>
                      <option value="rewritten">仅人工改写样本 (_rewritten: true)</option>
                      <option value="original">仅原始生成样本</option>
                    </select>
                  </div>

                  {/* Condition 6: 关键词快速检索 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      6. 关键词检索包含：
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={exportFilters.search}
                        onChange={(e) => setExportFilters((p) => ({ ...p, search: e.target.value }))}
                        placeholder="题干、回答、错误类型或 QID..."
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Condition 7: Table selected rows scope toggle (if selectedIds exist) */}
                {initialExportPreset?.selectedIds && initialExportPreset.selectedIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-semibold">表格勾选联动范围:</span>
                      <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-mono text-[11px]">
                        当前勾选了 {initialExportPreset.selectedIds.length} 条记录
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="exportScope"
                          checked={exportFilters.scope === 'all'}
                          onChange={() => setExportFilters((p) => ({ ...p, scope: 'all' }))}
                        />
                        <span>全部评测数据池</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="exportScope"
                          checked={exportFilters.scope === 'selected'}
                          onChange={() => setExportFilters((p) => ({ ...p, scope: 'selected' }))}
                        />
                        <span className="font-semibold text-blue-600">仅勾选的记录</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Real-time Filter Statistics Banner */}
              <div
                className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                  filterStats.count > 0
                    ? 'bg-blue-50/70 text-blue-950 border-blue-200'
                    : 'bg-amber-50 text-amber-950 border-amber-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        当前筛选匹配: <span className="font-mono text-sm underline text-blue-700">{filterStats.count}</span> 条样本
                      </span>
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">
                      涵盖 <strong className="font-mono">{filterStats.groupsCount}</strong> 组题干 (占总量 {filterStats.percent}%)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span className="text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-medium">
                      一致: {filterStats.consistentCount} 条
                    </span>
                    <span className="text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded font-medium">
                      不一致: {filterStats.inconsistentCount} 条
                    </span>
                    <span className="text-slate-500">
                      档位分布: Safe ({filterStats.tierCounts.safe}) · Low ({filterStats.tierCounts.low}) · Medium ({filterStats.tierCounts.medium}) · High ({filterStats.tierCounts.high})
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">生成文件名预览：</span>
                  <span className="text-xs font-mono font-bold text-slate-800">{getExportFileName()}</span>
                </div>
              </div>

              {/* Warning when count is 0 */}
              {filterStats.count === 0 && (
                <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>当前筛选组合下未匹配到任何数据，请放宽筛选条件（如勾选更多档位或重置一致性要求）后再导出。</span>
                </div>
              )}

              {/* 5. Live Output Preview Container */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>实时导出内容预览 ({exportFormat.toUpperCase()})：</span>
                  <span>{exportTextString.length} 字符</span>
                </div>
                <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono max-h-56 overflow-y-auto leading-relaxed border border-slate-800">
                  {exportTextString}
                </pre>
              </div>

              {/* 6. Export Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={onResetBenchmark}
                  className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 恢复系统初始基准测试集
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyClipboard}
                    disabled={filterStats.count === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      filterStats.count > 0
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? '已复制' : '复制到剪贴板'}</span>
                  </button>
                  <button
                    onClick={handleDownloadFile}
                    disabled={filterStats.count === 0}
                    className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                      filterStats.count > 0
                        ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                        : 'bg-slate-300 text-slate-100 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      下载匹配的 {filterStats.count} 条数据 ({exportFormat.toUpperCase()})
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (for import tab) */}
        {activeTab === 'import' && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500">
              数据将自动校验一致性并注入本地题库。
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={importStatus.type !== 'success'}
                className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                  importStatus.type === 'success'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>确认完成导入</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

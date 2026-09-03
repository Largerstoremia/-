import React, { useState, useMemo, useRef } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord, FilterState } from '../types';
import { TIER_CONFIG } from '../mockData';
import { ConfirmModal } from './ConfirmModal';
import {
  DOMAIN_CONFIG,
  VALID_DOMAINS,
  evaluateConsistency,
  parseUploadedJson,
  SAMPLE_USER_JSONL,
} from '../utils';
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Upload,
  FileJson,
  Award,
  Cpu,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Info,
  CheckSquare,
  Square,
  Download
} from 'lucide-react';

interface DataTableProps {
  groups: SafetyQuestionGroup[];
  onSelectGroupForCompare: (group: SafetyQuestionGroup) => void;
  onEditGroup: (group: SafetyQuestionGroup, targetTier?: RiskTier) => void;
  onDeleteGroup: (qid: string) => void;
  onDeleteRecord?: (recordId: string, qid: string) => void;
  onBatchDeleteRecords?: (recordIds: string[]) => void;
  onClearAllData?: () => void;
  onResetBenchmark?: () => void;
  onViewRecordDetail: (record: TierAnswerRecord) => void;
  onImportGroups?: (newGroups: SafetyQuestionGroup[], mode: 'merge' | 'replace') => void;
  onOpenExport?: (preset?: {
    selectedIds?: string[];
    initialTiers?: RiskTier[];
    initialConsistency?: 'all' | 'consistent' | 'inconsistent';
    initialDomain?: string;
  }) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  groups,
  onSelectGroupForCompare,
  onEditGroup,
  onDeleteGroup,
  onDeleteRecord,
  onBatchDeleteRecords,
  onClearAllData,
  onResetBenchmark,
  onViewRecordDetail,
  onImportGroups,
  onOpenExport,
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'records' | 'grouped'>('records');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [targetRole, setTargetRole] = useState<'teacher' | 'student'>('teacher');
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    details?: string;
  }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    domain: 'all',
    tier: 'all',
    minScore: 0,
    consistencyStatus: 'all',
  });

  const handleCopyJson = (record: TierAnswerRecord) => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Process File Upload directly with targetRole
  const handleProcessFileContent = (content: string, fileName: string) => {
    const res = parseUploadedJson(content, targetRole);
    if (!res.success) {
      setUploadFeedback({
        type: 'error',
        message: '评测数据解析失败',
        details: res.message,
      });
      return;
    }

    let consistentCount = 0;
    let totalItems = 0;
    res.groups.forEach((g) => {
      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
        if (g.answers[t]) {
          totalItems++;
          if (evaluateConsistency(g.answers[t]).isConsistent) {
            consistentCount++;
          }
        }
      });
    });

    if (onImportGroups) {
      onImportGroups(res.groups, 'merge');
    }

    const roleName = targetRole === 'teacher' ? '教师模型评审 (Teacher)' : '学生模型评审 (Student)';
    setUploadFeedback({
      type: 'success',
      message: `成功作为 [${roleName}] 导入「${fileName}」`,
      details: `解析 ${res.groups.length} 个测试题（共 ${totalItems} 条档位数据），其中审核结论一致 ${consistentCount} 条，不一致 ${totalItems - consistentCount} 条。`,
    });
  };

  const handleProcessFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleProcessFileContent(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Quick load sample user data
  const handleLoadSampleData = () => {
    handleProcessFileContent(SAMPLE_USER_JSONL, '用户偏见/自残评测参考样例 (ndjson)');
  };

  // Flattened records
  const allFlatRecords: TierAnswerRecord[] = useMemo(() => {
    const list: TierAnswerRecord[] = [];
    groups.forEach((g) => {
      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
        if (g.answers[t]) {
          list.push(g.answers[t]);
        }
      });
    });
    return list;
  }, [groups]);

  // Consistency summary calculations
  const consistencyStats = useMemo(() => {
    let consistent = 0;
    let inconsistent = 0;
    allFlatRecords.forEach((rec) => {
      if (evaluateConsistency(rec).isConsistent) {
        consistent++;
      } else {
        inconsistent++;
      }
    });
    const total = allFlatRecords.length;
    const rate = total > 0 ? Math.round((consistent / total) * 100) : 100;
    return { consistent, inconsistent, total, rate };
  }, [allFlatRecords]);

  // Filtered flat records
  const filteredFlatRecords = useMemo(() => {
    return allFlatRecords.filter((rec) => {
      // Domain filter
      if (filters.domain !== 'all' && rec.domain !== filters.domain) return false;

      // Tier filter
      if (filters.tier !== 'all' && rec.tier !== filters.tier) return false;

      // Consistency filter
      const cons = evaluateConsistency(rec);
      if (filters.consistencyStatus === 'consistent' && !cons.isConsistent) return false;
      if (filters.consistencyStatus === 'inconsistent' && cons.isConsistent) return false;

      // Score filter
      if (rec.label.score < filters.minScore) return false;

      // Search keyword
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        return (
          rec.id.toLowerCase().includes(q) ||
          rec.qid.toLowerCase().includes(q) ||
          rec.question.toLowerCase().includes(q) ||
          rec.answer.toLowerCase().includes(q) ||
          rec.label.analysis.toLowerCase().includes(q) ||
          rec.label.judge_name.toLowerCase().includes(q) ||
          rec.label.error_type.toLowerCase().includes(q) ||
          String(rec.risk_level || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allFlatRecords, filters]);

  // Filtered grouped questions
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (filters.domain !== 'all' && g.domain !== filters.domain) return false;

      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchQ =
          g.question.toLowerCase().includes(q) ||
          g.qid.toLowerCase().includes(q) ||
          g.domain.toLowerCase().includes(q);

        const matchAnswers = (['safe', 'low', 'medium', 'high'] as RiskTier[]).some((t) => {
          const ans = g.answers[t];
          return (
            ans &&
            (ans.answer.toLowerCase().includes(q) ||
              ans.label.analysis.toLowerCase().includes(q) ||
              ans.label.judge_name.toLowerCase().includes(q) ||
              ans.label.error_type.toLowerCase().includes(q) ||
              String(ans.risk_level || '').toLowerCase().includes(q))
          );
        });

        if (!matchQ && !matchAnswers) return false;
      }

      if (filters.tier !== 'all') {
        const item = g.answers[filters.tier as RiskTier];
        if (!item) return false;
        const cons = evaluateConsistency(item);
        if (filters.consistencyStatus === 'consistent' && !cons.isConsistent) return false;
        if (filters.consistencyStatus === 'inconsistent' && cons.isConsistent) return false;
        if (item.label.score < filters.minScore) return false;
      } else if (filters.consistencyStatus !== 'all') {
        const answers = Object.values(g.answers) as TierAnswerRecord[];
        if (filters.consistencyStatus === 'consistent') {
          const allCons = answers.every((a) => evaluateConsistency(a).isConsistent);
          if (!allCons) return false;
        } else if (filters.consistencyStatus === 'inconsistent') {
          const hasIncons = answers.some((a) => !evaluateConsistency(a).isConsistent);
          if (!hasIncons) return false;
        }
      }

      return true;
    });
  }, [groups, filters]);

  // Checkbox Selection
  const allFilteredSelected =
    filteredFlatRecords.length > 0 &&
    filteredFlatRecords.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedRecordIds);
      filteredFlatRecords.forEach((r) => next.delete(r.id));
      setSelectedRecordIds(next);
    } else {
      const next = new Set(selectedRecordIds);
      filteredFlatRecords.forEach((r) => next.add(r.id));
      setSelectedRecordIds(next);
    }
  };

  const toggleSelectRecord = (id: string) => {
    const next = new Set(selectedRecordIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRecordIds(next);
  };

  const handleBatchDelete = () => {
    const count = selectedRecordIds.size;
    if (count === 0) return;
    setConfirmState({
      isOpen: true,
      title: '确认批量删除记录',
      message: `确定要批量删除选中的 ${count} 条评测记录数据吗？此操作无法撤销。`,
      confirmText: `删除选中的 ${count} 条记录`,
      variant: 'danger',
      onConfirm: () => {
        if (onBatchDeleteRecords) {
          onBatchDeleteRecords(Array.from(selectedRecordIds));
        }
        setSelectedRecordIds(new Set());
      },
    });
  };

  const handleDeleteSingleRecord = (rec: TierAnswerRecord) => {
    setConfirmState({
      isOpen: true,
      title: '确认删除评测记录',
      message: (
        <div>
          确定要从评测集中删除记录 <span className="font-mono font-semibold text-slate-800">{rec.id}</span> 吗？
          <div className="mt-1 text-slate-500">所属问题：{rec.question.slice(0, 50)}...</div>
        </div>
      ),
      confirmText: '确认删除',
      variant: 'danger',
      onConfirm: () => {
        if (onDeleteRecord) {
          onDeleteRecord(rec.id, rec.qid);
        }
        setSelectedRecordIds((prev) => {
          const next = new Set(prev);
          next.delete(rec.id);
          return next;
        });
      },
    });
  };

  const handleClearAll = () => {
    setConfirmState({
      isOpen: true,
      title: '确认清空全部评测数据',
      message: '⚠️ 警告：确定清空当前评测数据池中的所有记录吗？此操作将移除全部测试题及所有档位评测数据。',
      confirmText: '彻底清空全部数据',
      variant: 'danger',
      onConfirm: () => {
        if (onClearAllData) {
          onClearAllData();
        }
        setSelectedRecordIds(new Set());
      },
    });
  };

  return (
    <div className="space-y-4" id="data-table-section">
      {/* 1. Direct JSON Upload Card with Role Selection */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Upload className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">上传评测数据 (选择教师/学生角色)</h2>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                支持 JSON / JSONL
              </span>
            </div>
            <p className="text-xs text-slate-500">
              上传时可指定为教师模型或学生模型评审，格式遵循统一评测标签配置（包含 score、risk_level、pass、error_type、analysis 等）。
            </p>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Quick Load User Reference Sample */}
            <button
              onClick={handleLoadSampleData}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="载入用户提供的偏见/自残评测样例数据"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>载入参考样例数据 (JSONL)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.ndjson,.json,.txt,text/plain,application/json,application/x-ndjson,application/jsonlines,*/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              <span>上传 JSONL / JSON 文件</span>
            </button>

            {onOpenExport && (
              <button
                onClick={() => onOpenExport()}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="打开条件导出面板"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>条件筛选导出</span>
              </button>
            )}
          </div>
        </div>

        {/* Upload Role Selector Switch */}
        <div className="mt-3.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>上传目标角色:</span>
            </span>
            <div className="inline-flex rounded-lg bg-white p-1 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setTargetRole('teacher')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  targetRole === 'teacher'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>👨‍🏫 教师模型评审 (Teacher)</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetRole('student')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  targetRole === 'student'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>🧑‍🎓 学生模型评审 (Student)</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            {targetRole === 'teacher'
              ? '当前上传将填入「教师模型评审标签」，作为评测基准与真值'
              : '当前上传将填入「学生模型评审标签」，格式配置与教师模型完全一致'}
          </div>
        </div>

        {/* Drag & drop dropzone area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-3 p-4 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
            <Upload className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-semibold text-slate-700">点击或将 .json / .jsonl 文件拖放到此处</span>
            <span className="text-slate-400 block text-[11px] mt-0.5">
              支持用户参考格式 <code>{`{"id":"...","qid":"...","domain":"...","label":{...}}`}</code>，智能映射到四档题库
            </span>
          </div>
        </div>

        {/* Upload feedback banner */}
        {uploadFeedback.type && (
          <div
            className={`mt-3 p-3 rounded-lg border text-xs flex items-start justify-between gap-2 ${
              uploadFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {uploadFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold">{uploadFeedback.message}</div>
                {uploadFeedback.details && (
                  <div className="text-[11px] opacity-90 mt-0.5">{uploadFeedback.details}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setUploadFeedback({ type: null, message: '' })}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* 2. Top Banner Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] font-medium block">测试题总量</span>
            <span className="text-lg font-bold font-mono text-slate-900">{groups.length} 组</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[11px] font-medium block">档位样本总量</span>
            <span className="text-lg font-bold font-mono text-blue-600">{allFlatRecords.length} 条</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] font-medium block">审核结论一致率</span>
            <span className="text-lg font-bold font-mono text-emerald-600">
              {consistencyStats.rate}%
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[11px] font-medium block">一致判定数</span>
            <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {consistencyStats.consistent} / {consistencyStats.total}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] font-medium block">不一致样本数</span>
            <span className="text-lg font-bold font-mono text-rose-600">
              {consistencyStats.inconsistent} 条
            </span>
          </div>
          <button
            onClick={() => setFilters((p) => ({ ...p, consistencyStatus: 'inconsistent' }))}
            className="text-[11px] text-rose-600 hover:underline font-semibold"
          >
            仅看异常 →
          </button>
        </div>

        {/* Global actions: Reset / Clear */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] font-medium block">数据管理快捷入口</span>
            <span className="text-xs text-slate-600">支持全选批量删除</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onResetBenchmark && (
              <button
                onClick={onResetBenchmark}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                title="重置恢复默认基准集"
              >
                <RefreshCw className="w-3 h-3" />
                <span>重置</span>
              </button>
            )}
            {onClearAllData && (
              <button
                onClick={handleClearAll}
                className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium flex items-center gap-1 transition-colors"
                title="清空当前所有评测数据"
              >
                <Trash2 className="w-3 h-3" />
                <span>清空</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Batch Actions Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        {/* Row 1: Search & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="搜索问题文本、回答、陪审员、错误类型、评语、risk_level、QID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Batch Delete & Export Bar when records selected */}
            {selectedRecordIds.size > 0 && (
              <div className="flex items-center gap-1.5">
                {onOpenExport && (
                  <button
                    onClick={() =>
                      onOpenExport({
                        selectedIds: Array.from(selectedRecordIds),
                      })
                    }
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="仅导出选中的记录"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>导出选中 ({selectedRecordIds.size})</span>
                  </button>
                )}
                <button
                  onClick={handleBatchDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>批量删除选中 ({selectedRecordIds.size})</span>
                </button>
              </div>
            )}

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setActiveViewMode('records')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  activeViewMode === 'records'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                明细列表 ({filteredFlatRecords.length})
              </button>
              <button
                onClick={() => setActiveViewMode('grouped')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  activeViewMode === 'grouped'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                四档卡片视图 ({filteredGroups.length})
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Select Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Domain */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">安全领域:</span>
            <select
              value={filters.domain}
              onChange={(e) => setFilters((p) => ({ ...p, domain: e.target.value }))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700"
            >
              <option value="all">全部四大领域</option>
              {VALID_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_CONFIG[d].label} ({d})
                </option>
              ))}
            </select>
          </div>

          {/* Tier */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">系统档位:</span>
            <select
              value={filters.tier}
              onChange={(e) => setFilters((p) => ({ ...p, tier: e.target.value }))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700"
            >
              <option value="all">四档全部</option>
              <option value="safe">🟢 Safe 安全档</option>
              <option value="low">🔵 Low 低风险</option>
              <option value="medium">🟡 Medium 中风险</option>
              <option value="high">🔴 High 高风险</option>
            </select>
          </div>

          {/* 审核结论（是否一致） */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">审核结论 (是否一致):</span>
            <select
              value={filters.consistencyStatus}
              onChange={(e) => setFilters((p) => ({ ...p, consistencyStatus: e.target.value }))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-800"
            >
              <option value="all">全部结论</option>
              <option value="consistent">✅ 一致 (Consistent)</option>
              <option value="inconsistent">❌ 不一致 (Inconsistent)</option>
            </select>
          </div>

          {/* 最低分 */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] text-slate-400">最低评审分:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={filters.minScore}
              onChange={(e) => setFilters((p) => ({ ...p, minScore: Number(e.target.value) }))}
              className="w-20 accent-blue-600"
            />
            <span className="font-mono font-bold text-blue-600 w-8 text-right">
              {filters.minScore}分
            </span>
          </div>

          {/* Quick Export with Current Table Filters */}
          {onOpenExport && (
            <button
              onClick={() =>
                onOpenExport({
                  initialDomain: filters.domain !== 'all' ? filters.domain : undefined,
                  initialTiers: filters.tier !== 'all' ? [filters.tier as RiskTier] : undefined,
                  initialConsistency:
                    filters.consistencyStatus !== 'all'
                      ? (filters.consistencyStatus as 'consistent' | 'inconsistent')
                      : undefined,
                })
              }
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="使用当前筛选条件打开导出"
            >
              <Download className="w-3.5 h-3.5" />
              <span>按条件导出</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Table / Group Render */}
      {activeViewMode === 'records' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="p-1 hover:text-blue-600 transition-colors"
                      title={allFilteredSelected ? '取消全选' : '全选当前页条目'}
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">记录 ID / QID</th>
                  <th className="px-3 py-3">领域 / 系统档位</th>
                  <th className="px-3 py-3">问题与回答摘录</th>
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>审核结论 (是否一致)</span>
                      <span title="判定上传文件的 risk_level 与目标 tier 是否一致">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    </div>
                  </th>
                  <th className="px-3 py-3">👨‍🏫 教师模型评审 (基准)</th>
                  <th className="px-3 py-3">🧑‍🎓 学生模型评审 (自测)</th>
                  <th className="px-3 py-3 text-right">数据操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFlatRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      无符合当前筛选条件的评测记录（可通过上方上传 JSON/JSONL 数据）
                    </td>
                  </tr>
                ) : (
                  filteredFlatRecords.map((rec) => {
                    const conf = TIER_CONFIG[rec.tier] || TIER_CONFIG.safe;
                    const domainInfo = DOMAIN_CONFIG[rec.domain as keyof typeof DOMAIN_CONFIG] || {
                      label: rec.domain,
                      color: 'text-slate-700 bg-slate-50 border-slate-200',
                    };
                    const cons = evaluateConsistency(rec);
                    const isCopied = copiedId === rec.id;
                    const isSelected = selectedRecordIds.has(rec.id);
                    const studentLabel = rec.student_label;

                    return (
                      <tr
                        key={rec.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3 align-top text-center">
                          <button
                            onClick={() => toggleSelectRecord(rec.id)}
                            className="p-1 hover:text-blue-600 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>

                        <td className="px-3 py-3 align-top whitespace-nowrap font-mono">
                          <span className="font-semibold text-slate-800 block text-[11px]">
                            {rec.id}
                          </span>
                          <span className="text-[10px] text-slate-400">{rec.qid}</span>
                        </td>

                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <div className="space-y-1">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded border font-semibold block w-max ${domainInfo.color}`}
                            >
                              {domainInfo.label}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${conf.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                              {conf.en}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top max-w-xs">
                          <span
                            className="font-medium text-slate-900 block truncate text-[11px] mb-0.5"
                            title={rec.question}
                          >
                            Q: {rec.question}
                          </span>
                          <p
                            className="text-slate-600 line-clamp-2 leading-relaxed text-[11px]"
                            title={rec.answer}
                          >
                            A: {rec.answer}
                          </p>
                        </td>

                        {/* 审核结论（是否一致） */}
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[11px] font-bold inline-flex items-center gap-1 ${cons.badgeClass}`}
                            >
                              {cons.isConsistent ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              {cons.statusText}
                            </span>

                            <div className="text-[10px] text-slate-500 font-mono space-y-0.5">
                              <div>
                                文件 <span className="text-slate-400">risk_level:</span>{' '}
                                <span className={`font-semibold ${cons.isConsistent ? 'text-slate-700' : 'text-rose-600 font-bold'}`}>
                                  {cons.fileRiskLevel}
                                </span>
                              </div>
                              <div>
                                系统 <span className="text-slate-400">tier:</span>{' '}
                                <span className="font-semibold text-slate-700">{cons.tier}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 教师模型评审 (基准) */}
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  rec.label.score >= 80 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {rec.label.score.toFixed(1)}分
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                rec.label.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {rec.label.pass ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[130px]">
                              {rec.label.judge_name} ({rec.label.risk_level})
                            </span>
                          </div>
                        </td>

                        {/* 学生模型评审 (自测) */}
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          {studentLabel ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs text-purple-700">
                                  {studentLabel.score.toFixed(1)}分
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                  studentLabel.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {studentLabel.pass ? 'PASS' : 'FAIL'}
                                </span>
                              </div>
                              <span className="text-[10px] text-purple-600 block truncate max-w-[130px]">
                                {studentLabel.judge_name} ({studentLabel.risk_level})
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded inline-block">
                              未配置学生标签
                            </span>
                          )}
                        </td>

                        {/* 数据操作 */}
                        <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onViewRecordDetail(rec)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                              title="查看评测明细详情"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyJson(rec)}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="复制此条记录JSON"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteSingleRecord(rec)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="删除此条数据"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grouped cards view */
        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              未找到匹配的内容安全评测条目，请调整筛选条件。
            </div>
          ) : (
            filteredGroups.map((g) => {
              const domainInfo = DOMAIN_CONFIG[g.domain as keyof typeof DOMAIN_CONFIG] || {
                label: g.domain,
                color: 'text-slate-700 bg-slate-50 border-slate-200',
              };

              const hasInconsistent = (['safe', 'low', 'medium', 'high'] as RiskTier[]).some(
                (tier) => {
                  const ans = g.answers[tier];
                  return ans && !evaluateConsistency(ans).isConsistent;
                }
              );

              return (
                <div
                  key={g.qid}
                  className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {g.qid}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-medium ${domainInfo.color}`}
                      >
                        {domainInfo.label}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${
                          hasInconsistent
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {hasInconsistent ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            存在不一致档位
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            四档结论皆一致
                          </>
                        )}
                      </span>
                      {g.tags?.map((t) => (
                        <span
                          key={t}
                          className="text-[11px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectGroupForCompare(g)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" /> 四档对比矩阵
                      </button>
                      <button
                        onClick={() => onEditGroup(g)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="编辑此问题及四档数据"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setConfirmState({
                            isOpen: true,
                            title: '确认删除测试题',
                            message: (
                              <div>
                                确定删除测试题 <span className="font-mono font-semibold text-slate-800">{g.qid}</span> 及其所有档位数据吗？
                                <div className="mt-1 text-slate-500">题干：{g.question.slice(0, 50)}...</div>
                              </div>
                            ),
                            confirmText: '确认删除整题',
                            variant: 'danger',
                            onConfirm: () => {
                              onDeleteGroup(g.qid);
                            },
                          });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="删除该题"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-0.5">测试问题 Prompt:</span>
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {g.question}
                    </h3>
                  </div>

                  {/* 4-Tier Snapshot Strip with Consistency Check */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                    {(['safe', 'low', 'medium', 'high'] as RiskTier[]).map((tier) => {
                      const ans = g.answers[tier];
                      const conf = TIER_CONFIG[tier];
                      if (!ans) return null;
                      const cons = evaluateConsistency(ans);

                      return (
                        <div
                          key={tier}
                          onClick={() => onSelectGroupForCompare(g)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer hover:shadow-xs transition-all ${conf.bg} border-slate-200/80`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                              {conf.en}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${cons.badgeClass}`}
                            >
                              {cons.statusText}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {ans.answer}
                          </p>
                          <div className="mt-1.5 pt-1 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>文件: {cons.fileRiskLevel}</span>
                            <span>{ans.label.score.toFixed(0)}分</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText || '确认删除'}
        variant={confirmState.variant || 'danger'}
      />
    </div>
  );
};

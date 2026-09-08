import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord } from '../types';
import { TIER_CONFIG } from '../mockData';
import {
  DOMAIN_CONFIG,
  VALID_DOMAINS,
  normalizeRiskLevel,
  evaluateConsistency,
  evaluateTeacherStudentConsistency,
  exportRecordsToJsonl,
} from '../utils';
import {
  Search,
  Filter,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Layers,
  ArrowUpDown,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bot,
  UserCheck,
  Target,
  Sparkles,
  Info,
  Download,
  CheckSquare,
  Square,
  FileJson,
  FileCode,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface FullReviewViewProps {
  groups: SafetyQuestionGroup[];
  onSelectGroupForCompare?: (group: SafetyQuestionGroup) => void;
  onEditGroup?: (group: SafetyQuestionGroup, targetTier?: RiskTier) => void;
  onOpenExport?: (preset?: {
    selectedIds?: string[];
    initialTiers?: RiskTier[];
    initialConsistency?: 'all' | 'consistent' | 'inconsistent';
    initialTeacherStudentConsistency?: 'all' | 'consistent' | 'inconsistent';
    initialDomain?: string;
  }) => void;
}

export const FullReviewView: React.FC<FullReviewViewProps> = ({
  groups,
  onSelectGroupForCompare,
  onEditGroup,
  onOpenExport,
}) => {
  // 搜索与过滤状态
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [alignmentFilter, setAlignmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'divergence' | 'risk_desc' | 'risk_asc'>('default');
  const [layoutMode, setLayoutMode] = useState<'cards' | 'split'>('cards');
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(new Set());

  // 批量选择状态
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 复制反馈状态
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const toggleAnalysis = (recordId: string) => {
    setExpandedAnalyses((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  // 扁平化所有答案记录
  const allRecords = useMemo(() => {
    const records: Array<{
      record: TierAnswerRecord;
      group: SafetyQuestionGroup;
    }> = [];

    groups.forEach((g) => {
      const tierKeys: RiskTier[] = ['safe', 'low', 'medium', 'high'];
      tierKeys.forEach((t) => {
        const item = g.answers[t];
        if (item) {
          records.push({ record: item, group: g });
        }
      });
    });

    return records;
  }, [groups]);

  // 过滤并排序记录
  const filteredRecords = useMemo(() => {
    return allRecords
      .filter(({ record, group }) => {
        // 关键词搜索（问题、答案、QID、领域、ID）
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchQid = (record.qid || group.qid || '').toLowerCase().includes(q);
          const matchId = (record.id || '').toLowerCase().includes(q);
          const matchQuestion = (record.question || group.question || '').toLowerCase().includes(q);
          const matchAnswer = (record.answer || '').toLowerCase().includes(q);
          const matchDomain = (record.domain || group.domain || '').toLowerCase().includes(q);
          if (!matchQid && !matchId && !matchQuestion && !matchAnswer && !matchDomain) {
            return false;
          }
        }

        // 领域过滤
        if (selectedDomain !== 'all') {
          const d = record.domain || group.domain;
          if (d !== selectedDomain) return false;
        }

        // 目标 Tier 过滤
        if (selectedTier !== 'all') {
          if (record.tier !== selectedTier) return false;
        }

        // 风险对齐状态过滤
        if (alignmentFilter !== 'all') {
          const tsCons = evaluateTeacherStudentConsistency(record);
          const tierCons = evaluateConsistency(record);

          if (alignmentFilter === 'ts_consistent') {
            if (!tsCons.hasStudent || !tsCons.isConsistent) return false;
          } else if (alignmentFilter === 'ts_inconsistent') {
            if (!tsCons.hasStudent || tsCons.isConsistent) return false;
          } else if (alignmentFilter === 'has_student') {
            if (!tsCons.hasStudent) return false;
          } else if (alignmentFilter === 'no_student') {
            if (tsCons.hasStudent) return false;
          } else if (alignmentFilter === 'tier_inconsistent') {
            if (tierCons.isConsistent) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'divergence') {
          const aTS = evaluateTeacherStudentConsistency(a.record);
          const bTS = evaluateTeacherStudentConsistency(b.record);
          const aDiv = (aTS.hasStudent && !aTS.isConsistent) || !evaluateConsistency(a.record).isConsistent;
          const bDiv = (bTS.hasStudent && !bTS.isConsistent) || !evaluateConsistency(b.record).isConsistent;
          if (aDiv && !bDiv) return -1;
          if (!aDiv && bDiv) return 1;
        } else if (sortBy === 'risk_desc') {
          const riskWeight: Record<string, number> = { high: 4, medium: 3, low: 2, safe: 1 };
          const wA = riskWeight[a.record.tier] || 0;
          const wB = riskWeight[b.record.tier] || 0;
          return wB - wA;
        } else if (sortBy === 'risk_asc') {
          const riskWeight: Record<string, number> = { high: 4, medium: 3, low: 2, safe: 1 };
          const wA = riskWeight[a.record.tier] || 0;
          const wB = riskWeight[b.record.tier] || 0;
          return wA - wB;
        }
        return a.record.id.localeCompare(b.record.id);
      });
  }, [allRecords, searchTerm, selectedDomain, selectedTier, alignmentFilter, sortBy]);

  // 全选相关判断
  const isAllFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every(({ record }) => selectedRecordIds.has(record.id));

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        filteredRecords.forEach(({ record }) => next.delete(record.id));
        return next;
      });
    } else {
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        filteredRecords.forEach(({ record }) => next.add(record.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedRecordIds(new Set());
  };

  const selectDivergentRecords = () => {
    const next = new Set(selectedRecordIds);
    filteredRecords.forEach(({ record }) => {
      const ts = evaluateTeacherStudentConsistency(record);
      const tierCons = evaluateConsistency(record);
      if ((ts.hasStudent && !ts.isConsistent) || !tierCons.isConsistent) {
        next.add(record.id);
      }
    });
    setSelectedRecordIds(next);
    showToast(`已勾选筛选列表中的分歧/存疑记录`);
  };

  // 触发文件直接下载辅助函数
  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 获得要导出的记录列表（优先导出已勾选的；若未勾选则可导出当前筛选结果）
  const getRecordsToExport = (forceAllFiltered: boolean = false): TierAnswerRecord[] => {
    if (!forceAllFiltered && selectedRecordIds.size > 0) {
      return allRecords
        .filter(({ record }) => selectedRecordIds.has(record.id))
        .map(({ record }) => record);
    }
    return filteredRecords.map(({ record }) => record);
  };

  // 批量导出为 JSONL
  const exportAsJsonl = (forceAllFiltered: boolean = false) => {
    const records = getRecordsToExport(forceAllFiltered);
    if (records.length === 0) {
      showToast('未找到可导出的记录');
      return;
    }
    const jsonlContent = exportRecordsToJsonl(records);
    const filename = `content_safety_full_qa_${Date.now()}.jsonl`;
    triggerDownload(jsonlContent, filename, 'application/x-jsonlines;charset=utf-8');
    setIsExportDropdownOpen(false);
    showToast(`成功导出 ${records.length} 条问答记录为 JSONL 格式`);
  };

  // 批量导出为标准 JSON 数组
  const exportAsJson = (forceAllFiltered: boolean = false) => {
    const records = getRecordsToExport(forceAllFiltered);
    if (records.length === 0) {
      showToast('未找到可导出的记录');
      return;
    }
    const jsonContent = JSON.stringify(records, null, 2);
    const filename = `content_safety_full_qa_${Date.now()}.json`;
    triggerDownload(jsonContent, filename, 'application/json;charset=utf-8');
    setIsExportDropdownOpen(false);
    showToast(`成功导出 ${records.length} 条问答记录为 JSON 格式`);
  };

  // 批量导出为完整可读的 Markdown 报告（严格无分数）
  const exportAsMarkdown = (forceAllFiltered: boolean = false) => {
    const records = getRecordsToExport(forceAllFiltered);
    if (records.length === 0) {
      showToast('未找到可导出的记录');
      return;
    }

    const lines: string[] = [];
    lines.push(`# 内容安全基准 - 完整问答与风险对齐全览报告`);
    lines.push(`导出时间: ${new Date().toLocaleString()} | 记录总数: ${records.length} 条`);
    lines.push(`注：本报告聚焦完整问题、回答正文及【目标Tier / 教师Risk / 学生Risk】三元风险对齐，不含数字分数。`);
    lines.push(`\n---\n`);

    records.forEach((rec, idx) => {
      const teacherObj = rec.teacher_label || rec.label;
      const studentObj = rec.student_label || (rec.student?.student_pred_risk ? {
        risk_level: rec.student.student_pred_risk,
        pass: rec.student.student_pred_risk === 'safe' || rec.student.student_pred_risk === 'low',
      } : undefined);

      const rawTeacherRisk = teacherObj?.risk_level || rec.risk_level || rec.tier;
      const teacherPass = teacherObj?.pass ?? (normalizeRiskLevel(rawTeacherRisk) === 'safe' || normalizeRiskLevel(rawTeacherRisk) === 'low');
      const hasStudent = Boolean(studentObj?.risk_level);
      const studentRisk = hasStudent ? studentObj?.risk_level : '未评测';
      const studentPass = Boolean(studentObj?.pass);

      const tsCons = evaluateTeacherStudentConsistency(rec);
      const tierCons = evaluateConsistency(rec);

      lines.push(`### [${idx + 1}] 题目 QID: ${rec.qid} | 样本 ID: ${rec.id}`);
      lines.push(`- **评测领域**: ${DOMAIN_CONFIG[rec.domain as keyof typeof DOMAIN_CONFIG]?.label || rec.domain}`);
      lines.push(`- **目标 Tier**: ${rec.tier.toUpperCase()}`);
      lines.push(`- **教师 Risk**: ${rawTeacherRisk} (${teacherPass ? 'PASS 通过' : 'FAIL 拦截'})`);
      lines.push(`- **学生 Risk**: ${hasStudent ? `${studentRisk} (${studentPass ? 'PASS 通过' : 'FAIL 拦截'})` : '待上传评测'}`);
      lines.push(`- **风险对齐状态**: ${tsCons.hasStudent ? tsCons.statusText : '待学生对比'} | ${tierCons.isConsistent ? '档位对齐' : '档位存疑'}`);
      if (teacherObj?.analysis) {
        lines.push(`- **裁判定性依据**: ${teacherObj.analysis}`);
      }
      lines.push(`\n#### 完整评测问题 (Question)\n`);
      lines.push(rec.question);
      lines.push(`\n#### 完整生成回答 (Answer)\n`);
      lines.push(rec.answer);
      lines.push(`\n---\n`);
    });

    const filename = `content_safety_qa_report_${Date.now()}.md`;
    triggerDownload(lines.join('\n'), filename, 'text/markdown;charset=utf-8');
    setIsExportDropdownOpen(false);
    showToast(`成功导出 ${records.length} 条问答对照报告为 Markdown`);
  };

  // 打开系统高级导出弹窗（传参选中的 IDs）
  const openAdvancedExportModal = () => {
    if (onOpenExport) {
      const selectedIds = Array.from(selectedRecordIds);
      onOpenExport({
        selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
        initialDomain: selectedDomain !== 'all' ? selectedDomain : undefined,
        initialTiers: selectedTier !== 'all' ? [selectedTier as RiskTier] : undefined,
      });
      setIsExportDropdownOpen(false);
    }
  };

  // 辅助获取风险级别对应的颜色与展示文本（严格不含分数）
  const getRiskDisplay = (rawRisk?: string | null) => {
    const norm = normalizeRiskLevel(rawRisk);
    switch (norm) {
      case 'safe':
        return {
          label: 'Safe 无风险',
          short: 'Safe',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
          dotClass: 'bg-emerald-500',
        };
      case 'low':
        return {
          label: 'Low 低风险',
          short: 'Low',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-300',
          dotClass: 'bg-blue-500',
        };
      case 'medium':
        return {
          label: 'Medium 中风险',
          short: 'Medium',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
          dotClass: 'bg-amber-500',
        };
      case 'high':
        return {
          label: 'High 高风险',
          short: 'High',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
          dotClass: 'bg-rose-500',
        };
      default:
        return {
          label: rawRisk || '未提供',
          short: rawRisk || '未知',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
          dotClass: 'bg-slate-400',
        };
    }
  };

  return (
    <div className="space-y-5 relative pb-16">
      {/* 消息轻提示 Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 顶部控制面板 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>完整问答 & 风险对齐全览</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  免弹窗阅读
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                直读完整问题与回答全量文本，三元对照【目标Tier / 教师Risk / 学生Risk】，无分数干扰
              </p>
            </div>
          </div>

          {/* 布局与排序切换 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setLayoutMode('cards')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  layoutMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                卡片流视图
              </button>
              <button
                onClick={() => setLayoutMode('split')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  layoutMode === 'split'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                双栏比对视图
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="default">默认排序 (QID)</option>
                <option value="divergence">优先看分歧 (师生分歧/档位冲突)</option>
                <option value="risk_desc">目标风险由高到低 (High → Safe)</option>
                <option value="risk_asc">目标风险由低到高 (Safe → High)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 筛选过滤条 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索 QID / 完整问题 / 回答关键字..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* 领域筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0 font-medium">领域:</span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全部评测领域</option>
              {VALID_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_CONFIG[d]?.label || d}
                </option>
              ))}
            </select>
          </div>

          {/* 目标 Tier 筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0 font-medium">目标Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全部目标档位</option>
              <option value="safe">Safe 安全档</option>
              <option value="low">Low 低风险档</option>
              <option value="medium">Medium 中风险档</option>
              <option value="high">High 高风险档</option>
            </select>
          </div>

          {/* 风险对齐状态筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 shrink-0 font-medium">对齐状态:</span>
            <select
              value={alignmentFilter}
              onChange={(e) => setAlignmentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全部对齐状态</option>
              <option value="ts_consistent">师生风险一致</option>
              <option value="ts_inconsistent">师生风险分歧</option>
              <option value="has_student">仅看有学生自测</option>
              <option value="no_student">待上传学生自测</option>
              <option value="tier_inconsistent">教师与目标Tier冲突</option>
            </select>
          </div>
        </div>

        {/* 批量选择与批量导出工具条 */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-lg">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 全选复选框 */}
            <button
              onClick={toggleSelectAllFiltered}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1 shadow-2xs transition-colors"
              title={isAllFilteredSelected ? '取消全选当前筛选结果' : '全选当前筛选结果'}
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : selectedRecordIds.size > 0 ? (
                <div className="w-4 h-4 bg-blue-600 rounded-xs flex items-center justify-center text-white text-[10px]">
                  -
                </div>
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {isAllFilteredSelected
                  ? '取消全选'
                  : `全选当前筛选 (${filteredRecords.length})`}
              </span>
            </button>

            {/* 快捷勾选分歧项 */}
            <button
              onClick={selectDivergentRecords}
              className="text-xs text-slate-600 hover:text-purple-700 bg-white border border-slate-200 hover:border-purple-300 rounded px-2.5 py-1 shadow-2xs transition-colors flex items-center gap-1"
              title="一键勾选存在师生分歧或档位存疑的记录"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>勾选分歧/存疑项</span>
            </button>

            {/* 已选中计数 & 清空 */}
            {selectedRecordIds.size > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2.5 py-0.5 rounded-md font-medium">
                <span>已选中</span>
                <span className="font-bold">{selectedRecordIds.size}</span>
                <span>条</span>
                <button
                  onClick={clearSelection}
                  className="ml-1 text-blue-500 hover:text-blue-800 p-0.5"
                  title="清空所有选择"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* 批量导出功能按钮与下拉菜单 */}
          <div className="relative flex items-center gap-2" ref={dropdownRef}>
            {/* 快速一键下载 JSONL（最常见） */}
            <button
              onClick={() => exportAsJsonl(false)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title={
                selectedRecordIds.size > 0
                  ? `直接将选中的 ${selectedRecordIds.size} 条导出为 JSONL 文件`
                  : `直接将当前筛选的 ${filteredRecords.length} 条导出为 JSONL 文件`
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {selectedRecordIds.size > 0
                  ? `导出选中 JSONL (${selectedRecordIds.size})`
                  : `导出筛选 JSONL (${filteredRecords.length})`}
              </span>
            </button>

            {/* 更多导出格式下拉菜单 */}
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
              title="选择更多导出格式"
            >
              <span>更多导出</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {isExportDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  {selectedRecordIds.size > 0
                    ? `导出已选中的 ${selectedRecordIds.size} 项`
                    : `导出当前筛选的 ${filteredRecords.length} 项`}
                </div>

                <button
                  onClick={() => exportAsJsonl(false)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  <FileCode className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold">导出为 JSONL 文件</div>
                    <div className="text-[10px] text-slate-400">大模型评测与微调标准格式 (每行一JSON)</div>
                  </div>
                </button>

                <button
                  onClick={() => exportAsJson(false)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  <FileJson className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold">导出为 JSON 数组</div>
                    <div className="text-[10px] text-slate-400">标准结构化数组文件，适合二次加工</div>
                  </div>
                </button>

                <button
                  onClick={() => exportAsMarkdown(false)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <div className="font-semibold">导出为 Markdown 评测报告</div>
                    <div className="text-[10px] text-slate-400">完整问答与三元风险对齐，纯净无分数</div>
                  </div>
                </button>

                {onOpenExport && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={openAdvancedExportModal}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-blue-50 text-blue-700 flex items-center gap-2.5 transition-colors font-medium"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-semibold">打开高级自定义导出面板...</div>
                        <div className="text-[10px] text-blue-500">更多细粒度过滤与格式配置</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 统计指标行 */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-2">
            <span>当前筛选结果：</span>
            <span className="font-bold text-slate-800">{filteredRecords.length}</span>
            <span>/ {allRecords.length} 条问答记录</span>
            {selectedRecordIds.size > 0 && (
              <span className="text-blue-600 font-semibold ml-2">
                (已选 {selectedRecordIds.size} 条)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Safe
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Low
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> High
            </span>
            <span className="text-slate-400">· 纯净对比无数字分数干扰</span>
          </div>
        </div>
      </div>

      {/* 问答条目列表 */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">没有找到匹配的问答记录</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            请尝试调整搜索关键词、清除领域或目标档位过滤条件以查看全部记录。
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedDomain('all');
              setSelectedTier('all');
              setAlignmentFilter('all');
            }}
            className="px-3.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
          >
            重置所有筛选条件
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map(({ record, group }) => {
            const isSelected = selectedRecordIds.has(record.id);

            const domainConf = DOMAIN_CONFIG[record.domain as keyof typeof DOMAIN_CONFIG] || {
              label: record.domain,
              color: 'text-slate-700 bg-slate-100 border-slate-200',
            };

            const tierConf = TIER_CONFIG[record.tier] || {
              label: record.tier,
              en: record.tier,
              badge: 'bg-slate-100 text-slate-700 border-slate-300',
              border: 'border-slate-300',
              bg: 'bg-slate-50',
              dot: 'bg-slate-500',
            };

            // 教师风险与学生风险提取（零分数）
            const teacherObj = record.teacher_label || record.label;
            const studentObj = record.student_label || (record.student?.student_pred_risk ? {
              risk_level: record.student.student_pred_risk,
              pass: record.student.student_pred_risk === 'safe' || record.student.student_pred_risk === 'low',
            } : undefined);

            const rawTeacherRisk = teacherObj?.risk_level || record.risk_level || record.tier;
            const teacherRiskDisplay = getRiskDisplay(rawTeacherRisk);
            const teacherPass = teacherObj?.pass ?? (normalizeRiskLevel(rawTeacherRisk) === 'safe' || normalizeRiskLevel(rawTeacherRisk) === 'low');

            const hasStudent = Boolean(studentObj?.risk_level);
            const rawStudentRisk = studentObj?.risk_level;
            const studentRiskDisplay = hasStudent ? getRiskDisplay(rawStudentRisk) : null;
            const studentPass = Boolean(studentObj?.pass);

            // 一致性计算
            const tsConsistency = evaluateTeacherStudentConsistency(record);
            const tierConsistency = evaluateConsistency(record);

            const isAnalysisExpanded = expandedAnalyses.has(record.id);

            return (
              <div
                key={record.id}
                className={`bg-white border rounded-xl overflow-hidden shadow-2xs transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* 顶部元数据栏 (含复选框) */}
                <div
                  className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* 单项复选框 */}
                    <button
                      onClick={() => toggleSelectRecord(record.id)}
                      className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                      title={isSelected ? '取消勾选该条目' : '勾选该条目以批量导出'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                      )}
                    </button>

                    <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {record.qid || group.qid}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${domainConf.color}`}>
                      {domainConf.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ID: {record.id}
                    </span>

                    {isSelected && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                        已选择
                      </span>
                    )}
                  </div>

                  {/* 快捷操作区 */}
                  <div className="flex items-center gap-2">
                    {onSelectGroupForCompare && (
                      <button
                        onClick={() => onSelectGroupForCompare(group)}
                        className="text-[11px] text-slate-600 hover:text-blue-600 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
                        title="在四档精细研判中对比该题目"
                      >
                        <Layers className="w-3 h-3" />
                        <span>四档研判</span>
                      </button>
                    )}

                    {/* 单项直接导出为 JSONL */}
                    <button
                      onClick={() => {
                        const jsonl = exportRecordsToJsonl([record]);
                        triggerDownload(jsonl, `${record.id}.jsonl`, 'application/x-jsonlines;charset=utf-8');
                        showToast(`已导出 ${record.id} 单条记录`);
                      }}
                      className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
                      title="单独导出本条问答为 JSONL"
                    >
                      <Download className="w-3 h-3 text-slate-400" />
                      <span>导出</span>
                    </button>

                    <button
                      onClick={() => {
                        const copyPayload = `【题目 ${record.qid} (${domainConf.label})】\n目标Tier: ${record.tier.toUpperCase()}\n教师Risk: ${rawTeacherRisk} (${teacherPass ? 'PASS' : 'FAIL'})\n学生Risk: ${hasStudent ? rawStudentRisk : '未评测'}\n\n[问题]\n${record.question}\n\n[回答]\n${record.answer}`;
                        handleCopy(copyPayload, `all-${record.id}`);
                      }}
                      className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
                      title="复制完整问答及风险对照文本"
                    >
                      {copiedKey === `all-${record.id}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>复制全量</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 核心三元风险对照看板（目标Tier / 教师Risk / 学生Risk）—— 严格无分数 */}
                <div className="p-4 bg-slate-50/30 border-b border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* 1. 目标 Tier */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          <Target className="w-3 h-3 text-slate-500" />
                          <span>目标 Tier (Target)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${tierConf.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${tierConf.dot}`} />
                            {tierConf.label}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 text-right">
                        基准设定期望
                      </span>
                    </div>

                    {/* 2. 教师 Risk */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          <UserCheck className="w-3 h-3 text-blue-500" />
                          <span>教师 Risk (Teacher)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${teacherRiskDisplay.badgeClass}`}>
                            <span className={`w-2 h-2 rounded-full ${teacherRiskDisplay.dotClass}`} />
                            {teacherRiskDisplay.label}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            teacherPass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {teacherPass ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 text-right">
                        {teacherObj?.judge_name || '基准教师模型'}
                      </span>
                    </div>

                    {/* 3. 学生 Risk */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          <Bot className="w-3 h-3 text-purple-500" />
                          <span>学生 Risk (Student)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasStudent && studentRiskDisplay ? (
                            <>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${studentRiskDisplay.badgeClass}`}>
                                <span className={`w-2 h-2 rounded-full ${studentRiskDisplay.dotClass}`} />
                                {studentRiskDisplay.label}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                studentPass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {studentPass ? 'PASS' : 'FAIL'}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 italic">
                              暂无学生自测数据
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 text-right">
                        {hasStudent ? (studentObj?.judge_name || '学生自测模型') : '待导入评估'}
                      </span>
                    </div>
                  </div>

                  {/* 风险对齐状态与一致性简要提示条 */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">风险对齐判定:</span>
                      
                      {/* 师生对齐状态 */}
                      {tsConsistency.hasStudent ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tsConsistency.badgeClass}`}>
                          {tsConsistency.isConsistent ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          <span>{tsConsistency.statusText}</span>
                          <span className="font-normal opacity-80">
                            (教师 {teacherRiskDisplay.short} vs 学生 {studentRiskDisplay?.short})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          待上传学生数据对比
                        </span>
                      )}

                      {/* 目标Tier与教师一致性 */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${tierConsistency.badgeClass}`}>
                        {tierConsistency.isConsistent ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span>{tierConsistency.isConsistent ? '档位对齐' : '档位存疑'}</span>
                      </span>
                    </div>

                    {/* 展开定性分析按钮（若有） */}
                    {teacherObj?.analysis && (
                      <button
                        onClick={() => toggleAnalysis(record.id)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Info className="w-3 h-3" />
                        <span>{isAnalysisExpanded ? '收起定性分析' : '查看裁判定性分析'}</span>
                        {isAnalysisExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* 展开的定性评测分析（零分数） */}
                  {isAnalysisExpanded && teacherObj?.analysis && (
                    <div className="mt-2.5 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-slate-700 leading-relaxed">
                      <div className="flex items-center gap-1.5 text-blue-800 font-semibold mb-1 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>裁判定性分析依据（无分数纯文字研判）：</span>
                      </div>
                      <p className="text-slate-600 whitespace-pre-wrap">{teacherObj.analysis}</p>
                    </div>
                  )}
                </div>

                {/* 问答核心展示区域：根据布局排版模式渲染 */}
                {layoutMode === 'cards' ? (
                  /* 卡片流纵向视图：全量展开问题与回答 */
                  <div className="p-5 space-y-4">
                    {/* 完整问题区域 */}
                    <div className="rounded-lg bg-slate-50 border border-slate-200/90 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            完整评测问题 (Question)
                          </h3>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {record.question.length} 字符
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(record.question, `q-${record.id}`)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                          title="复制问题"
                        >
                          {copiedKey === `q-${record.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">已复制</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>复制问题</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap select-text font-sans">
                        {record.question}
                      </div>
                    </div>

                    {/* 完整答案区域 */}
                    <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-2xs">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            完整模型生成回答 (Answer)
                          </h3>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {record.answer.length} 字符
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(record.answer, `a-${record.id}`)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="复制回答"
                        >
                          {copiedKey === `a-${record.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">已复制</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>复制回答</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap select-text font-sans">
                        {record.answer}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 双栏左右比对视图：左侧问题+元信息，右侧完整长答案 */
                  <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                    {/* 左栏：完整问题 */}
                    <div className="lg:col-span-5 p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              完整问题 (Question)
                            </h3>
                          </div>
                          <button
                            onClick={() => handleCopy(record.question, `q-${record.id}`)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `q-${record.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                        <div className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap select-text">
                          {record.question}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-200/60 font-mono">
                        字符数: {record.question.length} 字 · 档位: {record.tier}
                      </div>
                    </div>

                    {/* 右栏：完整回答 */}
                    <div className="lg:col-span-7 p-4 bg-white flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              完整模型生成回答 (Answer)
                            </h3>
                          </div>
                          <button
                            onClick={() => handleCopy(record.answer, `a-${record.id}`)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `a-${record.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                        <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                          {record.answer}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 font-mono flex items-center justify-between">
                        <span>回答长度: {record.answer.length} 字符</span>
                        <span>回答类型: {record.answer_type || '标准'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 底部悬浮批量导出快捷栏 (当用户在长列表中勾选了数据时浮现) */}
      {selectedRecordIds.size > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs">
              已勾选 <strong className="text-blue-400 font-bold">{selectedRecordIds.size}</strong> 项
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportAsJsonl(false)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="快速导出选中的项目为 JSONL 格式"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 JSONL</span>
            </button>

            <button
              onClick={() => exportAsJson(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-600 transition-colors cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-emerald-400" />
              <span>JSON 数组</span>
            </button>

            <button
              onClick={() => exportAsMarkdown(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-600 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Markdown报告</span>
            </button>

            {onOpenExport && (
              <button
                onClick={openAdvancedExportModal}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-600 transition-colors cursor-pointer"
                title="更多高级导出配置"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>高级导出</span>
              </button>
            )}
          </div>

          <button
            onClick={clearSelection}
            className="text-xs text-slate-400 hover:text-white pl-2 border-l border-slate-700 transition-colors cursor-pointer"
            title="清空当前所有选中"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
};

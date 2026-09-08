import React, { useState, useMemo } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord } from '../types';
import { TIER_CONFIG } from '../mockData';
import {
  DOMAIN_CONFIG,
  VALID_DOMAINS,
  normalizeRiskLevel,
  evaluateConsistency,
  evaluateTeacherStudentConsistency,
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
} from 'lucide-react';

interface FullReviewViewProps {
  groups: SafetyQuestionGroup[];
  onSelectGroupForCompare?: (group: SafetyQuestionGroup) => void;
  onEditGroup?: (group: SafetyQuestionGroup, targetTier?: RiskTier) => void;
}

export const FullReviewView: React.FC<FullReviewViewProps> = ({
  groups,
  onSelectGroupForCompare,
  onEditGroup,
}) => {
  // 搜索与过滤状态
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [alignmentFilter, setAlignmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'divergence' | 'risk_desc' | 'risk_asc'>('default');
  const [layoutMode, setLayoutMode] = useState<'cards' | 'split'>('cards');
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(new Set());

  // 复制反馈状态
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
    return allRecords.filter(({ record, group }) => {
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
    }).sort((a, b) => {
      if (sortBy === 'divergence') {
        // 存在分歧的排在前列
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
      // 默认按 QID 与 Tier
      return a.record.id.localeCompare(b.record.id);
    });
  }, [allRecords, searchTerm, selectedDomain, selectedTier, alignmentFilter, sortBy]);

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
    <div className="space-y-5">
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

        {/* 统计指标行 */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-2">
            <span>当前筛选结果：</span>
            <span className="font-bold text-slate-800">{filteredRecords.length}</span>
            <span>/ {allRecords.length} 条问答记录</span>
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
            className="px-3.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            重置所有筛选条件
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map(({ record, group }) => {
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
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
              >
                {/* 顶部元数据栏 */}
                <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {record.qid || group.qid}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${domainConf.color}`}>
                      {domainConf.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ID: {record.id}
                    </span>
                  </div>

                  {/* 快捷操作区 */}
                  <div className="flex items-center gap-2">
                    {onSelectGroupForCompare && (
                      <button
                        onClick={() => onSelectGroupForCompare(group)}
                        className="text-[11px] text-slate-600 hover:text-blue-600 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white transition-colors"
                        title="在四档精细研判中对比该题目"
                      >
                        <Layers className="w-3 h-3" />
                        <span>四档研判</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const copyPayload = `【题目 ${record.qid} (${domainConf.label})】\n目标Tier: ${record.tier.toUpperCase()}\n教师Risk: ${rawTeacherRisk} (${teacherPass ? 'PASS' : 'FAIL'})\n学生Risk: ${hasStudent ? rawStudentRisk : '未评测'}\n\n[问题]\n${record.question}\n\n[回答]\n${record.answer}`;
                        handleCopy(copyPayload, `all-${record.id}`);
                      }}
                      className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white transition-colors"
                      title="复制完整问答及风险对照文本"
                    >
                      {copiedKey === `all-${record.id}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">已复制全部</span>
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
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
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
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200/60 transition-colors"
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
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
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
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
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
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
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
    </div>
  );
};

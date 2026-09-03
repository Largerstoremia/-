import React, { useState, useMemo } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord, FilterState } from '../types';
import { TIER_CONFIG, DOMAIN_LABELS } from '../mockData';
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowUpDown,
  FileText
} from 'lucide-react';

interface DataTableProps {
  groups: SafetyQuestionGroup[];
  onSelectGroupForCompare: (group: SafetyQuestionGroup) => void;
  onEditGroup: (group: SafetyQuestionGroup, targetTier?: RiskTier) => void;
  onDeleteGroup: (qid: string) => void;
  onViewRecordDetail: (record: TierAnswerRecord) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  groups,
  onSelectGroupForCompare,
  onEditGroup,
  onDeleteGroup,
  onViewRecordDetail,
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'grouped' | 'records'>('grouped');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    domain: 'all',
    tier: 'all',
    passStatus: 'all',
    minScore: 0,
  });

  const handleCopyJson = (record: TierAnswerRecord) => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Filter logic for grouped questions
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // Domain
      if (filters.domain !== 'all' && g.domain !== filters.domain) return false;

      // Search keyword
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchQ =
          g.question.toLowerCase().includes(q) ||
          g.qid.toLowerCase().includes(q) ||
          g.domain.toLowerCase().includes(q);

        const matchAnswers = (['safe', 'low', 'medium', 'high'] as RiskTier[]).some(
          (t) => {
            const ans = g.answers[t];
            return (
              ans &&
              (ans.answer.toLowerCase().includes(q) ||
                ans.label.analysis.toLowerCase().includes(q) ||
                ans.label.judge_name.toLowerCase().includes(q) ||
                ans.label.error_type.toLowerCase().includes(q))
            );
          }
        );

        if (!matchQ && !matchAnswers) return false;
      }

      // Tier & Pass filters applied to grouped
      if (filters.tier !== 'all') {
        const item = g.answers[filters.tier as RiskTier];
        if (!item) return false;
        if (filters.passStatus === 'pass' && !item.label.pass) return false;
        if (filters.passStatus === 'fail' && item.label.pass) return false;
        if (item.label.score < filters.minScore) return false;
      }

      return true;
    });
  }, [groups, filters]);

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

  const filteredFlatRecords = useMemo(() => {
    return allFlatRecords.filter((rec) => {
      if (filters.domain !== 'all' && rec.domain !== filters.domain) return false;
      if (filters.tier !== 'all' && rec.tier !== filters.tier) return false;
      if (filters.passStatus === 'pass' && !rec.label.pass) return false;
      if (filters.passStatus === 'fail' && rec.label.pass) return false;
      if (rec.label.score < filters.minScore) return false;

      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        return (
          rec.id.toLowerCase().includes(q) ||
          rec.qid.toLowerCase().includes(q) ||
          rec.question.toLowerCase().includes(q) ||
          rec.answer.toLowerCase().includes(q) ||
          rec.label.analysis.toLowerCase().includes(q) ||
          rec.label.judge_name.toLowerCase().includes(q) ||
          rec.label.error_type.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allFlatRecords, filters]);

  return (
    <div className="space-y-4" id="data-table-section">
      {/* Search & Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="搜索问题Prompt、回答文本、判定理由、缺陷类型或ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs self-stretch md:self-auto justify-center">
            <button
              onClick={() => setActiveViewMode('grouped')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeViewMode === 'grouped'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              题干题卡视图 ({filteredGroups.length})
            </button>
            <button
              onClick={() => setActiveViewMode('records')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeViewMode === 'records'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全量档位列表 ({filteredFlatRecords.length})
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400">领域分类:</span>
            <select
              value={filters.domain}
              onChange={(e) => setFilters((p) => ({ ...p, domain: e.target.value }))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs"
            >
              <option value="all">全部领域 ({groups.length})</option>
              <option value="bias">偏见与公平 (Bias)</option>
              <option value="privacy">隐私与PII (Privacy)</option>
              <option value="illegal">违法违规 (Illegal)</option>
              <option value="toxic">毒性与仇恨 (Toxic)</option>
              <option value="violence">暴力危害 (Violence)</option>
              <option value="financial">金融安全 (Financial)</option>
              <option value="general">综合合规 (General)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">风险档位:</span>
            <select
              value={filters.tier}
              onChange={(e) => setFilters((p) => ({ ...p, tier: e.target.value }))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs"
            >
              <option value="all">四档全部</option>
              <option value="safe">🟢 Safe 安全档</option>
              <option value="low">🔵 Low 低风险</option>
              <option value="medium">🟡 Medium 中风险</option>
              <option value="high">🔴 High 高风险</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">审核结论:</span>
            <select
              value={filters.passStatus}
              onChange={(e) => setFilters((p) => ({ ...p, passStatus: e.target.value }))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs"
            >
              <option value="all">全部状态</option>
              <option value="pass">通过 (Pass)</option>
              <option value="fail">拦截 (Reject)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] text-slate-400">最低安全分:</span>
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
        </div>
      </div>

      {/* Main List Rendering */}
      {activeViewMode === 'grouped' ? (
        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              未找到匹配的内容安全评测条目，请调整筛选条件或新建条目。
            </div>
          ) : (
            filteredGroups.map((g) => {
              const domainInfo = DOMAIN_LABELS[g.domain] || {
                label: g.domain,
                color: 'text-slate-700 bg-slate-50 border-slate-200',
              };

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
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${domainInfo.color}`}>
                        {domainInfo.label}
                      </span>
                      {g.tags?.map((t) => (
                        <span key={t} className="text-[11px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
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
                          if (confirm(`确定删除问题 ${g.qid} 及其四档数据吗？`)) {
                            onDeleteGroup(g.qid);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="删除"
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

                  {/* 4-Tier Snapshot Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                    {(['safe', 'low', 'medium', 'high'] as RiskTier[]).map((tier) => {
                      const ans = g.answers[tier];
                      const conf = TIER_CONFIG[tier];
                      if (!ans) return null;

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
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                              ans.label.pass ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'
                            }`}>
                              {ans.label.score}分
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {ans.answer}
                          </p>
                          <div className="mt-1.5 pt-1 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-400">
                            <span>权重: {ans.student.training_weight}x</span>
                            <span>DPO #{ans.student.preference_rank}</span>
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
      ) : (
        /* Granular flat table view (matches user's single item schema) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">记录 ID / QID</th>
                  <th className="px-4 py-3">领域 / 档位</th>
                  <th className="px-4 py-3">问题与回答摘录</th>
                  <th className="px-4 py-3">教师评审结论</th>
                  <th className="px-4 py-3">学生训练设置</th>
                  <th className="px-4 py-3 text-right">快捷操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFlatRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      无符合条件的档位记录
                    </td>
                  </tr>
                ) : (
                  filteredFlatRecords.map((rec) => {
                    const conf = TIER_CONFIG[rec.tier];
                    const isCopied = copiedId === rec.id;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 align-top whitespace-nowrap font-mono">
                          <span className="font-semibold text-slate-800 block text-[11px]">{rec.id}</span>
                          <span className="text-[10px] text-slate-400">{rec.qid}</span>
                        </td>

                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="space-y-1">
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 block w-max">
                              {rec.domain}
                            </span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${conf.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                              {conf.en}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top max-w-xs">
                          <span className="font-medium text-slate-900 block truncate text-[11px] mb-0.5" title={rec.question}>
                            Q: {rec.question}
                          </span>
                          <p className="text-slate-600 line-clamp-2 leading-relaxed text-[11px]" title={rec.answer}>
                            A: {rec.answer}
                          </p>
                        </td>

                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono font-bold text-xs ${rec.label.score >= 80 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {rec.label.score}分
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                rec.label.pass ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {rec.label.pass ? 'Pass' : 'Reject'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">{rec.label.judge_name}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-[11px]">
                          <div className="space-y-0.5">
                            <span className="text-slate-700 block">权重: {rec.student.training_weight}x</span>
                            <span className="text-indigo-600 block text-[10px]">DPO #{rec.student.preference_rank}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onViewRecordDetail(rec)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                              title="查看详尽分析与六维雷达"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyJson(rec)}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                              title="复制此条记录JSON"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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
      )}
    </div>
  );
};

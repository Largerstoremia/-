import React, { useState, useEffect } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord } from './types';
import { INITIAL_SAFETY_GROUPS } from './mockData';
import { TierComparator } from './components/TierComparator';
import { DataTable } from './components/DataTable';
import { DatasetAnalytics } from './components/DatasetAnalytics';
import { QuestionModal } from './components/QuestionModal';
import { ImportExportModal } from './components/ImportExportModal';
import { DetailModal } from './components/DetailModal';
import {
  ShieldCheck,
  Layers,
  TableProperties,
  BarChart3,
  Plus,
  Download,
  Upload,
  CheckCircle2,
  ChevronDown,
  Database,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Search,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

const STORAGE_KEY = 'CS_STUDIO_DATA_GROUPS_V1';

export default function App() {
  // Load data from localStorage or fallback to benchmark data
  const [groups, setGroups] = useState<SafetyQuestionGroup[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached safety data:', e);
    }
    return INITIAL_SAFETY_GROUPS;
  });

  // Current active view tab
  const [activeTab, setActiveTab] = useState<'comparator' | 'table' | 'analytics'>('comparator');

  // Currently selected question group in Comparator
  const [selectedQid, setSelectedQid] = useState<string>(() => groups[0]?.qid || 'bias-0000');

  // Modals state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SafetyQuestionGroup | null>(null);
  const [editingTier, setEditingTier] = useState<RiskTier>('safe');

  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<TierAnswerRecord | null>(null);

  const [saveToast, setSaveToast] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Sync to localStorage whenever groups change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
      setSaveToast(true);
      const timer = setTimeout(() => setSaveToast(false), 2000);
      return () => clearTimeout(timer);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [groups]);

  // Current active group for comparator
  const currentGroup = groups.find((g) => g.qid === selectedQid) || groups[0] || INITIAL_SAFETY_GROUPS[0];

  // Filtered groups for sidebar
  const sidebarGroups = groups.filter((g) => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.toLowerCase();
    return (
      g.qid.toLowerCase().includes(q) ||
      g.question.toLowerCase().includes(q) ||
      g.domain.toLowerCase().includes(q)
    );
  });

  const handleSaveGroup = (savedGroup: SafetyQuestionGroup) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.qid === savedGroup.qid);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedGroup;
        return updated;
      }
      return [savedGroup, ...prev];
    });
    setSelectedQid(savedGroup.qid);
  };

  const handleDeleteGroup = (targetQid: string) => {
    setGroups((prev) => {
      const filtered = prev.filter((g) => g.qid !== targetQid);
      if (selectedQid === targetQid && filtered.length > 0) {
        setSelectedQid(filtered[0].qid);
      }
      return filtered;
    });
  };

  const handleImportGroups = (newGroups: SafetyQuestionGroup[], mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      setGroups(newGroups);
      if (newGroups.length > 0) setSelectedQid(newGroups[0].qid);
    } else {
      setGroups((prev) => {
        const existingMap = new Map(prev.map((g) => [g.qid, g]));
        newGroups.forEach((g) => existingMap.set(g.qid, g));
        return Array.from(existingMap.values());
      });
      if (newGroups.length > 0) setSelectedQid(newGroups[0].qid);
    }
  };

  const handleResetBenchmark = () => {
    if (confirm('确认恢复系统初始评测基准数据集？现有修改将被覆盖。')) {
      setGroups(INITIAL_SAFETY_GROUPS);
      setSelectedQid(INITIAL_SAFETY_GROUPS[0].qid);
      setIsImportExportOpen(false);
    }
  };

  const totalAnswerCount = groups.reduce((acc, g) => {
    return acc + Object.keys(g.answers || {}).length;
  }, 0);

  return (
    <div className="h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans overflow-hidden">
      {/* Top Main Navigation Header */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-8 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shrink-0 shadow-2xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              C-Security <span className="text-slate-400 font-normal">Insight Engine</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors flex items-center gap-2"
            title="导入 / 导出 JSON"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Import Logs</span>
          </button>

          <button
            onClick={() => {
              setEditingGroup(null);
              setEditingTier('safe');
              setIsQuestionModalOpen(true);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>新建评测条目</span>
          </button>
        </div>
      </header>

      {/* Sub Navigation Bar Tabs */}
      <div className="h-11 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('comparator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              activeTab === 'comparator'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>四档对比矩阵</span>
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              activeTab === 'table'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>数据管理列表</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>大盘统计看板</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'comparator' && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
              title={isSidebarOpen ? '收起左侧题目列表' : '展开左侧题目列表'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSidebarOpen ? '收起侧栏' : '展开侧栏'}</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>{groups.length} 题 / {totalAnswerCount} 档回答</span>
          </div>

          {saveToast && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> 已存
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'comparator' ? (
        <main className="flex-1 flex overflow-hidden">
          {/* Master Aside List */}
          {isSidebarOpen && (
            <aside className="w-72 sm:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-3.5 border-b border-slate-100">
                <div className="relative">
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search records..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 border-none rounded focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 outline-none"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarGroups.map((g) => {
                  const isSelected = g.qid === selectedQid;
                  const safeScore = g.answers.safe?.label.score;

                  return (
                    <div
                      key={g.qid}
                      onClick={() => setSelectedQid(g.qid)}
                      className={`p-3 rounded-r cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-blue-600'
                          : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-xs font-semibold uppercase ${
                          isSelected ? 'text-blue-600' : 'text-slate-600'
                        }`}>
                          {g.qid}
                        </p>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                          {g.domain}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {g.question}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                        <span>Safe: {safeScore ?? '-'}分</span>
                        <span>·</span>
                        <span>4 档对比</span>
                      </div>
                    </div>
                  );
                })}

                {sidebarGroups.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">
                    未找到匹配的问题记录
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Detailed Comparator Area */}
          <section className="flex-1 overflow-y-auto p-6 space-y-6">
            {currentGroup && (
              <TierComparator
                questionGroup={currentGroup}
                onEditTier={(tier) => {
                  setEditingGroup(currentGroup);
                  setEditingTier(tier);
                  setIsQuestionModalOpen(true);
                }}
                onEditQuestion={() => {
                  setEditingGroup(currentGroup);
                  setEditingTier('safe');
                  setIsQuestionModalOpen(true);
                }}
              />
            )}
          </section>
        </main>
      ) : activeTab === 'table' ? (
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <DataTable
              groups={groups}
              onSelectGroupForCompare={(group) => {
                setSelectedQid(group.qid);
                setActiveTab('comparator');
              }}
              onEditGroup={(group, tier) => {
                setEditingGroup(group);
                setEditingTier(tier || 'safe');
                setIsQuestionModalOpen(true);
              }}
              onDeleteGroup={handleDeleteGroup}
              onViewRecordDetail={(record) => setViewingRecord(record)}
            />
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <DatasetAnalytics groups={groups} />
          </div>
        </main>
      )}

      {/* Professional Polish Footer */}
      <footer className="h-10 bg-slate-900 text-slate-400 text-[10px] flex items-center justify-between px-6 lg:px-8 border-t border-slate-800 shrink-0 uppercase tracking-widest font-mono select-none">
        <span>© 2024 Content Security Inspector Pro</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          System Status: Healthy
        </span>
        <span className="hidden sm:inline">Database: content_eval_v2.01</span>
      </footer>

      {/* Modals */}
      <QuestionModal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        initialGroup={editingGroup}
        targetTier={editingTier}
        onSaveGroup={handleSaveGroup}
      />

      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        groups={groups}
        onImportGroups={handleImportGroups}
        onResetBenchmark={handleResetBenchmark}
      />

      <DetailModal record={viewingRecord} onClose={() => setViewingRecord(null)} />
    </div>
  );
}

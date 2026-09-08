import React, { useState, useEffect } from 'react';
import { SafetyQuestionGroup, RiskTier, TierAnswerRecord, UploadRoleTarget } from './types';
import { INITIAL_SAFETY_GROUPS } from './mockData';
import { TierComparator } from './components/TierComparator';
import { DataTable } from './components/DataTable';
import { FullReviewView } from './components/FullReviewView';
import { DatasetAnalytics } from './components/DatasetAnalytics';
import { QuestionModal } from './components/QuestionModal';
import { ImportExportModal, ExportFilterPreset } from './components/ImportExportModal';
import { DetailModal } from './components/DetailModal';
import { ConfirmModal } from './components/ConfirmModal';
import {
  ShieldCheck,
  Layers,
  TableProperties,
  BarChart3,
  FileText,
  Plus,
  Download,
  Upload,
  CheckCircle2,
  Database,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Info,
  Cloud,
  RefreshCw,
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
  const [activeTab, setActiveTab] = useState<'comparator' | 'table' | 'fullreview' | 'analytics'>('comparator');

  // Currently selected question group in Comparator
  const [selectedQid, setSelectedQid] = useState<string>(() => groups[0]?.qid || 'bias-0000');

  // Modals state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SafetyQuestionGroup | null>(null);
  const [editingTier, setEditingTier] = useState<RiskTier>('safe');

  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'export' | 'import'>('export');
  const [exportPreset, setExportPreset] = useState<ExportFilterPreset | undefined>(undefined);
  const [viewingRecord, setViewingRecord] = useState<TierAnswerRecord | null>(null);

  const handleOpenExportModal = (preset?: ExportFilterPreset) => {
    setImportExportTab('export');
    setExportPreset(preset);
    setIsImportExportOpen(true);
  };

  const handleOpenImportModal = () => {
    setImportExportTab('import');
    setExportPreset(undefined);
    setIsImportExportOpen(true);
  };

  const [saveToast, setSaveToast] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Cloud & cross-device synchronization state
  const isInitialLoad = React.useRef(true);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // General toast notification
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text === text ? null : cur));
    }, 3500);
  };

  // Fetch data from server API on mount for cross-device persistence
  const fetchServerGroups = async (manual = false) => {
    try {
      setSyncState('syncing');
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.groups) && data.groups.length > 0) {
          setGroups(data.groups);
          setSyncState('synced');
          const timeStr = new Date().toLocaleTimeString();
          setLastSyncedTime(timeStr);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.groups));
          } catch {}
          if (manual) {
            showToast(`已从云端同步获取 ${data.groups.length} 道测试题数据`, 'success');
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Backend storage API not reachable, using local storage:', err);
      setSyncState('offline');
    } finally {
      setSyncState((prev) => (prev === 'syncing' ? 'synced' : prev));
    }
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        setSyncState('syncing');
        const res = await fetch('/api/groups');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.groups) && data.groups.length > 0) {
            setGroups(data.groups);
            setSyncState('synced');
            setLastSyncedTime(new Date().toLocaleTimeString());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.groups));
            isInitialLoad.current = false;
            return;
          }
        }
      } catch (e) {
        console.warn('Initial server fetch failed, fallback to local cache:', e);
      }

      if (isMounted) {
        // If server had no data, save initial/current local data to server
        isInitialLoad.current = false;
        setSyncState('synced');
        fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groups }),
        }).catch((e) => console.warn('Sync initial groups failed:', e));
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to server disk storage & localStorage whenever groups change
  useEffect(() => {
    if (isInitialLoad.current) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
      setSaveToast(true);
      const timer = setTimeout(() => setSaveToast(false), 2000);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // Debounced sync to server for cross-device persistence
    const timer = setTimeout(async () => {
      try {
        setSyncState('syncing');
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groups }),
        });
        if (res.ok) {
          setSyncState('synced');
          setLastSyncedTime(new Date().toLocaleTimeString());
        }
      } catch (e) {
        console.warn('Failed to sync to server:', e);
        setSyncState('offline');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [groups]);

  // Current active group for comparator
  const currentGroup = groups.find((g) => g.qid === selectedQid) || groups[0];

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
    showToast(`测试题 [${savedGroup.qid}] 已保存并同步`, 'success');
  };

  // Delete entire question group
  const handleDeleteGroup = (targetQid: string) => {
    setGroups((prev) => {
      const filtered = prev.filter((g) => g.qid !== targetQid);
      if (selectedQid === targetQid) {
        setSelectedQid(filtered.length > 0 ? filtered[0].qid : '');
      }
      return filtered;
    });
    showToast(`已彻底删除测试题 [${targetQid}] 及其所有档位数据`, 'info');
  };

  // Delete specific single record
  const handleDeleteRecord = (recordId: string, qid?: string) => {
    setGroups((prev) => {
      return prev
        .map((g) => {
          // If qid is provided, match by qid or verify if this group owns the recordId
          const hasRecord = (['safe', 'low', 'medium', 'high'] as RiskTier[]).some(
            (t) => g.answers[t]?.id === recordId
          );
          if (qid && g.qid !== qid && !hasRecord) return g;

          const nextAnswers = { ...g.answers };
          let changed = false;
          (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
            if (nextAnswers[t]?.id === recordId) {
              delete nextAnswers[t];
              changed = true;
            }
          });
          if (!changed) return g;
          return { ...g, answers: nextAnswers };
        })
        .filter((g) => Object.keys(g.answers).length > 0);
    });
    if (viewingRecord?.id === recordId) {
      setViewingRecord(null);
    }
    showToast(`已从评测库删除记录 [${recordId}]`, 'info');
  };

  // Delete specific tier within a group
  const handleDeleteTier = (tier: RiskTier, qid: string) => {
    setGroups((prev) => {
      return prev
        .map((g) => {
          if (g.qid !== qid) return g;
          const nextAnswers = { ...g.answers };
          delete nextAnswers[tier];
          return { ...g, answers: nextAnswers };
        })
        .filter((g) => Object.keys(g.answers).length > 0);
    });
    showToast(`已删除 [${qid}] 题目的 [${tier}] 档位数据`, 'info');
  };

  // Batch delete multiple records
  const handleBatchDeleteRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    setGroups((prev) => {
      return prev
        .map((g) => {
          const nextAnswers = { ...g.answers };
          let changed = false;
          (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
            if (nextAnswers[t] && idSet.has(nextAnswers[t]!.id)) {
              delete nextAnswers[t];
              changed = true;
            }
          });
          if (!changed) return g;
          return { ...g, answers: nextAnswers };
        })
        .filter((g) => Object.keys(g.answers).length > 0);
    });
    showToast(`已成功批量删除 ${recordIds.length} 条评测记录`, 'info');
  };

  // Clear all data
  const handleClearAllData = () => {
    setGroups([]);
    setSelectedQid('');
    setViewingRecord(null);
    showToast('已清空当前评测数据池中的所有记录', 'info');
  };

  // Import groups (merge or replace with strict role isolation)
  const handleImportGroups = (
    newGroups: SafetyQuestionGroup[],
    mode: 'merge' | 'replace',
    role?: UploadRoleTarget
  ) => {
    if (mode === 'replace') {
      setGroups(newGroups);
      if (newGroups.length > 0) setSelectedQid(newGroups[0].qid);
      const roleText = role === 'student' ? '学生模型评测' : '教师模型评测';
      showToast(`已覆盖导入 ${newGroups.length} 个测试题（${roleText}数据）`, 'success');
    } else {
      setGroups((prev) => {
        const existingMap = new Map<string, SafetyQuestionGroup>(prev.map((g) => [g.qid, g]));
        newGroups.forEach((g) => {
          if (existingMap.has(g.qid)) {
            const prevGroup = existingMap.get(g.qid)!;
            const mergedAnswers: Record<RiskTier, TierAnswerRecord> = { ...prevGroup.answers };

            (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
              const prevRec = prevGroup.answers[t];
              const incomingRec = g.answers[t];

              if (prevRec && incomingRec) {
                if (role === 'student' || (!incomingRec.teacher_label && incomingRec.student_label)) {
                  // 1. 导入学生模型结果：严格保护教师模型数据不被覆盖或篡改
                  mergedAnswers[t] = {
                    ...prevRec,
                    answer: incomingRec.answer || prevRec.answer,
                    // 保持教师模型评审完全不变
                    label: prevRec.teacher_label || prevRec.label,
                    teacher_label: prevRec.teacher_label || prevRec.label,
                    // 独立写入学生模型结果
                    student_label: incomingRec.student_label || incomingRec.label,
                    _rewritten: incomingRec._rewritten ?? prevRec._rewritten,
                  };
                } else if (role === 'teacher' || (incomingRec.teacher_label && !incomingRec.student_label)) {
                  // 2. 导入教师模型结果：严格保护已有学生模型数据不被清除
                  mergedAnswers[t] = {
                    ...incomingRec,
                    label: incomingRec.teacher_label || incomingRec.label,
                    teacher_label: incomingRec.teacher_label || incomingRec.label,
                    // 保留学生模型自评结果
                    student_label: prevRec.student_label || incomingRec.student_label,
                    _rewritten: incomingRec._rewritten ?? prevRec._rewritten,
                  };
                } else {
                  // 通用合并
                  mergedAnswers[t] = {
                    ...prevRec,
                    ...incomingRec,
                    label: incomingRec.teacher_label || prevRec.teacher_label || incomingRec.label || prevRec.label,
                    teacher_label: incomingRec.teacher_label || prevRec.teacher_label || prevRec.label,
                    student_label: incomingRec.student_label || prevRec.student_label,
                  };
                }
              } else if (incomingRec) {
                mergedAnswers[t] = incomingRec;
              }
            });

            existingMap.set(g.qid, {
              ...prevGroup,
              ...g,
              answers: mergedAnswers,
            });
          } else {
            existingMap.set(g.qid, g);
          }
        });
        return Array.from(existingMap.values());
      });
      if (newGroups.length > 0) setSelectedQid(newGroups[0].qid);
      const roleText = role === 'student' ? '学生自评' : '教师基准';
      showToast(`已成功合并导入 ${newGroups.length} 个测试题（${roleText}数据相互独立）`, 'success');
    }
  };

  const handleResetBenchmark = () => {
    setIsConfirmResetOpen(true);
  };

  const handleExecuteResetBenchmark = async () => {
    setGroups(INITIAL_SAFETY_GROUPS);
    setSelectedQid(INITIAL_SAFETY_GROUPS[0]?.qid || '');
    setIsImportExportOpen(false);
    setIsConfirmResetOpen(false);
    try {
      await fetch('/api/reset', { method: 'POST' });
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: INITIAL_SAFETY_GROUPS }),
      });
    } catch (e) {
      console.warn('Server reset failed:', e);
    }
    showToast('已成功恢复系统初始评测基准数据集并同步到服务端存储', 'success');
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

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenExportModal()}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="打开评测集条件导出面板（支持按一致性、Medium等档位筛选）"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>条件筛选导出</span>
          </button>

          <button
            onClick={handleOpenImportModal}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="上传数据（教师/学生模型）"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>导入数据</span>
          </button>

          <button
            onClick={() => {
              setEditingGroup(null);
              setEditingTier('safe');
              setIsQuestionModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>新增评测题目111</span>
          </button>
        </div>
      </header>

      {/* Navigation Sub-bar */}
      <div className="h-12 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-md text-xs">
            <button
              onClick={() => setActiveTab('comparator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded font-medium transition-all ${
                activeTab === 'comparator'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>四档精细研判</span>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded font-medium transition-all ${
                activeTab === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>数据表格 & 校验 ({totalAnswerCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('fullreview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded font-medium transition-all ${
                activeTab === 'fullreview'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>完整问答全览 ({totalAnswerCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded font-medium transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>评测标签统计分析</span>
            </button>
          </div>

          {activeTab === 'comparator' && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="ml-3 p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title={isSidebarOpen ? '收起题库列表' : '展开题库列表'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Global info pill & Cloud Sync status */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100/90 border border-slate-200 text-[11px] text-slate-600 font-mono"
            title="跨设备持久存储：上传/修改数据已自动持久化存储至后端服务，在其它设备打开本页面自动恢复最新数据"
          >
            <Cloud className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'text-amber-500 animate-pulse' : syncState === 'synced' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>
              {syncState === 'syncing' ? '云端同步中...' : syncState === 'synced' ? '跨设备存储: 已同步' : '本地存储模式'}
            </span>
            {lastSyncedTime && (
              <span className="text-[10px] text-slate-400">({lastSyncedTime})</span>
            )}
            <button
              onClick={() => fetchServerGroups(true)}
              className="ml-1 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
              title="从服务端拉取最新数据（如在其它设备有更新）"
            >
              <RefreshCw className={`w-3 h-3 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {saveToast && (
            <span className="flex items-center gap-1 text-emerald-600 text-[11px] font-mono animate-fade-in">
              <CheckCircle2 className="w-3 h-3" /> 已实时保存
            </span>
          )}
          <span className="font-mono text-slate-400">
            {groups.length} 道测试题 / {totalAnswerCount} 条档位数据
          </span>
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === 'comparator' ? (
        <main className="flex-1 flex overflow-hidden">
          {/* Left Sidebar List for Questions */}
          {isSidebarOpen && (
            <aside className="w-72 sm:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-3.5 border-b border-slate-100">
                <div className="relative">
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="搜索测试题..."
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
                        <span>Safe: {safeScore !== undefined ? `${safeScore.toFixed(0)}分` : '-'}</span>
                        <span>·</span>
                        <span>{Object.keys(g.answers).length} 档数据</span>
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
            {currentGroup ? (
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
                onDeleteGroup={handleDeleteGroup}
                onDeleteTier={handleDeleteTier}
              />
            ) : (
              <div className="bg-white rounded-xl p-12 text-center border border-slate-200 text-slate-400 text-xs">
                当前题库为空，请点击右上角「新增评测题目」或在「导入/导出」中载入数据。
              </div>
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
              onDeleteRecord={handleDeleteRecord}
              onBatchDeleteRecords={handleBatchDeleteRecords}
              onClearAllData={handleClearAllData}
              onResetBenchmark={handleResetBenchmark}
              onViewRecordDetail={(record) => setViewingRecord(record)}
              onImportGroups={handleImportGroups}
              onOpenExport={handleOpenExportModal}
            />
          </div>
        </main>
      ) : activeTab === 'fullreview' ? (
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <FullReviewView
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

      {/* Footer */}
      <footer className="h-10 bg-slate-900 text-slate-400 text-[10px] flex items-center justify-between px-6 lg:px-8 border-t border-slate-800 shrink-0 uppercase tracking-widest font-mono select-none">
        <span>© 2024 Content Security Inspector Pro</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          系统状态: 正常运行
        </span>
        <span className="hidden sm:inline">教师模型与学生模型标签格式统一</span>
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
        initialTab={importExportTab}
        initialExportPreset={exportPreset}
      />

      <DetailModal
        record={viewingRecord}
        onClose={() => setViewingRecord(null)}
        onDeleteRecord={handleDeleteRecord}
      />

      {/* Confirmation Modal for Resetting System Benchmark */}
      <ConfirmModal
        isOpen={isConfirmResetOpen}
        onClose={() => setIsConfirmResetOpen(false)}
        onConfirm={handleExecuteResetBenchmark}
        title="确认恢复系统初始评测基准"
        message="确定要恢复系统初始评测基准数据集吗？当前数据池中所有自定义修改与上传样本将被初始测试集覆盖。"
        confirmText="确认恢复基准数据"
        variant="warning"
      />

      {/* Floating Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-14 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700 shadow-emerald-950/20'
                : toastMessage.type === 'info'
                ? 'bg-slate-900 text-slate-100 border-slate-700 shadow-slate-950/20'
                : 'bg-rose-900 text-rose-100 border-rose-700 shadow-rose-950/20'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

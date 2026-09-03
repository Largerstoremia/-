import React, { useMemo } from 'react';
import { SafetyQuestionGroup, RiskTier } from '../types';
import { TIER_CONFIG } from '../mockData';
import { evaluateConsistency, DOMAIN_CONFIG } from '../utils';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  PieChart,
  Scale,
  CheckCircle2,
  Cpu,
  Award,
  Layers,
  FileText
} from 'lucide-react';

interface DatasetAnalyticsProps {
  groups: SafetyQuestionGroup[];
}

export const DatasetAnalytics: React.FC<DatasetAnalyticsProps> = ({ groups }) => {
  const stats = useMemo(() => {
    let totalQuestions = groups.length;
    let totalAnswers = 0;
    let passCount = 0;
    let consistentCount = 0;
    let studentEvaluatedCount = 0;

    const tierStats: Record<RiskTier, {
      total: number;
      pass: number;
      avgTeacherScore: number;
      avgStudentScore: number;
      studentCount: number;
    }> = {
      safe: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, studentCount: 0 },
      low: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, studentCount: 0 },
      medium: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, studentCount: 0 },
      high: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, studentCount: 0 },
    };

    const domainCount: Record<string, number> = {
      bias: 0,
      porn: 0,
      privacy: 0,
      selfharm: 0,
    };

    const tierScores: Record<RiskTier, { teacherTotal: number; studentTotal: number }> = {
      safe: { teacherTotal: 0, studentTotal: 0 },
      low: { teacherTotal: 0, studentTotal: 0 },
      medium: { teacherTotal: 0, studentTotal: 0 },
      high: { teacherTotal: 0, studentTotal: 0 },
    };

    groups.forEach((g) => {
      const d = g.domain || 'bias';
      domainCount[d] = (domainCount[d] || 0) + 1;

      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((tier) => {
        const item = g.answers[tier];
        if (item) {
          totalAnswers++;
          tierStats[tier].total++;
          if (item.label.pass) {
            passCount++;
            tierStats[tier].pass++;
          }

          tierScores[tier].teacherTotal += item.label.score;

          if (item.student_label) {
            studentEvaluatedCount++;
            tierStats[tier].studentCount++;
            tierScores[tier].studentTotal += item.student_label.score;
          }

          if (evaluateConsistency(item).isConsistent) {
            consistentCount++;
          }
        }
      });
    });

    // Compute averages
    (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((t) => {
      const cnt = tierStats[t].total;
      tierStats[t].avgTeacherScore = cnt > 0 ? Math.round(tierScores[t].teacherTotal / cnt) : 0;
      const sCnt = tierStats[t].studentCount;
      tierStats[t].avgStudentScore = sCnt > 0 ? Math.round(tierScores[t].studentTotal / sCnt) : 0;
    });

    return {
      totalQuestions,
      totalAnswers,
      passRate: totalAnswers > 0 ? Math.round((passCount / totalAnswers) * 100) : 0,
      consistentRate: totalAnswers > 0 ? Math.round((consistentCount / totalAnswers) * 100) : 0,
      consistentCount,
      inconsistentCount: totalAnswers - consistentCount,
      studentEvaluatedCount,
      tierStats,
      domainCount,
    };
  }, [groups]);

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">总测试题量</p>
            <p className="text-xl font-bold font-mono text-slate-900">{stats.totalQuestions} 道题</p>
            <p className="text-[11px] text-slate-400">对应 {stats.totalAnswers} 个档位样本</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">审核结论一致率</p>
            <p className="text-xl font-bold font-mono text-emerald-700">{stats.consistentRate}%</p>
            <p className="text-[11px] text-slate-400">一致 {stats.consistentCount} / 冲突 {stats.inconsistentCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">基准安全通过率</p>
            <p className="text-xl font-bold font-mono text-indigo-700">{stats.passRate}%</p>
            <p className="text-[11px] text-slate-400">Safe/Low 档安全合格率</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">学生模型评测覆盖</p>
            <p className="text-xl font-bold font-mono text-purple-700">{stats.studentEvaluatedCount} 条</p>
            <p className="text-[11px] text-slate-400">
              {stats.totalAnswers > 0 ? Math.round((stats.studentEvaluatedCount / stats.totalAnswers) * 100) : 0}% 样本已配置
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Two Column Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Comparisons */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">四档答案评审标签指标统计</h3>
            </div>
            <span className="text-[11px] text-slate-500">教师模型评审 vs 学生模型评审</span>
          </div>

          <div className="space-y-3">
            {(['safe', 'low', 'medium', 'high'] as RiskTier[]).map((tier) => {
              const conf = TIER_CONFIG[tier] || TIER_CONFIG.safe;
              const tStat = stats.tierStats[tier];
              const passPct = tStat.total ? Math.round((tStat.pass / tStat.total) * 100) : 0;

              return (
                <div key={tier} className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${conf.dot}`} />
                      <span className="font-semibold text-xs text-slate-800">{conf.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">
                        通过率: <strong className={passPct >= 80 ? 'text-emerald-700' : 'text-rose-700'}>{passPct}%</strong>
                      </span>
                      <span className="text-slate-500">
                        样本数: <strong>{tStat.total}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[11px] pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-1">👨‍🏫 教师评审均分</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tStat.avgTeacherScore >= 70 ? 'bg-emerald-500' : tStat.avgTeacherScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${tStat.avgTeacherScore}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-800 w-8">{tStat.avgTeacherScore}分</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] mb-1">🧑‍🎓 学生评审均分</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tStat.studentCount === 0 ? 'bg-slate-300' : tStat.avgStudentScore >= 70 ? 'bg-purple-500' : tStat.avgStudentScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${tStat.studentCount > 0 ? tStat.avgStudentScore : 0}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-purple-700 w-8">
                          {tStat.studentCount > 0 ? `${tStat.avgStudentScore}分` : '待评'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Domain Distribution and Consistency breakdown */}
        <div className="space-y-6">
          {/* Domain Breakdown */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-900">四大内容安全领域题量分布</h3>
              </div>
              <span className="text-[11px] text-slate-500">共 {stats.totalQuestions} 道测试题</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['bias', 'porn', 'privacy', 'selfharm'] as const).map((dm) => {
                const conf = DOMAIN_CONFIG[dm];
                const count = stats.domainCount[dm] || 0;
                const pct = stats.totalQuestions > 0 ? Math.round((count / stats.totalQuestions) * 100) : 0;
                return (
                  <div key={dm} className={`p-3 rounded-lg border ${conf.color} space-y-1`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{conf.label}</span>
                      <span className="font-mono text-xs font-bold">{count} 题</span>
                    </div>
                    <div className="w-full bg-white/60 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-current h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] opacity-75 block text-right font-mono">{pct}% 占比</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consistency Insight */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">审核结论 (是否一致) 质检说明</h3>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed space-y-2 border border-slate-100">
              <p>
                • <strong>一致判定规则</strong>：对比上传数据中各回答附带的 <code>risk_level</code>（或 <code>label.risk_level</code>）与目标档位 <code>tier</code> 是否精准吻合。
              </p>
              <p>
                • <strong>质检现状</strong>：当前数据集中共有 <strong className="text-emerald-700 font-mono font-bold">{stats.consistentCount}</strong> 条样本与档位判定一致（{stats.consistentRate}%），存在 <strong className="text-rose-700 font-mono font-bold">{stats.inconsistentCount}</strong> 条冲突需复核。
              </p>
              <p className="text-[11px] text-slate-400">
                支持导入/上传时选择「教师模型评审」或「学生模型评审」，两者的评审配置标签格式完全对齐。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

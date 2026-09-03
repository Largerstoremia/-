import React, { useMemo } from 'react';
import { SafetyQuestionGroup, RiskTier, StudentEvalDimensions } from '../types';
import { TIER_CONFIG, DOMAIN_LABELS } from '../mockData';
import { RadarChart } from './RadarChart';
import {
  BarChart,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileCheck2,
  PieChart,
  Sliders,
  Scale
} from 'lucide-react';

interface DatasetAnalyticsProps {
  groups: SafetyQuestionGroup[];
}

export const DatasetAnalytics: React.FC<DatasetAnalyticsProps> = ({ groups }) => {
  const stats = useMemo(() => {
    let totalQuestions = groups.length;
    let totalAnswers = 0;
    let passCount = 0;

    const tierStats: Record<RiskTier, { total: number; pass: number; avgTeacherScore: number; avgStudentScore: number; avgWeight: number }> = {
      safe: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, avgWeight: 0 },
      low: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, avgWeight: 0 },
      medium: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, avgWeight: 0 },
      high: { total: 0, pass: 0, avgTeacherScore: 0, avgStudentScore: 0, avgWeight: 0 },
    };

    const domainCount: Record<string, number> = {};

    // Dimension accumulators for Safe and High tiers
    const safeDimsSum: Record<keyof StudentEvalDimensions, number> = {
      bias_fairness: 0,
      toxicity: 0,
      compliance_refusal: 0,
      helpfulness: 0,
      truthfulness: 0,
      robustness: 0,
    };
    let safeCount = 0;

    const highDimsSum: Record<keyof StudentEvalDimensions, number> = {
      bias_fairness: 0,
      toxicity: 0,
      compliance_refusal: 0,
      helpfulness: 0,
      truthfulness: 0,
      robustness: 0,
    };
    let highCount = 0;

    groups.forEach((g) => {
      domainCount[g.domain] = (domainCount[g.domain] || 0) + 1;

      (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((tier) => {
        const item = g.answers[tier];
        if (item) {
          totalAnswers++;
          tierStats[tier].total++;
          if (item.label.pass) {
            passCount++;
            tierStats[tier].pass++;
          }
          tierStats[tier].avgTeacherScore += item.label.score;
          tierStats[tier].avgStudentScore += item.student.student_score;
          tierStats[tier].avgWeight += item.student.training_weight;

          if (tier === 'safe') {
            safeCount++;
            Object.keys(safeDimsSum).forEach((k) => {
              const key = k as keyof StudentEvalDimensions;
              safeDimsSum[key] += item.student.dimensions[key] ?? 0;
            });
          } else if (tier === 'high') {
            highCount++;
            Object.keys(highDimsSum).forEach((k) => {
              const key = k as keyof StudentEvalDimensions;
              highDimsSum[key] += item.student.dimensions[key] ?? 0;
            });
          }
        }
      });
    });

    // Compute averages
    (['safe', 'low', 'medium', 'high'] as RiskTier[]).forEach((tier) => {
      const count = tierStats[tier].total || 1;
      tierStats[tier].avgTeacherScore = Math.round(tierStats[tier].avgTeacherScore / count);
      tierStats[tier].avgStudentScore = Math.round(tierStats[tier].avgStudentScore / count);
      tierStats[tier].avgWeight = Number((tierStats[tier].avgWeight / count).toFixed(2));
    });

    const safeAvgDims: StudentEvalDimensions = {
      bias_fairness: safeCount ? Math.round(safeDimsSum.bias_fairness / safeCount) : 95,
      toxicity: safeCount ? Math.round(safeDimsSum.toxicity / safeCount) : 98,
      compliance_refusal: safeCount ? Math.round(safeDimsSum.compliance_refusal / safeCount) : 97,
      helpfulness: safeCount ? Math.round(safeDimsSum.helpfulness / safeCount) : 92,
      truthfulness: safeCount ? Math.round(safeDimsSum.truthfulness / safeCount) : 98,
      robustness: safeCount ? Math.round(safeDimsSum.robustness / safeCount) : 96,
    };

    const highAvgDims: StudentEvalDimensions = {
      bias_fairness: highCount ? Math.round(highDimsSum.bias_fairness / highCount) : 25,
      toxicity: highCount ? Math.round(highDimsSum.toxicity / highCount) : 10,
      compliance_refusal: highCount ? Math.round(highDimsSum.compliance_refusal / highCount) : 8,
      helpfulness: highCount ? Math.round(highDimsSum.helpfulness / highCount) : 12,
      truthfulness: highCount ? Math.round(highDimsSum.truthfulness / highCount) : 15,
      robustness: highCount ? Math.round(highDimsSum.robustness / highCount) : 18,
    };

    return {
      totalQuestions,
      totalAnswers,
      overallPassRate: totalAnswers ? Math.round((passCount / totalAnswers) * 100) : 0,
      tierStats,
      domainCount,
      safeAvgDims,
      highAvgDims,
    };
  }, [groups]);

  return (
    <div className="space-y-6" id="dataset-analytics-dashboard">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">总评估问题数</span>
            <FileCheck2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{stats.totalQuestions}</span>
            <span className="text-xs text-slate-500">条核心Query</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span className="font-mono font-medium text-slate-700">{stats.totalAnswers}</span>
            <span>档独立模型回答样本</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">教师模型总合格率</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600">{stats.overallPassRate}%</span>
            <span className="text-xs text-slate-500">Safe/Low通过</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Medium/High全部严格拦截
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Safe档基线平均分</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{stats.tierStats.safe.avgTeacherScore}</span>
            <span className="text-xs text-emerald-600 font-medium">教师得分</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            学生预测均分: <span className="font-mono font-semibold text-slate-700">{stats.tierStats.safe.avgStudentScore}分</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">覆盖安全领域数</span>
            <PieChart className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{Object.keys(stats.domainCount).length}</span>
            <span className="text-xs text-slate-500">个合规类别</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            {Object.keys(stats.domainCount).slice(0, 3).join(', ')} 等
          </div>
        </div>
      </div>

      {/* Deep-dive 2-column Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Performance Comparison */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">四档答案各项核心指标对比</h3>
            </div>
            <span className="text-[11px] text-slate-500">教师标签 vs 学生训练设置</span>
          </div>

          <div className="space-y-3">
            {(['safe', 'low', 'medium', 'high'] as RiskTier[]).map((tier) => {
              const conf = TIER_CONFIG[tier];
              const tStat = stats.tierStats[tier];
              const passPct = tStat.total ? Math.round((tStat.pass / tStat.total) * 100) : 0;

              return (
                <div key={tier} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 space-y-2">
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

                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">教师评审均分</span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tStat.avgTeacherScore >= 70 ? 'bg-emerald-500' : tStat.avgTeacherScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${tStat.avgTeacherScore}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700">{tStat.avgTeacherScore}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">学生模型均分</span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tStat.avgStudentScore >= 70 ? 'bg-blue-500' : tStat.avgStudentScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${tStat.avgStudentScore}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700">{tStat.avgStudentScore}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">训练权重 / Loss倍率</span>
                      <span className="font-mono font-bold text-indigo-700 text-xs">{tStat.avgWeight}x</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Six-dimension Radar Comparison: Safe vs High */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">学生模型评测六维均值雷达图</h3>
            </div>
            <span className="text-[11px] text-slate-500">对比安全档与高危档差距</span>
          </div>

          <div className="flex flex-col items-center justify-center pt-2">
            <RadarChart
              data={stats.safeAvgDims}
              compareData={stats.highAvgDims}
              size={240}
              labelMain="Safe 安全档平均"
              labelCompare="High 高危档平均"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed border border-slate-200/70">
            <strong>安全评测洞察：</strong> Safe档在“无毒合规”、“真实客观”和“拒绝质量”上均值达97分以上；High档在毒性与遵从指标出现断崖式下跌，对应训练损失乘数加大（2.5~3.0x），并在DPO中设为最低偏好排位（Rank 4）。
          </div>
        </div>
      </div>
    </div>
  );
};

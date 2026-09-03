import { TierAnswerRecord, RiskTier, DomainType } from './types';

export const VALID_DOMAINS: DomainType[] = ['bias', 'porn', 'privacy', 'selfharm'];

/**
 * 将各种格式的风险级别归一化为标准的 safe | low | medium | high
 */
export function normalizeRiskLevel(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim().toLowerCase();
  if (s === 'safe' || s === '无风险' || s === '安全' || s === '无') return 'safe';
  if (s === 'low' || s === '低风险' || s === '低危' || s === '轻度') return 'low';
  if (s === 'medium' || s === 'med' || s === '中风险' || s === '中危' || s === '中度') return 'medium';
  if (s === 'high' || s === '高风险' || s === '高危' || s === '严重') return 'high';
  return s;
}

/**
 * 比较上传文件中的 risk_level 与条目的 tier 是否一致
 */
export function evaluateConsistency(record: TierAnswerRecord): {
  isConsistent: boolean;
  fileRiskLevel: string;
  tier: string;
  text: string;
  badgeClass: string;
} {
  // 文件中的 risk_level 可能存在于 record 根属性或者 record.label.risk_level
  const rawRisk = (record as any).risk_level || record.label?.risk_level || '';
  const normRisk = normalizeRiskLevel(rawRisk);
  const normTier = normalizeRiskLevel(record.tier);

  // 若存在有效比较值且匹配，则视为一致
  const isConsistent = Boolean(normRisk && normTier && normRisk === normTier);

  return {
    isConsistent,
    fileRiskLevel: rawRisk ? String(rawRisk) : '未指定',
    tier: record.tier,
    text: isConsistent ? '一致' : '不一致',
    badgeClass: isConsistent
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
      : 'bg-rose-50 text-rose-700 border-rose-300',
  };
}

/**
 * 映射领域为4个受支持领域之一: bias | porn | privacy | selfharm
 */
export function sanitizeDomain(rawDomain?: string): DomainType {
  if (!rawDomain) return 'bias';
  const d = rawDomain.trim().toLowerCase();
  if (d === 'porn' || d === '涉黄' || d === '色情' || d === 'nsfw' || d === 'erotic') return 'porn';
  if (d === 'privacy' || d === '隐私' || d === 'pii') return 'privacy';
  if (d === 'selfharm' || d === 'self-harm' || d === '自残' || d === '自杀' || d === 'toxic' || d === 'violence') return 'selfharm';
  if (d === 'bias' || d === '偏见' || d === '刻板印象') return 'bias';
  return 'bias';
}

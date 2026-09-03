export type RiskTier = 'safe' | 'low' | 'medium' | 'high';

export type DomainType = 'bias' | 'porn' | 'privacy' | 'selfharm';

export interface TeacherLabel {
  judge_name: string;
  score: number; // 0-100
  risk_level: RiskTier | string;
  pass: boolean;
  error_type: string;
  analysis: string;
  confidence: number; // 0.000 to 1.000
}

export interface StudentEvalDimensions {
  bias_fairness: number;      // 偏见与公平 (0-100)
  toxicity: number;           // 毒性与合规 (0-100, 越高越无毒/安全)
  compliance_refusal: number; // 遵从与拒绝质量 (0-100)
  helpfulness: number;        // 助人与实用性 (0-100)
  truthfulness: number;       // 真实性与客观度 (0-100)
  robustness: number;         // 鲁棒性与防诱导 (0-100)
}

export interface StudentModelConfig {
  training_weight: number;    // 训练样本权重 (如 1.0, 1.5, 0.8)
  loss_multiplier: number;    // 损失倍率 (如 1.0, 2.0)
  preference_rank: number;    // DPO/RLHF偏好排序 (1~4，1最高)
  dimensions: StudentEvalDimensions;
  student_score: number;      // 学生模型综合测评得分 (0-100)
  student_pred_risk: RiskTier;// 学生模型预测风险档位
}

export interface TierAnswerRecord {
  id: string;                 // e.g. "bias-0000-low"
  qid: string;                // e.g. "bias-0000"
  domain: string;             // e.g. "bias"
  question: string;
  answer: string;
  answer_type: string;        // e.g. "pure_safe", "gray", "borderline", "violating"
  tier: RiskTier;             // safe | low | medium | high
  risk_level?: string;        // 上传文件指定的风险级别 (用于与 tier 比较一致性)
  label: TeacherLabel;
  student: StudentModelConfig;
}

export interface SafetyQuestionGroup {
  qid: string;
  domain: string;
  question: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  answers: Record<RiskTier, TierAnswerRecord>;
}

export interface FilterState {
  search: string;
  domain: string;
  tier: string;
  consistencyStatus: string;  // 'all' | 'consistent' | 'inconsistent'
  passStatus?: string;
  minScore: number;
}

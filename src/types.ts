export type RiskTier = 'safe' | 'low' | 'medium' | 'high';

export type DomainType = 'bias' | 'porn' | 'privacy' | 'selfharm';

export type UploadRoleTarget = 'teacher' | 'student';

// 统一的评审标签配置格式（教师与学生评测标签结构完全一致，仅具体数值与分析可能不同）
export interface ModelEvaluationLabel {
  judge_name: string;
  score: number; // 0-100
  risk_level: RiskTier | string;
  pass: boolean;
  error_type: string;
  analysis: string;
  confidence?: number; // 0.000 to 1.000
}

// 保持 TeacherLabel 兼容别名
export type TeacherLabel = ModelEvaluationLabel;

export interface TierAnswerRecord {
  id: string;                 // e.g. "bias-0098-medium"
  qid: string;                // e.g. "bias-0098"
  domain: string;             // e.g. "bias"
  question: string;
  answer: string;
  answer_type: string;        // e.g. "safe", "unsafe", "gray"
  tier: RiskTier;             // safe | low | medium | high
  risk_level?: string;        // 上传文件指定的风险级别 (用于与 tier 比较一致性)
  label: ModelEvaluationLabel; // 默认/教师模型评审标签
  teacher_label?: ModelEvaluationLabel; // 显式教师评审标签
  student_label?: ModelEvaluationLabel; // 学生模型评审标签 (与教师标签格式完全相同)
  student?: any;              // 兼容旧字段
  _rewritten?: boolean;
}

export interface SafetyQuestionGroup {
  qid: string;
  domain: string;
  question: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  answers: Record<RiskTier, TierAnswerRecord>;
}

export interface StudentEvalDimensions {
  bias_fairness: number;
  toxicity: number;
  compliance_refusal: number;
  helpfulness: number;
  truthfulness: number;
  robustness: number;
}

export interface FilterState {
  search: string;
  domain: string;
  tier: string;
  consistencyStatus: string;  // 'all' | 'consistent' | 'inconsistent'
  hasStudentEval?: string;    // 'all' | 'has_student' | 'no_student'
  minScore: number;
}

export interface ExportFilterOptions {
  consistencyStatus: 'all' | 'consistent' | 'inconsistent';
  selectedTiers: RiskTier[];
  domain: string;
  passStatus: 'all' | 'pass' | 'fail';
  rewrittenStatus: 'all' | 'rewritten' | 'original';
  scope: 'all' | 'selected';
  search: string;
}

// 云端数据集同步 API 封装:读写 /api/sync-data(Vercel Function 代理 GitHub data/dataset.json)
import type { SafetyQuestionGroup } from './types';

export interface RemoteSnapshot {
  groups: SafetyQuestionGroup[] | null; // null = 远端无文件
  sha: string | null;
}

export async function fetchRemote(): Promise<RemoteSnapshot | null> {
  try {
    const res = await fetch('/api/sync-data', { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface PutResult {
  ok: boolean;
  sha?: string | null;
}

export async function putRemote(
  groups: SafetyQuestionGroup[],
  sha: string | null
): Promise<PutResult> {
  try {
    const res = await fetch('/api/sync-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups, sha }),
    });
    if (!res.ok) return { ok: false };
    const j = await res.json();
    return { ok: true, sha: j.sha };
  } catch {
    return { ok: false };
  }
}

// Vercel Serverless Function: 读写 GitHub 仓库内的 data/dataset.json
// 前端不持 token,只经本函数代理;数据以 commit 形式写回仓库,天然可 git 回溯。
// 用原生 req/res + 全局 fetch,避免额外依赖 (Vercel Node 运行时自带)。

const OWNER = process.env.GITHUB_OWNER || 'Largerstoremia';
const REPO = process.env.GITHUB_REPO || 'safe';
const DB_PATH = process.env.DB_PATH || 'data/dataset.json';
const TOKEN = process.env.GH_TOKEN || '';

const GH = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DB_PATH}`;

function ghHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readFile() {
  const res = await fetch(GH, { headers: ghHeaders() });
  if (res.status === 404) return { exists: false, sha: null, groups: null } as const;
  if (!res.ok) throw new Error(`github read ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text = Buffer.from(j.content, 'base64').toString('utf8');
  let groups: unknown = null;
  try {
    groups = JSON.parse(text);
  } catch {
    // 文件内容非 JSON(半成品/测试):按"无有效数据"处理,允许下次写覆盖
    return { exists: false, sha: null, groups: null } as const;
  }
  return { exists: true, sha: j.sha as string, groups };
}

async function writeFile(content: string, sha: string | null) {
  const body: Record<string, unknown> = {
    message: `data: update dataset (${new Date().toISOString()})`,
    content: Buffer.from(content, 'utf8').toString('base64'),
  };
  if (sha) body.sha = sha;
  const res = await fetch(GH, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    return { ok: false as const, status: res.status, detail: err };
  }
  const j = await res.json();
  return { ok: true as const, sha: j.content?.sha as string | undefined };
}

// 带一次 409 自动重试的写入:拿到最新 sha 后覆盖(单用户后写覆盖语义)
async function upsert(groups: unknown) {
  const payload = JSON.stringify(groups, null, 2) + '\n';
  const cur = await readFile();
  if (cur.exists && cur.groups !== null && !Array.isArray(cur.groups)) {
    return { ok: false as const, status: 500 as const, detail: 'dataset 结构异常' };
  }
  const first = await writeFile(payload, cur.exists ? cur.sha : null);
  if (first.ok) return { ok: true as const, sha: first.sha };
  if (first.status === 409) {
    const latest = await readFile();
    if (!latest.exists) return { ok: false as const, status: 409 as const, detail: first.detail };
    const second = await writeFile(payload, latest.sha);
    if (second.ok) return { ok: true as const, sha: second.sha };
    return { ok: false as const, status: second.status as number, detail: second.detail };
  }
  return { ok: false as const, status: first.status as number, detail: first.detail };
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (data: unknown) => void };
  }
) {
  if (!TOKEN) {
    res.status(500).json({ error: 'GH_TOKEN 未配置' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const cur = await readFile();
      res.status(200).json({ groups: cur.groups, sha: cur.sha });
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = (req.body || {}) as { groups?: unknown };
      if (!Array.isArray(body.groups)) {
        res.status(400).json({ error: 'groups 必须是数组' });
        return;
      }
      const result = await upsert(body.groups);
      if (!result.ok) {
        res.status(result.status).json({ error: result.detail });
        return;
      }
      res.status(200).json({ ok: true, sha: result.sha });
      return;
    }
    res.status(405).json({ error: '仅支持 GET/PUT' });
  } catch (e) {
    res.status(500).json({ error: String((e as Error)?.message || e) });
  }
}

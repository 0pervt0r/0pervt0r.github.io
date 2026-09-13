// supabase/functions/save-article/index.ts
//
// Эта функция — единственное место, где "живёт" GitHub-токен.
// Она получает от сайта JSON статьи, проверяет, что пользователь — редактор,
// и коммитит файл articles/{slug}.json в GitHub-репозиторий от имени бота.
//
// Секреты (задаются один раз командой `supabase secrets set`, см. SETUP.md):
//   GITHUB_TOKEN   — personal access token с правом Contents: Read & write
//   GITHUB_OWNER   — владелец репозитория, например "0pervt0r"
//   GITHUB_REPO    — имя репозитория, например "0pervt0r.github.io"
//   GITHUB_BRANCH  — ветка, обычно "main"
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — подставляются Supabase автоматически

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;
const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER')!;
const GITHUB_REPO = Deno.env.get('GITHUB_REPO')!;
const GITHUB_BRANCH = Deno.env.get('GITHUB_BRANCH') ?? 'main';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function slugify(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function getExistingSha(filePath: string): Promise<string | null> {
  const res = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${filePath}: ${res.status}`);
  const data = await res.json();
  return data.sha as string;
}

function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function commitFile(filePath: string, contentText: string, message: string) {
  const sha = await getExistingSha(filePath);
  const res = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: base64EncodeUtf8(contentText),
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub PUT ${filePath}: ${res.status} ${errBody}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // --- 1. Проверяем, кто вызывает функцию ---
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return jsonResponse({ error: 'no_auth' }, 401);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'invalid_session' }, 401);
  }
  const userId = userData.user.id;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_editor')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.is_editor) {
    return jsonResponse({ error: 'not_an_editor' }, 403);
  }

  // --- 2. Разбираем тело запроса ---
  let payload: {
    slug?: string;
    title: string;
    description?: string;
    section?: string;
    requiredClearance?: number;
    status?: 'draft' | 'published';
    blocks: unknown[];
    personnel?: {
      department?: string | null;
      rankTier?: string;
      gender?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      birthDate?: string | null;
      crimes?: string | null;
      avatarUrl?: string | null;
      status?: 'active' | 'missing';
    };
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'bad_json' }, 400);
  }

  if (!payload.title || !Array.isArray(payload.blocks)) {
    return jsonResponse({ error: 'missing_fields' }, 400);
  }

  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.title);
  if (!slug) return jsonResponse({ error: 'bad_slug' }, 400);

  const filePath = `articles/${slug}.json`;
  const fileContent = JSON.stringify(
    { title: payload.title, blocks: payload.blocks },
    null,
    2,
  );

  // --- 3. Коммитим в GitHub ---
  try {
    await commitFile(filePath, fileContent, `Статья: ${payload.title}`);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: 'github_failed', detail: String(err) }, 502);
  }

  // --- 4. Обновляем метаданные в Supabase ---
  // section добавляем в объект только если он реально передан с фронта —
  // иначе при апдейте существующей статьи он бы затирался на null.
  const articleRow: Record<string, unknown> = {
    slug,
    title: payload.title,
    description: payload.description ?? null,
    author_id: userId,
    required_clearance: payload.requiredClearance ?? 0,
    status: payload.status ?? 'published',
    updated_at: new Date().toISOString(),
  };
  if (payload.section) articleRow.section = payload.section;

  const { data: articleRowResult, error: upsertError } = await supabaseAdmin
    .from('articles')
    .upsert(articleRow, { onConflict: 'slug' })
    .select('id')
    .single();

  if (upsertError) {
    console.error(upsertError);
    return jsonResponse({ error: 'db_failed', detail: upsertError.message }, 500);
  }

  // --- 5. Структурные поля персоналии/заключённого (если это они) ---
  if (payload.personnel) {
    const p = payload.personnel;
    const { error: personnelError } = await supabaseAdmin
      .from('personnel_details')
      .upsert({
        article_id: articleRowResult.id,
        department: p.department ?? null,
        rank_tier: p.rankTier ?? 'low',
        gender: p.gender ?? null,
        height_cm: p.heightCm ?? null,
        weight_kg: p.weightKg ?? null,
        birth_date: p.birthDate ?? null,
        crimes: p.crimes ?? null,
        avatar_url: p.avatarUrl ?? null,
        status: p.status ?? 'active',
      }, { onConflict: 'article_id' });

    if (personnelError) {
      console.error(personnelError);
      return jsonResponse({ error: 'personnel_db_failed', detail: personnelError.message }, 500);
    }
  }

  return jsonResponse({ ok: true, slug });
});

// ============================================================
// NEXT STAGE TALENT — SUPABASE ADAPTER
// Replaces the Python server API with Supabase calls.
// Keeps the same apiFetch({ ok, data }) shape so every page
// works without any other changes.
// ============================================================

const SUPABASE_URL = 'https://qibdsiirzhfkpkyznfys.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2kYikvy29rc9845zr8J26A_jYNUyM4t';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Override apiFetch ────────────────────────────────────────
// Maps old Python API paths to Supabase table queries.
// Must be loaded AFTER main.js so it overrides the original.

async function apiFetch(path, options = {}) {

  // ── POST requests (form submissions) ──────────────────────
  if (options.method === 'POST') {
    let table = null;
    let body  = {};
    try { body = JSON.parse(options.body || '{}'); } catch(e) {}

    if (path === '/api/contact')      table = 'nst_contacts';
    if (path === '/api/apply')        table = 'nst_applications';
    if (path === '/api/register')     table = 'nst_talent_register';

    if (table) {
      const { error } = await db.from(table).insert([body]);
      if (error) return { ok: false, data: { error: error.message }, status: 500 };
      return { ok: true, data: {}, status: 200 };
    }
    // Unknown POST — passthrough (should not happen)
    return { ok: false, data: { error: 'Unknown endpoint' }, status: 404 };
  }

  // ── GET requests ───────────────────────────────────────────

  // /api/talent?featured=1  or  /api/talent
  if (path.startsWith('/api/talent')) {
    const idMatch = path.match(/\/api\/talent\/(\d+)/);
    if (idMatch) {
      const { data, error } = await db.from('nst_talent').select('*').eq('id', idMatch[1]).single();
      if (error) return { ok: false, data: {}, status: 404 };
      return { ok: true, data, status: 200 };
    }
    const featured = path.includes('featured=1');
    let query = db.from('nst_talent').select('*').order('created_at', { ascending: false });
    if (featured) query = query.eq('featured', true);
    const { data, error } = await query;
    if (error) return { ok: false, data: [], status: 500 };
    return { ok: true, data: data || [], status: 200 };
  }

  // /api/jobs  or  /api/jobs/:id
  if (path.startsWith('/api/jobs')) {
    const idMatch = path.match(/\/api\/jobs\/(\d+)/);
    if (idMatch) {
      const { data, error } = await db.from('nst_jobs').select('*').eq('id', idMatch[1]).single();
      if (error) return { ok: false, data: {}, status: 404 };
      return { ok: true, data, status: 200 };
    }
    const { data, error } = await db.from('nst_jobs').select('*').order('created_at', { ascending: false });
    if (error) return { ok: false, data: [], status: 500 };
    return { ok: true, data: data || [], status: 200 };
  }

  // /api/success-stories  or  /api/success-stories/:id
  if (path.startsWith('/api/success-stories')) {
    const idMatch = path.match(/\/api\/success-stories\/(\d+)/);
    if (idMatch) {
      const { data, error } = await db.from('nst_success_stories').select('*').eq('id', idMatch[1]).single();
      if (error) return { ok: false, data: {}, status: 404 };
      return { ok: true, data, status: 200 };
    }
    const { data, error } = await db.from('nst_success_stories').select('*').order('created_at', { ascending: false });
    if (error) return { ok: false, data: [], status: 500 };
    return { ok: true, data: data || [], status: 200 };
  }

  // /api/testimonials
  if (path.startsWith('/api/testimonials')) {
    const { data, error } = await db.from('nst_testimonials').select('*').order('created_at', { ascending: false });
    if (error) return { ok: false, data: [], status: 500 };
    return { ok: true, data: data || [], status: 200 };
  }

  // /api/faqs
  if (path.startsWith('/api/faqs')) {
    const { data, error } = await db.from('nst_faqs').select('*').order('sort_order', { ascending: true });
    if (error) return { ok: false, data: [], status: 500 };
    return { ok: true, data: data || [], status: 200 };
  }

  // /api/blog
  if (path.startsWith('/api/blog')) {
    const slugMatch = path.match(/\/api\/blog\/([^?]+)/);
    if (slugMatch) {
      const { data, error } = await db.from('nst_blog_posts').select('*').eq('slug', slugMatch[1]).single();
      if (error) return { ok: false, data: {}, status: 404 };
      return { ok: true, data, status: 200 };
    }
    const { data, error } = await db.from('nst_blog_posts').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error) return { ok: false, data: [], status: 500 };
    return { ok: true, data: data || [], status: 200 };
  }

  // Unknown GET
  return { ok: false, data: [], status: 404 };
}

// ── Insert helper for forms not using apiFetch ───────────────
async function nstInsert(table, row) {
  const { error } = await db.from(table).insert([row]);
  return !error;
}

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

// ── Apply form (apply.html calls fetch('/api/apply') directly) ──
// There is no server any more, so these two calls are answered here:
//   POST /api/apply            → saves the application, returns { application_id }
//   POST /api/apply/documents  → uploads one photo/CV and links it to the application
(function () {
  const _fetch = window.fetch.bind(window);
  const MAP = {
    firstName: 'first_name', lastName: 'last_name', dob: 'dob', age: 'age', mobile: 'mobile',
    landline: 'landline', email: 'email', sex: 'sex', nationality: 'nationality',
    ethnicOrigin: 'ethnic_origin', address: 'address', postcode: 'postcode', website: 'website',
    socialMedia: 'social_media', spotlightPin: 'spotlight_pin', equityNumber: 'equity_number',
    currentEmployment: 'current_employment', availability: 'availability', height: 'height',
    weight: 'weight', bustChest: 'bust_chest', waist: 'waist', hips: 'hips', shoeSize: 'shoe_size',
    eyeColor: 'eye_color', hairColor: 'hair_color', complexion: 'complexion',
    suitDressSize: 'suit_dress_size', languages: 'languages', experience: 'experience',
    hasPortfolio: 'has_portfolio', otherAgency: 'other_agency', otherAgencyName: 'other_agency_name',
    additionalInfo: 'additional_info', imdbLink: 'imdb_link', signatureDataURL: 'signature',
    source: 'source'
  };
  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = ((init && init.method) || 'GET').toUpperCase();
    try {
      if (method === 'POST' && (url === '/api/apply' || url.endsWith('/api/apply'))) {
        let d = {};
        try { d = JSON.parse(init.body || '{}'); } catch (e) {}
        d = d.formData || d;
        const p = {};
        Object.keys(MAP).forEach(function (k) {
          if (d[k] !== undefined && d[k] !== null && d[k] !== '') p[MAP[k]] = String(d[k]);
        });
        p.skills = JSON.stringify(d.skills || {});
        p.interests = JSON.stringify(d.interests || []);
        const { data, error } = await db.rpc('nst_submit_application', { p: p });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, application_id: data });
      }
      if (method === 'POST' && (url === '/api/apply/documents' || url.endsWith('/api/apply/documents'))) {
        const fd = init && init.body;
        if (!(fd instanceof FormData)) return json({ error: 'Expected FormData' }, 400);
        const appId = parseInt(fd.get('application_id'), 10);
        const file = fd.get('file');
        if (!appId || !file) return json({ error: 'Missing file' }, 400);
        const safe = String(file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_');
        const path = 'applications/' + appId + '/' + Date.now() + '_' + safe;
        const up = await db.storage.from('nst-uploads').upload(path, file, { upsert: false });
        if (up.error) return json({ error: up.error.message }, 500);
        const publicUrl = db.storage.from('nst-uploads').getPublicUrl(path).data.publicUrl;
        const { error } = await db.rpc('nst_add_application_document', {
          p_application_id: appId, p_filename: file.name, p_file_url: publicUrl,
          p_file_type: file.type || '', p_file_size: file.size || 0
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
    } catch (err) {
      return json({ error: String(err && err.message || err) }, 500);
    }
    return _fetch(input, init);
  };
})();

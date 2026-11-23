// ============================================================
// NST ADMIN — SUPABASE ADAPTER
// Intercepts all fetch('/api/...') calls from dashboard.html
// and routes them to Supabase instead of the Python server.
// Load this AFTER the Supabase CDN script, BEFORE dashboard JS.
// ============================================================

(function () {
  'use strict';

  const SUPABASE_URL = 'https://qibdsiirzhfkpkyznfys.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_2kYikvy29rc9845zr8J26A_jYNUyM4t';
  const ADMIN_PASSWORD_HASH_KEY = 'nst_admin_pwdhash';
  const ADMIN_SESSION_KEY = 'nst_admin_session';
  const SESSION_HOURS = 12;

  // ── Supabase client ─────────────────────────────────────────
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Storage helper ──────────────────────────────────────────
  async function uploadFile(bucket, path, file) {
    const { data, error } = await db.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return null;
    const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }

  // ── Simple SHA-256 hash ─────────────────────────────────────
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Auth (Supabase Auth + nst_admins) ───────────────────
  // Logging in uses a real Supabase account. Typing just "admin"
  // as the username signs in as admin@nextstagetalent.co.uk.
  const ADMIN_EMAIL_DOMAIN = 'nextstagetalent.co.uk';
  function toEmail(user) {
    user = String(user || '').trim().toLowerCase();
    return user.includes('@') ? user : (user + '@' + ADMIN_EMAIL_DOMAIN);
  }
  async function isAdmin() {
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session) return false;
      const { data, error } = await db.rpc('nst_is_admin');
      return !error && data === true;
    } catch (e) { return false; }
  }

  // ── Auth guard on dashboard pages ───────────────────────────
  if (window.location.pathname.includes('dashboard')) {
    document.documentElement.style.visibility = 'hidden';
    isAdmin().then(function (ok) {
      if (!ok) window.location.replace('/admin/login.html');
      else document.documentElement.style.visibility = '';
    });
  }

  // ── Build a fake Response-like object ───────────────────────
  function fakeResp(body, status) {
    status = status || 200;
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(bodyStr, {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── CSV helpers ─────────────────────────────────────────────
  function toCSV(rows, cols) {
    if (!rows || !rows.length) return '';
    const header = cols || Object.keys(rows[0]);
    const lines = [header.join(',')];
    rows.forEach(r => {
      lines.push(header.map(c => '"' + String(r[c] != null ? r[c] : '').replace(/"/g, '""') + '"').join(','));
    });
    return lines.join('\n');
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return fakeResp({ ok: true });
  }

  // ── The original fetch ───────────────────────────────────────
  const _origFetch = window.fetch.bind(window);

  // ── Main interceptor ─────────────────────────────────────────
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input.url || '';
    const method = (init && init.method || 'GET').toUpperCase();

    // Only intercept relative /api/ paths
    if (!url.startsWith('/api/')) return _origFetch(input, init);

    const path = url.split('?')[0];
    const qs   = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
    let body = {};
    if (init && init.body) {
      if (typeof init.body === 'string') {
        try { body = JSON.parse(init.body); } catch (e) { body = {}; }
      } else if (init.body instanceof FormData) {
        body = init.body; // handled per-route
      }
    }

    try {
      return await route(path, method, body, qs, init);
    } catch (err) {
      console.error('[supabase-admin] fetch error', url, err);
      return fakeResp({ error: String(err) }, 500);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ROUTER
  // ═══════════════════════════════════════════════════════════
  async function route(path, method, body, qs, init) {

    // ── AUTH ──────────────────────────────────────────────────
    if (path === '/api/admin/check') {
      return fakeResp({ authenticated: await isAdmin() });
    }

    if (path === '/api/admin/login') {
      const { password } = body;
      const username = body.username || body.email || 'admin';
      if (!password) return fakeResp({ error: 'No password' }, 400);
      const { error } = await db.auth.signInWithPassword({ email: toEmail(username), password });
      if (error) return fakeResp({ error: 'Invalid username or password' }, 401);
      if (!(await isAdmin())) {
        await db.auth.signOut();
        return fakeResp({ error: 'This account is not an NST admin' }, 403);
      }
      return fakeResp({ ok: true });
    }

    if (path === '/api/admin/logout') {
      await db.auth.signOut();
      return fakeResp({ ok: true });
    }

    if (path === '/api/admin/change-password') {
      const { new_password } = body;
      if (!new_password || String(new_password).length < 8) return fakeResp({ error: 'Password must be at least 8 characters' }, 400);
      if (!(await isAdmin())) return fakeResp({ error: 'Please log in again' }, 401);
      const { error } = await db.auth.updateUser({ password: new_password });
      if (error) return fakeResp({ error: error.message }, 400);
      return fakeResp({ ok: true });
    }

    // ── DASHBOARD STATS ───────────────────────────────────────
    if (path === '/api/dashboard') {
      const [talent, contacts, apps, leads, jobs, blog] = await Promise.all([
        db.from('nst_talent').select('*', { count: 'exact', head: true }),
        db.from('nst_contacts').select('*', { count: 'exact', head: true }),
        db.from('nst_applications').select('*', { count: 'exact', head: true }),
        db.from('nst_leads').select('*', { count: 'exact', head: true }),
        db.from('nst_jobs').select('*', { count: 'exact', head: true }),
        db.from('nst_blog_posts').select('*', { count: 'exact', head: true }),
      ]);
      return fakeResp({
        talent_count: talent.count || 0,
        contact_count: contacts.count || 0,
        application_count: apps.count || 0,
        leads_count: leads.count || 0,
        jobs_count: jobs.count || 0,
        blog_count: blog.count || 0,
      });
    }

    // ── TALENT ────────────────────────────────────────────────
    if (path === '/api/talent') {
      if (method === 'GET') {
        let q = db.from('nst_talent').select('*').order('created_at', { ascending: false });
        if (qs.get('featured') === '1') q = q.eq('featured', true);
        const { data, error } = await q;
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        // May have file upload (FormData)
        const row = await extractTalentRow(body, init);
        const { data, error } = await db.from('nst_talent').insert([row]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const talentIdMatch = path.match(/^\/api\/talent\/(\d+)(\/(.+))?$/);
    if (talentIdMatch) {
      const id = parseInt(talentIdMatch[1]);
      const sub = talentIdMatch[3];
      if (sub === 'feature') {
        // Toggle featured
        const { data: cur } = await db.from('nst_talent').select('featured').eq('id', id).single();
        const newFeat = !(cur && cur.featured);
        const { error } = await db.from('nst_talent').update({ featured: newFeat }).eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ featured: newFeat });
      }
      if (method === 'GET') {
        const { data, error } = await db.from('nst_talent').select('*').eq('id', id).single();
        if (error) return fakeResp({ error: 'Not found' }, 404);
        return fakeResp(data);
      }
      if (method === 'PUT') {
        const row = await extractTalentRow(body, init);
        const { data, error } = await db.from('nst_talent').update(row).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_talent').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── SUCCESS STORIES ───────────────────────────────────────
    if (path === '/api/success-stories') {
      if (method === 'GET') {
        const { data, error } = await db.from('nst_success_stories').select('*').order('created_at', { ascending: false });
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        const row = await extractStoryRow(body, init);
        const { data, error } = await db.from('nst_success_stories').insert([row]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const storyIdMatch = path.match(/^\/api\/success-stories\/(\d+)$/);
    if (storyIdMatch) {
      const id = parseInt(storyIdMatch[1]);
      if (method === 'PUT') {
        const row = await extractStoryRow(body, init);
        const { data, error } = await db.from('nst_success_stories').update(row).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_success_stories').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── TESTIMONIALS ──────────────────────────────────────────
    if (path === '/api/testimonials') {
      if (method === 'GET') {
        const { data, error } = await db.from('nst_testimonials').select('*').order('created_at', { ascending: false });
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        const row = await extractTestimonialRow(body, init);
        const { data, error } = await db.from('nst_testimonials').insert([row]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const testIdMatch = path.match(/^\/api\/testimonials\/(\d+)$/);
    if (testIdMatch) {
      const id = parseInt(testIdMatch[1]);
      if (method === 'PUT') {
        const row = await extractTestimonialRow(body, init);
        const { data, error } = await db.from('nst_testimonials').update(row).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_testimonials').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── JOBS ──────────────────────────────────────────────────
    if (path === '/api/jobs') {
      if (method === 'GET') {
        const { data, error } = await db.from('nst_jobs').select('*').order('created_at', { ascending: false });
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        const { data, error } = await db.from('nst_jobs').insert([body]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const jobIdMatch = path.match(/^\/api\/jobs\/(\d+)$/);
    if (jobIdMatch) {
      const id = parseInt(jobIdMatch[1]);
      if (method === 'GET') {
        const { data, error } = await db.from('nst_jobs').select('*').eq('id', id).single();
        if (error) return fakeResp({ error: 'Not found' }, 404);
        return fakeResp(data);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const { data, error } = await db.from('nst_jobs').update(body).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_jobs').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── FAQS ──────────────────────────────────────────────────
    if (path === '/api/faqs') {
      if (method === 'GET') {
        const { data, error } = await db.from('nst_faqs').select('*').order('sort_order', { ascending: true });
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        const { data, error } = await db.from('nst_faqs').insert([body]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const faqIdMatch = path.match(/^\/api\/faqs\/(\d+)$/);
    if (faqIdMatch) {
      const id = parseInt(faqIdMatch[1]);
      if (method === 'PUT') {
        const { data, error } = await db.from('nst_faqs').update(body).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_faqs').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── CONTACTS ──────────────────────────────────────────────
    if (path === '/api/contacts') {
      const { data, error } = await db.from('nst_contacts').select('*').order('created_at', { ascending: false });
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp(data || []);
    }

    if (path === '/api/contact') {
      const { error } = await db.from('nst_contacts').insert([body]);
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp({ ok: true });
    }

    // ── APPLICATIONS ──────────────────────────────────────────
    if (path === '/api/applications') {
      if (method === 'GET') {
        const page  = parseInt(qs.get('page')  || '1');
        const limit = parseInt(qs.get('limit') || '20');
        const q     = (qs.get('q') || '').trim();
        const from  = (page - 1) * limit;
        let query = db.from('nst_applications').select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + limit - 1);
        if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
        const { data, error, count } = await query;
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ applications: data || [], total: count || 0, page, limit });
      }
      if (method === 'POST') {
        const { error } = await db.from('nst_applications').insert([body]);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true }, 201);
      }
    }

    const appIdMatch = path.match(/^\/api\/applications\/(\d+)(\/documents)?$/);
    if (appIdMatch) {
      const id  = parseInt(appIdMatch[1]);
      const sub = appIdMatch[2];

      if (sub === '/documents') {
        if (method === 'GET') {
          const { data, error } = await db.from('nst_documents').select('*').eq('application_id', id).order('created_at', { ascending: false });
          if (error) return fakeResp({ error: error.message }, 500);
          return fakeResp(data || []);
        }
        if (method === 'POST') {
          // FormData file upload
          const fd = init && init.body;
          if (fd instanceof FormData) {
            const file = fd.get('document');
            if (!file) return fakeResp({ error: 'No file' }, 400);
            const ext  = file.name.split('.').pop();
            const fp   = `applications/${id}/${Date.now()}_${file.name}`;
            const url  = await uploadFile('nst-uploads', fp, file);
            if (!url) return fakeResp({ error: 'Upload failed' }, 500);
            const row  = { application_id: id, filename: file.name, file_url: url, file_type: file.type, file_size: file.size };
            const { data, error } = await db.from('nst_documents').insert([row]).select().single();
            if (error) return fakeResp({ error: error.message }, 500);
            return fakeResp(data, 201);
          }
          return fakeResp({ error: 'Expected FormData' }, 400);
        }
      }

      // Single application
      if (method === 'GET') {
        const { data, error } = await db.from('nst_applications').select('*').eq('id', id).single();
        if (error) return fakeResp({ error: 'Not found' }, 404);
        return fakeResp(data);
      }
      if (method === 'PUT') {
        const { data, error } = await db.from('nst_applications').update(body).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_applications').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── DOCUMENT DELETE ───────────────────────────────────────
    const docIdMatch = path.match(/^\/api\/documents\/(\d+)$/);
    if (docIdMatch) {
      const id = parseInt(docIdMatch[1]);
      if (method === 'DELETE') {
        const { error } = await db.from('nst_documents').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── BLOG (ADMIN) ──────────────────────────────────────────
    if (path === '/api/admin/blog') {
      if (method === 'GET') {
        const { data, error } = await db.from('nst_blog_posts').select('*').order('created_at', { ascending: false });
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        // Create new post — may have FormData with cover image
        const row = await extractBlogRow(body, init);
        const { data, error } = await db.from('nst_blog_posts').insert([row]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const blogAdminMatch = path.match(/^\/api\/admin\/blog\/(\d+)\/(edit|toggle|delete)$/);
    if (blogAdminMatch) {
      const id  = parseInt(blogAdminMatch[1]);
      const sub = blogAdminMatch[2];

      if (sub === 'edit') {
        const row = await extractBlogRow(body, init);
        const { data, error } = await db.from('nst_blog_posts').update(row).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (sub === 'toggle') {
        const { data: cur } = await db.from('nst_blog_posts').select('published').eq('id', id).single();
        const newPub = !(cur && cur.published);
        const { error } = await db.from('nst_blog_posts').update({ published: newPub }).eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ published: newPub });
      }
      if (sub === 'delete') {
        const { error } = await db.from('nst_blog_posts').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── LEADS ─────────────────────────────────────────────────
    if (path === '/api/leads/stats') {
      const progressStatuses = ['Called','No Answer','Interview Scheduled','Final Interview','Interview Done','2nd Interview','Confirm','Interview Confirm'];
      const [total, newCount, progress, booked] = await Promise.all([
        db.from('nst_leads').select('*', { count: 'exact', head: true }),
        db.from('nst_leads').select('*', { count: 'exact', head: true }).eq('status', 'New'),
        db.from('nst_leads').select('*', { count: 'exact', head: true }).in('status', progressStatuses),
        db.from('nst_leads').select('*', { count: 'exact', head: true }).eq('status', 'Shoot Booked'),
      ]);
      return fakeResp({
        total:    total.count || 0,
        new:      newCount.count || 0,
        progress: progress.count || 0,
        booked:   booked.count || 0,
      });
    }

    if (path === '/api/leads/send-invite') {
      // No email server — just mark as Invited
      const { id } = body;
      const { data: lead } = await db.from('nst_leads').select('full_name,email').eq('id', id).single();
      const { error } = await db.from('nst_leads').update({ invite_status: 'Invited' }).eq('id', id);
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp({ success: true, email: (lead && lead.email) || 'unknown' });
    }

    if (path === '/api/leads/bulk-invite') {
      const { ids } = body;
      if (!ids || !ids.length) return fakeResp({ sent: 0, skipped: 0 });
      const { data: leads } = await db.from('nst_leads').select('id,email').in('id', ids);
      const withEmail = (leads || []).filter(l => l.email);
      const noEmail   = (leads || []).filter(l => !l.email);
      if (withEmail.length) {
        await db.from('nst_leads').update({ invite_status: 'Invited' }).in('id', withEmail.map(l => l.id));
      }
      return fakeResp({ success: true, sent: withEmail.length, skipped: noEmail.length });
    }

    if (path === '/api/leads/update') {
      // Update lead by id included in body
      const { id, ...rest } = body;
      if (!id) return fakeResp({ error: 'No id' }, 400);
      const { data, error } = await db.from('nst_leads').update(rest).eq('id', id).select().single();
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp(data);
    }

    if (path === '/api/leads') {
      if (method === 'GET') {
        const page   = parseInt(qs.get('page')   || '1');
        const limit  = parseInt(qs.get('limit')  || '100');
        const q      = (qs.get('q')      || '').trim();
        const status = (qs.get('status') || '').trim();
        const invite = (qs.get('invite') || '').trim();
        const sort   = qs.get('sort') || 'newest';
        const from   = (page - 1) * limit;

        let query = db.from('nst_leads').select('*', { count: 'exact' }).range(from, from + limit - 1);
        if (sort === 'newest') query = query.order('created_at', { ascending: false });
        else if (sort === 'oldest') query = query.order('created_at', { ascending: true });
        else if (sort === 'name')   query = query.order('full_name',  { ascending: true });
        if (status) query = query.eq('status', status);
        if (invite === 'invited')     query = query.eq('invite_status', 'Invited');
        if (invite === 'not_invited') query = query.neq('invite_status', 'Invited');
        if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

        const { data, error, count } = await query;
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ leads: data || [], total: count || 0 });
      }
      if (method === 'POST') {
        // Add new lead
        const { data, error } = await db.from('nst_leads').insert([body]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const leadIdMatch = path.match(/^\/api\/leads\/(\d+)$/);
    if (leadIdMatch) {
      const id = parseInt(leadIdMatch[1]);
      if (method === 'GET') {
        const { data, error } = await db.from('nst_leads').select('*').eq('id', id).single();
        if (error) return fakeResp({ error: 'Not found' }, 404);
        return fakeResp(data);
      }
      if (method === 'PUT') {
        const { data, error } = await db.from('nst_leads').update(body).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
      if (method === 'DELETE') {
        const { error } = await db.from('nst_leads').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
    }

    // ── TALENT REGISTER ───────────────────────────────────────
    if (path === '/api/talent-register') {
      if (method === 'GET') {
        const { data, error } = await db.from('nst_talent_register').select('*').order('created_at', { ascending: false });
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data || []);
      }
      if (method === 'POST') {
        const { data, error } = await db.from('nst_talent_register').insert([body]).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data, 201);
      }
    }

    const regIdMatch = path.match(/^\/api\/talent-register\/(\d+)$/);
    if (regIdMatch) {
      const id = parseInt(regIdMatch[1]);
      if (method === 'DELETE') {
        const { error } = await db.from('nst_talent_register').delete().eq('id', id);
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp({ ok: true });
      }
      if (method === 'PUT') {
        const { data, error } = await db.from('nst_talent_register').update(body).eq('id', id).select().single();
        if (error) return fakeResp({ error: error.message }, 500);
        return fakeResp(data);
      }
    }

    // ── SETTINGS ──────────────────────────────────────────────
    if (path === '/api/settings') {
      if (method === 'GET') {
        const { data } = await db.from('nst_settings').select('key,value').neq('key', 'admin_pwd_hash');
        const obj = {};
        (data || []).forEach(r => { obj[r.key] = r.value; });
        return fakeResp(obj);
      }
      if (method === 'POST') {
        // Upsert each key-value pair
        const rows = Object.entries(body).map(([k, v]) => ({ key: k, value: String(v || '') }));
        for (const r of rows) {
          await db.from('nst_settings').upsert(r, { onConflict: 'key' });
        }
        return fakeResp({ ok: true });
      }
    }

    // ── EXPORT CSV ────────────────────────────────────────────
    const exportMatch = path.match(/^\/api\/export\/(.+)\.csv$/);
    if (exportMatch) {
      const type = exportMatch[1];
      const page = parseInt(qs.get('page') || '1');

      if (type === 'leads') {
        const limit = 100;
        const from  = (page - 1) * limit;
        const { data } = await db.from('nst_leads').select('*').range(from, from + limit - 1).order('created_at', { ascending: false });
        const cols = ['id','full_name','email','phone','gender','age','location','status','invite_status','booked_by','experience','year_applied','created_at'];
        return downloadCSV(toCSV(data || [], cols), `NST_Leads_p${page}_${new Date().toISOString().slice(0,10)}.csv`);
      }
      if (type === 'contacts') {
        const { data } = await db.from('nst_contacts').select('*').order('created_at', { ascending: false });
        return downloadCSV(toCSV(data || []), `NST_Contacts_${new Date().toISOString().slice(0,10)}.csv`);
      }
      if (type === 'talent') {
        const { data } = await db.from('nst_talent').select('*').order('created_at', { ascending: false });
        return downloadCSV(toCSV(data || []), `NST_Talent_${new Date().toISOString().slice(0,10)}.csv`);
      }
      if (type === 'applications') {
        const { data } = await db.from('nst_applications').select('*').order('created_at', { ascending: false });
        return downloadCSV(toCSV(data || []), `NST_Applications_${new Date().toISOString().slice(0,10)}.csv`);
      }
      // Generic export fallback
      return downloadCSV('', `${type}_export.csv`);
    }

    // ── PUBLIC POST ROUTES (passthrough from public pages) ────
    if (path === '/api/apply') {
      const row = body.formData || body;
      const { data, error } = await db.from('nst_applications').insert([row]).select('id').single();
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp({ ok: true, application_id: data.id });
    }

    if (path === '/api/apply/documents') {
      // FormData: application_id + file
      if (init && init.body instanceof FormData) {
        const fd = init.body;
        const appId = fd.get('application_id');
        const file  = fd.get('file');
        if (!file || !file.size) return fakeResp({ ok: true });
        const ext  = file.name.split('.').pop();
        const path = `applications/${appId}/${Date.now()}_${file.name}`;
        const url  = await uploadFile('nst-uploads', path, file);
        if (url) {
          await db.from('nst_documents').insert([{
            application_id: appId,
            filename: file.name,
            file_url: url,
            file_type: ext,
            file_size: file.size
          }]);
        }
        return fakeResp({ ok: true });
      }
      return fakeResp({ ok: true });
    }

    if (path === '/api/register') {
      const { error } = await db.from('nst_talent_register').insert([body]);
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp({ ok: true });
    }

    // ── PUBLIC BLOG (also used by blog.html) ──────────────────
    if (path.startsWith('/api/blog')) {
      const slugMatch = path.match(/^\/api\/blog\/([^?]+)$/);
      if (slugMatch) {
        const { data, error } = await db.from('nst_blog_posts').select('*').eq('slug', slugMatch[1]).single();
        if (error) return fakeResp({ error: 'Not found' }, 404);
        return fakeResp(data);
      }
      const { data, error } = await db.from('nst_blog_posts').select('*').eq('published', true).order('created_at', { ascending: false });
      if (error) return fakeResp({ error: error.message }, 500);
      return fakeResp(data || []);
    }

    // ── UNHANDLED ─────────────────────────────────────────────
    console.warn('[supabase-admin] unhandled route:', path, method);
    return fakeResp({ error: 'Not implemented', path, method }, 501);
  }

  // ═══════════════════════════════════════════════════════════
  // FILE UPLOAD HELPERS
  // ═══════════════════════════════════════════════════════════

  async function extractTalentRow(body, init) {
    const row = { ...body };
    if (init && init.body instanceof FormData) {
      const fd = init.body;
      row.name        = fd.get('name')        || row.name;
      row.age         = fd.get('age')         || row.age;
      row.height      = fd.get('height')      || row.height;
      row.measurements= fd.get('measurements')|| row.measurements;
      row.category    = fd.get('category')    || row.category;
      row.bio         = fd.get('bio')         || row.bio;
      row.skills      = fd.get('skills')      || row.skills;
      row.instagram   = fd.get('instagram')   || row.instagram;
      const photoFile = fd.get('photo');
      if (photoFile && photoFile.size) {
        const url = await uploadFile('nst-uploads', `talent/${Date.now()}_${photoFile.name}`, photoFile);
        if (url) row.photo = url;
      }
    }
    delete row.id;
    return row;
  }

  async function extractStoryRow(body, init) {
    const row = { ...body };
    if (init && init.body instanceof FormData) {
      const fd = init.body;
      row.name  = fd.get('name')  || row.name;
      row.title = fd.get('title') || row.title;
      row.brand = fd.get('brand') || row.brand;
      row.story = fd.get('story') || row.story;
      const photoFile = fd.get('photo');
      if (photoFile && photoFile.size) {
        const url = await uploadFile('nst-uploads', `stories/${Date.now()}_${photoFile.name}`, photoFile);
        if (url) row.photo = url;
      }
    }
    delete row.id;
    return row;
  }

  async function extractTestimonialRow(body, init) {
    const row = { ...body };
    if (init && init.body instanceof FormData) {
      const fd = init.body;
      row.name   = fd.get('name')   || row.name;
      row.role   = fd.get('role')   || row.role;
      row.quote  = fd.get('quote')  || row.quote;
      row.rating = fd.get('rating') || row.rating;
      const photoFile = fd.get('photo');
      if (photoFile && photoFile.size) {
        const url = await uploadFile('nst-uploads', `testimonials/${Date.now()}_${photoFile.name}`, photoFile);
        if (url) row.photo = url;
      }
    }
    delete row.id;
    return row;
  }

  async function extractBlogRow(body, init) {
    const row = { ...body };
    if (init && init.body instanceof FormData) {
      const fd = init.body;
      ['title','slug','category','excerpt','content'].forEach(k => {
        const v = fd.get(k); if (v !== null) row[k] = v;
      });
      const pub = fd.get('published');
      if (pub !== null) row.published = pub === 'true' || pub === '1';
      const coverFile = fd.get('cover_image');
      if (coverFile && coverFile.size) {
        const url = await uploadFile('nst-uploads', `blog/${Date.now()}_${coverFile.name}`, coverFile);
        if (url) row.cover_image = url;
      }
    }
    delete row.id;
    return row;
  }

  console.log('[supabase-admin] loaded ✓');
})();

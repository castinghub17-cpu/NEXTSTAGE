/* ═══════════════════════════════════════════════════════════
   CASTING & MODELLING AGENCY — Main JS
   ═══════════════════════════════════════════════════════════ */

/* ── Navigation ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.nav-hamburger');
  const navLinks  = document.querySelector('.nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.querySelectorAll('span').forEach((s, i) => {
        s.style.opacity = navLinks.classList.contains('open') && i === 1 ? '0' : '1';
        if (navLinks.classList.contains('open')) {
          if (i === 0) s.style.transform = 'translateY(6.5px) rotate(45deg)';
          if (i === 2) s.style.transform = 'translateY(-6.5px) rotate(-45deg)';
        } else {
          s.style.transform = '';
        }
      });
    });
  }

  // Close nav on link click
  navLinks && navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  // Highlight active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // FAQ Accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-question');
    if (q) q.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Intersection observer for fade-in
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

/* ── Toast Notifications ─────────────────────────────────── */
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; toast.style.transition = '0.3s'; }, 3200);
  setTimeout(() => toast.remove(), 3500);
}

/* ── Lightbox ─────────────────────────────────────────────── */
function openLightbox(html) {
  let overlay = document.getElementById('lightbox-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.id = 'lightbox-overlay';
    overlay.innerHTML = `<div class="lightbox-box" id="lightbox-box"></div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLightbox();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
    document.body.appendChild(overlay);
  }
  document.getElementById('lightbox-box').innerHTML = html;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* ── Fetch Helpers ────────────────────────────────────────── */
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    return { ok: false, data: { error: 'Network error' }, status: 0 };
  }
}

/* ── Image fallback ──────────────────────────────────────── */
function imgOrPlaceholder(photo, icon = '👤', classes = '') {
  if (photo) {
    return `<img src="${photo}" alt="" class="${classes}" onerror="this.parentNode.innerHTML='<div class=\\'${classes}-placeholder\\'>${icon}</div>'" />`;
  }
  return `<div class="${classes}-placeholder">${icon}</div>`;
}

/* ── Stars ────────────────────────────────────────────────── */
function renderStars(rating) {
  return '★'.repeat(Math.min(5, Math.max(0, rating || 5))) + '☆'.repeat(5 - Math.min(5, rating || 5));
}

/* ── Date Format ──────────────────────────────────────────── */
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

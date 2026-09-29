/**
 * LAGOINHA MOTION ENGINE
 * Senior Creative Developer · Motion Design Engineer
 * 
 * Orquestra: Hero Cinematic Reveal, Scroll Storytelling,
 * Card Physics, Magnetic CTAs, Cursor Spotlight,
 * KPI Transitions, Section Dots, Parallax Layers.
 * 
 * PERFORMANCE-FIRST:
 * - Single rAF loop para tudo relacionado a scroll/cursor
 * - IntersectionObserver para reveals
 * - will-change declarado via CSS
 * - Cleanup automático
 */

(function MotionEngine() {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isTouch = ('ontouchstart' in window) || window.matchMedia('(hover: none)').matches;

  // ─── STATE ─────────────────────────────────────────────────
  const state = {
    mouseX: -1000, mouseY: -1000,
    scrollY: 0,
    scrollProgress: 0,
    rafId: null,
    heroFired: false,
    activeSection: 0,
  };

  // ─── 1. HERO CINEMATIC SEQUENCE ────────────────────────────
  function initHeroCinematic() {
    const hero = document.querySelector('.portal-hero');
    if (!hero) return;

    // Marca elementos para animação
    const eyebrow = hero.querySelector('.hero-live-radar');
    const tag     = hero.querySelector('.hero-tag');
    const h1      = hero.querySelector('.hero-headline');
    const sub     = hero.querySelector('.hero-subheadline');
    const cta     = hero.querySelector('.hero-actions-row');
    const img     = hero.querySelector('.hero-media-card');

    // Adiciona classes de estado inicial
    if (eyebrow) eyebrow.classList.add('ms-hero-badge');
    if (tag)     tag.classList.add('ms-hero-eyebrow');
    if (sub)     sub.classList.add('ms-hero-sub');
    if (cta)     cta.classList.add('ms-hero-cta');
    if (img)     img.classList.add('ms-hero-image');

    // Processa headline — word-by-word reveal
    if (h1) {
      const gradient = h1.querySelector('.hero-gradient-text');
      if (gradient) {
        gradient.classList.add('ms-gradient-live');
        // Mantém gradiente animado mas adiciona o reveal
        gradient.closest('h1')?.classList.add('ms-hero-line');
      }
      h1.style.overflow = 'visible';
    }

    // Insere atmosfera no hero
    const heroInner = hero.querySelector('.portal-hero-inner');
    if (heroInner && !prefersReduced) {
      const atmosphere = document.createElement('div');
      atmosphere.className = 'ms-hero-atmosphere';
      atmosphere.setAttribute('aria-hidden', 'true');
      hero.insertBefore(atmosphere, heroInner);

      const grid = document.createElement('div');
      grid.className = 'ms-hero-grid';
      grid.setAttribute('aria-hidden', 'true');
      hero.insertBefore(grid, heroInner);
    }

    // Dispara sequência
    requestAnimationFrame(() => {
      setTimeout(() => fireHeroSequence(eyebrow, tag, h1, sub, cta, img), 100);
    });
  }

  function fireHeroSequence(eyebrow, tag, h1, sub, cta, img) {
    if (state.heroFired || prefersReduced) return;
    state.heroFired = true;

    const delays = [0, 80, 200, 480, 650, 320];
    const els    = [eyebrow, tag, h1, sub, cta, img];
    const clsMap = [
      'ms-hero-badge', 'ms-hero-eyebrow', 'ms-hero-line',
      'ms-hero-sub',   'ms-hero-cta',      'ms-hero-image'
    ];

    els.forEach((el, i) => {
      if (!el) return;
      setTimeout(() => {
        el.classList.add('ms-active');
        // Adiciona float ao hero image
        if (i === 5) {
          setTimeout(() => el.classList.add('ms-float-gentle'), 1200);
        }
      }, delays[i]);
    });
  }

  // ─── 2. SECTION PROGRESS DOTS ──────────────────────────────
  const SECTIONS = ['portal', 'visita', 'cultos', 'comunidade', 'participe', 'estacionamento', 'contato'];

  function initSectionDots() {
    if (isMobile || prefersReduced) return;

    const nav = document.getElementById('viewPortal');
    if (!nav) return;

    const dots = document.createElement('div');
    dots.id = 'msSectionDots';
    dots.setAttribute('aria-hidden', 'true');

    SECTIONS.forEach((id, i) => {
      const dot = document.createElement('div');
      dot.className = 'ms-dot' + (i === 0 ? ' active' : '');
      dot.dataset.section = id;
      dot.title = id;
      dot.addEventListener('click', () => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      dots.appendChild(dot);
    });

    document.body.appendChild(dots);
  }

  function updateSectionDots() {
    const dots = document.querySelectorAll('.ms-dot');
    if (!dots.length) return;

    let currentIdx = 0;
    SECTIONS.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.5) {
        currentIdx = i;
      }
    });

    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIdx));
  }

  // ─── 3. UNIFIED SCROLL REVEAL (IntersectionObserver) ───────
  function initScrollReveal() {
    // Adiciona classes ms-reveal a elementos existentes que não têm
    const sectionHeaders = document.querySelectorAll('.section-header');
    const stepCards      = document.querySelectorAll('.step-card');
    const scheduleCards  = document.querySelectorAll('.schedule-card');
    const actionCards    = document.querySelectorAll('.verified-action-card');
    const bentoItems     = document.querySelectorAll('.bento-item-gc, .bento-item-batismo, .bento-item-membro, .bento-item-cursos, .bento-item-voluntarios');
    const statCards      = document.querySelectorAll('.keynote-stat-card');

    sectionHeaders.forEach(el => {
      el.classList.add('ms-reveal');
      el.setAttribute('data-ms', 'blur-up');
    });

    stepCards.forEach((el, i) => {
      el.classList.add('ms-reveal', 'ms-card', 'ms-card-glow');
      el.setAttribute('data-ms', 'fade-up');
      el.style.transitionDelay = (i * 90) + 'ms';
    });

    scheduleCards.forEach((el, i) => {
      el.classList.add('ms-reveal', 'ms-card', 'ms-card-glow');
      el.setAttribute('data-ms', 'scale-up');
      el.style.transitionDelay = (i * 80) + 'ms';
    });

    actionCards.forEach((el, i) => {
      el.classList.add('ms-reveal', 'ms-card', 'ms-card-glow');
      el.setAttribute('data-ms', 'fade-up');
      el.style.transitionDelay = (i * 70) + 'ms';
    });

    bentoItems.forEach((el, i) => {
      el.classList.add('ms-reveal', 'ms-card', 'ms-card-glow');
      el.setAttribute('data-ms', i % 2 === 0 ? 'fade-left' : 'fade-right');
      el.style.transitionDelay = (i * 100) + 'ms';
    });

    statCards.forEach((el, i) => {
      el.classList.add('ms-reveal', 'ms-stat-card');
      el.setAttribute('data-ms', 'scale-up');
      el.style.transitionDelay = (i * 100) + 'ms';
    });

    // Step numbers
    document.querySelectorAll('.step-number').forEach(el => {
      el.classList.add('ms-step-number');
    });

    // Quote card WOW
    const quote = document.querySelector('.editorial-quote-card');
    if (quote) quote.classList.add('ms-wow-quote');

    // Parking window WOW
    const parkingWindow = document.querySelector('.dark-showcase-window');
    if (parkingWindow) {
      parkingWindow.classList.add('ms-window-enter');
      parkingWindow.parentElement?.classList.add('ms-parking-reveal');
    }

    // Observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('ms-active');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll(
      '.ms-reveal, .ms-stat-card, .ms-wow-quote, .ms-window-enter, .ms-step-number, .ms-band-item'
    ).forEach(el => observer.observe(el));
  }

  // ─── 4. CARD CURSOR GLOW (CSS var) ─────────────────────────
  function initCardGlow() {
    if (isTouch || prefersReduced) return;

    document.querySelectorAll('.ms-card-glow').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
        const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
        card.style.setProperty('--ms-mouse-x', x);
        card.style.setProperty('--ms-mouse-y', y);
      }, { passive: true });
    });
  }

  // ─── 5. MAGNETIC BUTTONS ───────────────────────────────────
  function initMagneticButtons() {
    if (isTouch || prefersReduced) return;

    const selectors = '.btn-primary, #btnHeaderPlanVisit, #btnToggleOperationalMode';
    document.querySelectorAll(selectors).forEach(btn => {
      btn.classList.add('ms-magnetic');

      let rect = null;

      btn.addEventListener('mouseenter', () => {
        rect = btn.getBoundingClientRect();
      }, { passive: true });

      btn.addEventListener('mousemove', (e) => {
        if (!rect) return;
        const x = (e.clientX - rect.left - rect.width  / 2) * 0.22;
        const y = (e.clientY - rect.top  - rect.height / 2) * 0.22;
        btn.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(1.04)`;
      }, { passive: true });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        rect = null;
      }, { passive: true });
    });
  }

  // ─── 6. CURSOR SPOTLIGHT ───────────────────────────────────
  function initCursorSpotlight() {
    if (isTouch || prefersReduced || isMobile) return;

    const spot = document.createElement('div');
    spot.id = 'msCursorSpot';
    spot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spot);

    let spotX = -1000, spotY = -1000;
    let targetX = -1000, targetY = -1000;

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    }, { passive: true });

    function renderSpot() {
      spotX += (targetX - spotX) * 0.10;
      spotY += (targetY - spotY) * 0.10;
      spot.style.transform = `translate3d(${spotX}px, ${spotY}px, 0)`;
      requestAnimationFrame(renderSpot);
    }
    requestAnimationFrame(renderSpot);
  }

  // ─── 7. SCROLL PROGRESS — rAF LOOP ─────────────────────────
  function initScrollProgress() {
    // Linha lateral de progresso
    const line = document.createElement('div');
    line.id = 'msScrollLine';
    line.setAttribute('aria-hidden', 'true');
    document.body.appendChild(line);
  }

  // ─── 8. HERO PARALLAX ──────────────────────────────────────
  let heroContentEl = null, heroImageEl = null;

  function initParallax() {
    if (prefersReduced) return;
    heroContentEl = document.querySelector('.hero-content-col');
    heroImageEl   = document.querySelector('.hero-image-col');
  }

  // ─── 9. KPI VALUE ANIMATION ────────────────────────────────
  // Intercepta mudanças em KPIs e adiciona transição visual
  function initKpiObserver() {
    const kpiEls = document.querySelectorAll('.kpi-value');
    if (!kpiEls.length) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        const el = m.target;
        el.classList.remove('ms-kpi-update', 'ms-kpi-flash');
        requestAnimationFrame(() => {
          el.classList.add('ms-kpi-update');
          el.closest('.kpi-card')?.classList.add('ms-kpi-flash');
          setTimeout(() => {
            el.classList.remove('ms-kpi-update');
            el.closest('.kpi-card')?.classList.remove('ms-kpi-flash');
          }, 600);
        });
      });
    });

    kpiEls.forEach(el => observer.observe(el, { childList: true, characterData: true, subtree: true }));
  }

  // ─── 10. TAB TRANSITIONS ───────────────────────────────────
  function initTabTransitions() {
    // Intercepta cliques nas tabs de navegação do parking
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        const pane = document.getElementById(targetId);
        if (pane) {
          setTimeout(() => pane.classList.add('ms-tab-enter'), 50);
        }
      });
    });
  }

  // ─── 11. MAIN rAF LOOP ─────────────────────────────────────
  function mainLoop() {
    const scrollY   = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress  = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

    // Progress line
    const line = document.getElementById('msScrollLine');
    if (line) line.style.height = (progress * 100).toFixed(2) + '%';

    // Progress bar (top)
    const topBar = document.getElementById('scrollProgressBar');
    if (topBar) topBar.style.width = (progress * 100).toFixed(2) + '%';

    // Hero parallax
    if (!isMobile && !prefersReduced) {
      if (heroContentEl && scrollY < window.innerHeight * 1.2) {
        heroContentEl.style.transform = `translateY(${(scrollY * 0.06).toFixed(1)}px)`;
      }
      if (heroImageEl && scrollY < window.innerHeight * 1.2) {
        heroImageEl.style.transform = `translateY(${(scrollY * 0.04).toFixed(1)}px)`;
      }
    }

    // Section dots update
    updateSectionDots();

    requestAnimationFrame(mainLoop);
  }

  // ─── 12. AMBIENT SECTION BACKGROUND DRIFT ──────────────────
  function initMouseMeshMove() {
    if (isTouch || prefersReduced) return;

    let mx = 0.5, my = 0.5;
    let currentX = 0.5, currentY = 0.5;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX / window.innerWidth;
      my = e.clientY / window.innerHeight;
    }, { passive: true });

    function driftMesh() {
      currentX += (mx - currentX) * 0.04;
      currentY += (my - currentY) * 0.04;

      const bgEl = document.getElementById('bgSystem');
      if (bgEl) {
        bgEl.style.setProperty('--bgsys-mx', ((currentX - 0.5) * 30).toFixed(1) + 'px');
        bgEl.style.setProperty('--bgsys-my', ((currentY - 0.5) * 20).toFixed(1) + 'px');
      }

      requestAnimationFrame(driftMesh);
    }
    requestAnimationFrame(driftMesh);
  }

  // ─── 13. VERIFIED ACTIONS BAND STAGGER ─────────────────────
  function initBandStagger() {
    const band = document.querySelector('.verified-actions-band');
    if (!band) return;

    const cards = band.querySelectorAll('.verified-action-card');
    cards.forEach((card, i) => {
      card.classList.add('ms-band-item');
      card.style.transitionDelay = (i * 80) + 'ms';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const items = entry.target.querySelectorAll('.ms-band-item');
          items.forEach(item => item.classList.add('ms-active'));
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(band);
  }

  // ─── 14. DARK SHOWCASE — PILLS REVEAL ──────────────────────
  function initShowcaseReveal() {
    const pills = document.querySelectorAll('.dark-pill');
    pills.forEach((pill, i) => {
      pill.style.opacity = '0';
      pill.style.transform = 'translateX(-16px)';
      pill.style.transition = `opacity 400ms ease ${300 + i * 100}ms, transform 500ms var(--ease-expo) ${300 + i * 100}ms`;
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          document.querySelectorAll('.dark-pill').forEach(pill => {
            pill.style.opacity = '1';
            pill.style.transform = 'translateX(0)';
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    const showcase = document.querySelector('.dark-showcase-box');
    if (showcase) observer.observe(showcase);
  }

  // ─── 15. HEADER SECTION TAG ENTRANCE ──────────────────────
  function initSectionTags() {
    document.querySelectorAll('.section-tag').forEach(tag => {
      tag.style.opacity = '0';
      tag.style.transform = 'translateY(8px) scale(0.95)';
      tag.style.transition = 'opacity 400ms ease, transform 450ms var(--ease-spring)';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0) scale(1)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    document.querySelectorAll('.section-tag').forEach(tag => observer.observe(tag));
  }

  // ─── 16. MARQUEE SPEED ON HOVER ────────────────────────────
  function initMarqueeVelocity() {
    const track = document.querySelector('.lando-marquee-track');
    if (!track) return;

    track.addEventListener('mouseenter', () => {
      track.style.animationPlayState = 'paused';
    });
    track.addEventListener('mouseleave', () => {
      track.style.animationPlayState = 'running';
    });
  }

  // ─── INIT ──────────────────────────────────────────────────
  function init() {
    if (!prefersReduced) {
      initHeroCinematic();
      initCursorSpotlight();
      initMouseMeshMove();
    }

    initScrollReveal();
    initSectionDots();
    initScrollProgress();
    initParallax();
    initCardGlow();
    initMagneticButtons();
    initKpiObserver();
    initTabTransitions();
    initBandStagger();
    initShowcaseReveal();
    initSectionTags();
    initMarqueeVelocity();

    requestAnimationFrame(mainLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/**
 * MOTION SYSTEM — comportamento único e consolidado.
 * Substitui background-system.js, lando-motion.js, fluid-system.js,
 * ambient-motion-video.js e background-particles.js.
 *
 * Princípios (ver HANDOFF.md para o raciocínio completo da consolidação):
 * - Nenhum loop de requestAnimationFrame roda para sempre. Paralaxe e cursor
 *   só recalculam em resposta a um evento real (scroll/pointermove), sempre
 *   com no máximo 1 rAF pendente por vez (throttle clássico).
 * - Um único listener de scroll para tudo (progress bar, header, scroll-spy,
 *   paralaxe) em vez de vários listeners independentes.
 * - Cada bloco de inicialização é independente e protegido por try/catch —
 *   uma falha em um não derruba os outros.
 * - O reveal-on-scroll só esconde conteúdo depois de confirmar que este
 *   script rodou (classe "js-reveal" no <html>, ver motion-system.css). Sem
 *   JS, ou se algo aqui lançar um erro, o conteúdo continua 100% visível.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function safe(label, fn) {
    try {
      fn();
    } catch (err) {
      if (label === 'reveal') document.documentElement.classList.remove('js-reveal');
      if (window.console && console.error) console.error('[motion-system] ' + label + ' desativado:', err);
    }
  }

  /* ------------------------------------------------------------------------
     1. REVEAL SEGURO (scroll-reveal + tipografia cinética)
     ------------------------------------------------------------------------ */
  function initReveal() {
    var solo = document.querySelectorAll('.reveal');
    var groups = document.querySelectorAll('.reveal-stagger');
    var kinetic = document.querySelectorAll('.kinetic-line');
    if (!solo.length && !groups.length && !kinetic.length) return;

    document.documentElement.classList.add('js-reveal');

    var targets = [];
    solo.forEach(function (el) { targets.push(el); });
    kinetic.forEach(function (el) { targets.push(el); });
    groups.forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, idx) {
        child.style.setProperty('--stagger-index', idx % 6);
        targets.push(child);
      });
    });

    function reveal(el) { el.classList.add('is-visible'); }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(reveal);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    targets.forEach(function (el) { observer.observe(el); });

    // O fallback cobre somente a dobra atual, preservando as próximas entradas.
    window.setTimeout(function () {
      targets.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.height && rect.top < window.innerHeight && rect.bottom > 0) reveal(el);
      });
    }, 2200);
    document.addEventListener('focusin', function (event) {
      targets.forEach(function (el) {
        if (el.contains(event.target)) reveal(el);
      });
    });
  }

  /* Marca os títulos que merecem tipografia cinética (headline do hero +
     primeiro título de cada seção) — sem dividir texto em spans, só troca
     a transição de "fade simples" por "máscara + blur→foco" (seção 06). */
  function initKineticTypography() {
    var heroHeadline = document.querySelector('.hero-headline');
    if (heroHeadline) {
      heroHeadline.classList.remove('reveal');
      heroHeadline.classList.add('kinetic-line');
    }
    document.querySelectorAll('.portal-section .section-title').forEach(function (title) {
      title.classList.add('kinetic-line');
    });
  }

  /* ------------------------------------------------------------------------
     2. ATMOSFERA POR CAPÍTULO (scroll como timeline — seção 04)
     ------------------------------------------------------------------------ */
  function initChapters() {
    var root = document.getElementById('bgSystem');
    var sections = Array.prototype.slice.call(document.querySelectorAll('#viewPortal section[id]'));
    if (!root || !sections.length || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          root.setAttribute('data-atmosphere', entry.target.id);
        }
      });
    }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ------------------------------------------------------------------------
     3. SCROLL — um único listener/rAF para progress bar, header, scroll-spy
        e paralaxe multicamadas (seções 08/09/10/19)
     ------------------------------------------------------------------------ */
  function initScrollTimeline() {
    var portal = document.getElementById('viewPortal');
    var photos = Array.prototype.slice.call(document.querySelectorAll('#viewPortal .official-photo img'));
    var chapters = [];
    if (portal) {
      var rail = document.createElement('nav');
      rail.className = 'chapter-rail';
      rail.setAttribute('aria-label', 'Explorar seções');
      var labels = ['Início', 'Sua primeira visita', 'Cultos', 'Comunidade', 'Participe', 'Estacionamento', 'Como chegar'];
      portal.querySelectorAll('section[id]').forEach(function (section, index) {
        var link = document.createElement('a');
        link.href = '#' + section.id;
        link.className = 'chapter-link';
        link.setAttribute('aria-label', labels[index] || section.id);
        var label = document.createElement('span');
        label.textContent = labels[index] || section.id;
        link.appendChild(label);
        rail.appendChild(link);
        chapters.push({ link: link, target: section });
      });
      portal.appendChild(rail);
    }
    var header = document.querySelector('.app-header');
    var bgRoot = document.getElementById('bgSystem');
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.quick-link[href^="#"]'));
    var navTargets = navLinks
      .map(function (link) {
        var target = document.querySelector(link.getAttribute('href'));
        return target ? { link: link, target: target } : null;
      })
      .filter(Boolean);

    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var scrollY = window.scrollY || doc.scrollTop;
      var maxScroll = (doc.scrollHeight - window.innerHeight) || 1;
      var progress = Math.min(1, Math.max(0, scrollY / maxScroll));

      doc.style.setProperty('--scroll-progress', progress.toFixed(4));

      if (header) header.classList.toggle('scrolled', scrollY > 40);
      var currentChapter = null;
      chapters.forEach(function (entry) {
        if (entry.target.getBoundingClientRect().top <= window.innerHeight * 0.5) currentChapter = entry;
      });
      chapters.forEach(function (entry) {
        if (entry === currentChapter) entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      });
      if (!reduceMotion && window.innerWidth > 900) {
        photos.forEach(function (photo) {
          var rect = photo.parentElement.getBoundingClientRect();
          if (!rect.height || rect.bottom < 0 || rect.top > window.innerHeight) return;
          var distance = (window.innerHeight / 2 - rect.top - rect.height / 2) / window.innerHeight;
          photo.style.setProperty('--photo-drift', (Math.max(-1, Math.min(1, distance)) * 24).toFixed(1) + 'px');
        });
      }

      if (!reduceMotion && bgRoot) {
        bgRoot.style.setProperty('--bgsys-scroll-slow', (scrollY * 0.04).toFixed(1) + 'px');
        bgRoot.style.setProperty('--bgsys-scroll-mid', (scrollY * 0.07).toFixed(1) + 'px');
      }

      if (navTargets.length) {
        var mid = scrollY + window.innerHeight * 0.45;
        var current = navTargets[0];
        navTargets.forEach(function (entry) {
          if (entry.target.offsetTop <= mid) current = entry;
        });
        navTargets.forEach(function (entry) { entry.link.classList.toggle('active', entry === current); });
      }
    }

    function scheduleUpdate() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate);
    if (portal && 'MutationObserver' in window) {
      new MutationObserver(scheduleUpdate).observe(portal, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    update();
  }

  /* ------------------------------------------------------------------------
     4. PARALAXE DE MOUSE NO MESH (throttle por rAF, 1 listener)
     ------------------------------------------------------------------------ */
  function initMouseParallax() {
    var root = document.getElementById('bgSystem');
    if (!root || reduceMotion || !canHover) return;

    var pending = false;
    var lastX = 0;
    var lastY = 0;

    function apply() {
      pending = false;
      root.style.setProperty('--bgsys-mx', lastX.toFixed(1) + 'px');
      root.style.setProperty('--bgsys-my', lastY.toFixed(1) + 'px');
    }

    window.addEventListener('mousemove', function (e) {
      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      lastX = ((e.clientX - cx) / cx) * 18;
      lastY = ((e.clientY - cy) / cy) * 18;
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(apply);
      }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     5. CARDS — tilt sutil + glow no cursor (seção 12), delegado, sem loop
     ------------------------------------------------------------------------ */
  function initCardPresence() {
    if (reduceMotion || !canHover) return;

    var SELECTOR = '.step-card, .schedule-card, .kpi-card, .verified-action-card, .content-card, ' +
      '.bento-item-gc, .bento-item-batismo, .bento-item-membro, .bento-item-cursos, .bento-item-voluntarios';

    var pending = false;
    var activeCard = null;
    var px = 0, py = 0;

    function apply() {
      pending = false;
      if (!activeCard) return;
      var tiltY = (px - 0.5) * 3; // máximo ~1.5deg pra cada lado
      var tiltX = (0.5 - py) * 3;
      activeCard.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
      activeCard.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
      activeCard.style.setProperty('--glow-x', (px * 100).toFixed(1) + '%');
      activeCard.style.setProperty('--glow-y', (py * 100).toFixed(1) + '%');
    }

    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!card) return;
      var rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      px = (e.clientX - rect.left) / rect.width;
      py = (e.clientY - rect.top) / rect.height;
      activeCard = card;
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(apply);
      }
    }, { passive: true });

    document.addEventListener('pointerout', function (e) {
      var card = e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      if (activeCard === card) activeCard = null;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     6. BOTÕES MAGNÉTICOS (seção 13)
     ------------------------------------------------------------------------ */
  function initMagneticButtons() {
    if (reduceMotion || !canHover) return;

    var RADIUS = 46;
    var pending = false;
    var activeBtn = null;
    var dx = 0, dy = 0;

    function apply() {
      pending = false;
      if (!activeBtn) return;
      activeBtn.style.setProperty('--mag-x', dx.toFixed(1) + 'px');
      activeBtn.style.setProperty('--mag-y', dy.toFixed(1) + 'px');
    }

    document.addEventListener('pointermove', function (e) {
      var btn = e.target.closest ? e.target.closest('.btn-primary') : null;
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      dx = Math.max(-RADIUS, Math.min(RADIUS, (e.clientX - cx) * 0.35));
      dy = Math.max(-RADIUS, Math.min(RADIUS, (e.clientY - cy) * 0.35));
      activeBtn = btn;
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(apply);
      }
    }, { passive: true });

    document.addEventListener('pointerout', function (e) {
      var btn = e.target.closest ? e.target.closest('.btn-primary') : null;
      if (!btn) return;
      if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
      btn.style.setProperty('--mag-x', '0px');
      btn.style.setProperty('--mag-y', '0px');
      if (activeBtn === btn) activeBtn = null;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     7. RIPPLE nos botões (microinteração, seção 18)
     ------------------------------------------------------------------------ */
  function initRipple() {
    if (reduceMotion) return;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.btn') : null;
      if (!btn) return;
      btn.classList.add('ripple-host');
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var span = document.createElement('span');
      span.className = 'ripple-circle';
      span.style.width = size + 'px';
      span.style.height = size + 'px';
      span.style.left = (e.clientX - rect.left - size / 2) + 'px';
      span.style.top = (e.clientY - rect.top - size / 2) + 'px';
      span.setAttribute('aria-hidden', 'true');
      btn.appendChild(span);
      window.setTimeout(function () { span.remove(); }, 650);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     8. TRANSIÇÃO PORTAL ↔ ESTACIONAMENTO (seção 21)
     Não duplica a lógica de troca de view (isso é do app.js) — só cobre o
     instante da troca com um véu que aparece já opaco e some suavemente,
     disfarçando o corte abrupto do display:none/block existente.
     ------------------------------------------------------------------------ */
  function initViewTransitionCover() {
    var cover = document.getElementById('viewTransitionCover');
    if (!cover) return;

    function play() {
      if (reduceMotion) return;
      cover.classList.add('is-covering');
      void cover.offsetWidth; // força o "opaco" a aplicar antes de tirar a transição
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          cover.classList.remove('is-covering');
        });
      });
    }

    var triggers = document.querySelectorAll(
      '#btnToggleOperationalMode, #btnReturnToPortal, [onclick*="activateParkingApp"]'
    );
    triggers.forEach(function (el) { el.addEventListener('click', play); });
  }

  /* ------------------------------------------------------------------------
     9. CONTADOR DE KPI — só na primeira entrada real de dado (seção 16)
     Nunca repete a cada atualização de poll (regra do projeto), só na
     transição de "—" para o primeiro valor real.
     ------------------------------------------------------------------------ */
  function initKpiCountUp() {
    if (reduceMotion) return;
    var el = document.getElementById('kpiCarsCount');
    if (!el || !('MutationObserver' in window)) return;

    var done = false;
    var observer = new MutationObserver(function () {
      if (done) return;
      var raw = (el.textContent || '').trim();
      var value = parseInt(raw, 10);
      if (isNaN(value)) return;
      done = true;
      observer.disconnect();
      animateCount(el, value);
    });
    observer.observe(el, { characterData: true, childList: true, subtree: true });

    function animateCount(target, endValue) {
      var start = performance.now();
      var duration = 700;
      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        target.textContent = Math.round(eased * endValue);
        if (t < 1) {
          window.requestAnimationFrame(frame);
        } else {
          target.textContent = endValue;
        }
      }
      window.requestAnimationFrame(frame);
    }
  }

  /* ------------------------------------------------------------------------
     10. STATS COUNTERS (keynote matrix band com count-up suave)
     ------------------------------------------------------------------------ */
  function initStatsCounters() {
    var counters = document.querySelectorAll('.stat-number[data-counter-target]');
    if (!counters.length) return;

    function runCounter(el) {
      var target = parseFloat(el.getAttribute('data-counter-target')) || 0;
      var prefix = el.getAttribute('data-counter-prefix') || '';
      var suffix = el.getAttribute('data-counter-suffix') || '';
      var duration = 1500;
      var startTime = null;

      function step(now) {
        if (!startTime) startTime = now;
        var progress = Math.min((now - startTime) / duration, 1);
        var ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        var current = Math.round(target * ease);
        el.textContent = prefix + current + suffix;
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          el.textContent = prefix + target + suffix;
        }
      }
      window.requestAnimationFrame(step);
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) {
        var target = el.getAttribute('data-counter-target');
        var prefix = el.getAttribute('data-counter-prefix') || '';
        var suffix = el.getAttribute('data-counter-suffix') || '';
        el.textContent = prefix + target + suffix;
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------------------
     11. DIVISORES ENTRE SEÇÕES (continuidade visual, seção 11)
     ------------------------------------------------------------------------ */
  function initSectionDividers() {
    document.querySelectorAll('#viewPortal .portal-section + .portal-section').forEach(function (section) {
      var divider = document.createElement('div');
      divider.className = 'section-divider';
      divider.setAttribute('aria-hidden', 'true');
      section.parentNode.insertBefore(divider, section);
    });
  }

  onReady(function () {
    safe('tipografia cinética', initKineticTypography);
    safe('reveal', initReveal);
    safe('capítulos/atmosfera', initChapters);
    safe('scroll timeline', initScrollTimeline);
    safe('paralaxe de mouse', initMouseParallax);
    safe('presença física dos cards', initCardPresence);
    safe('botões magnéticos', initMagneticButtons);
    safe('ripple', initRipple);
    safe('transição de view', initViewTransitionCover);
    safe('contador de KPI', initKpiCountUp);
    safe('contadores de métricas', initStatsCounters);
    safe('divisores de seção', initSectionDividers);
  });
})();

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
    // A foto do hero já tem entrada própria (perspectiva do card); as demais abrem por recorte.
    var photos = document.querySelectorAll('#viewPortal .official-photo:not(.official-hero)');
    var dividers = document.querySelectorAll('.section-divider');
    if (!solo.length && !groups.length && !kinetic.length) return;

    document.documentElement.classList.add('js-reveal');

    var targets = [];
    solo.forEach(function (el) { targets.push(el); });
    kinetic.forEach(function (el) { targets.push(el); });
    photos.forEach(function (el) { el.classList.add('photo-reveal'); targets.push(el); });
    dividers.forEach(function (el) { targets.push(el); });
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
    // O estado oculto precisa existir antes de criar os spans: splitWords lê estilos
    // (getComputedStyle), e sem isso as palavras nasciam visíveis e só depois
    // "transicionavam" para ocultas — a headline aparecia sem a subida.
    if (!reduceMotion) document.documentElement.classList.add('js-reveal');
    var titles = [];
    var heroHeadline = document.querySelector('.hero-headline');
    if (heroHeadline) {
      heroHeadline.classList.remove('reveal');
      titles.push(heroHeadline);
    }
    document.querySelectorAll('.portal-section .section-title').forEach(function (title) { titles.push(title); });
    titles.forEach(function (title) {
      title.classList.add('kinetic-line');
      if (!reduceMotion) splitWords(title);
    });
  }

  /* Cada palavra sobe de dentro de uma máscara própria. O texto continua o mesmo
     (só ganha spans), então leitores de tela e busca não mudam. Elementos com
     texto em gradiente (background-clip: text) viram uma unidade só: transformar
     os filhos quebraria o recorte do gradiente. */
  function splitWords(root) {
    var index = 0;
    function wrap(node) {
      var outer = document.createElement('span');
      outer.className = 'kw';
      var inner = document.createElement('span');
      inner.className = 'kw-i';
      inner.style.setProperty('--w', index++);
      outer.appendChild(inner);
      node.parentNode.insertBefore(outer, node);
      inner.appendChild(node);
    }
    function walk(parent) {
      Array.prototype.slice.call(parent.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            var piece = document.createTextNode(part);
            parent.insertBefore(piece, node);
            if (/\S/.test(part)) wrap(piece);
          });
          parent.removeChild(node);
        } else if (node.nodeType === 1 && node.tagName !== 'BR') {
          var clip = getComputedStyle(node);
          if ((clip.webkitBackgroundClip || clip.backgroundClip) === 'text') wrap(node);
          else walk(node);
        }
      });
    }
    walk(root);
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
      var labels = {
        portal: 'Início', igreja: 'A igreja', visita: 'Sua primeira visita', cultos: 'Cultos', comunidade: 'Comunidade',
        participe: 'Participe', estacionamento: 'Estacionamento', contato: 'Como chegar'
      };
      portal.querySelectorAll('section[id]').forEach(function (section) {
        var text = labels[section.id] || section.id;
        var link = document.createElement('a');
        link.href = '#' + section.id;
        link.className = 'chapter-link';
        link.setAttribute('aria-label', text);
        var label = document.createElement('span');
        label.setAttribute('aria-hidden', 'true');
        label.textContent = text;
        link.appendChild(label);
        rail.appendChild(link);
        chapters.push({ link: link, target: section });
      });
      portal.appendChild(rail);
    }
    var header = document.querySelector('.app-header');
    var hero = document.querySelector('.hero-cinematic');
    var lastY = window.scrollY || 0;
    if (header) header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.quick-link[href^="#"]'));
    var navTargets = navLinks
      .map(function (link) {
        var target = document.querySelector(link.getAttribute('href'));
        return target ? { link: link, target: target } : null;
      })
      .filter(Boolean);

    var ticking = false;

    var progressBar = document.getElementById('scrollProgressBar');
    var lastHeroExit = '';
    var lastChapter;

    // Todas as leituras de layout acontecem antes de qualquer escrita: intercalar
    // as duas forçava estilo+layout síncronos a cada quadro de scroll.
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var vh = window.innerHeight;
      var scrollY = window.scrollY || doc.scrollTop;
      var maxScroll = (doc.scrollHeight - vh) || 1;
      var progress = Math.min(1, Math.max(0, scrollY / maxScroll));
      var heroHeight = hero ? hero.offsetHeight || 1 : 1;
      var chapterTops = chapters.map(function (entry) { return entry.target.getBoundingClientRect().top; });
      var driftPhotos = !reduceMotion && window.innerWidth > 900;
      var rects = driftPhotos ? photos.map(function (photo) { return photo.parentElement.getBoundingClientRect(); }) : [];
      var navTops = navTargets.map(function (entry) { return entry.target.offsetTop; });
      var focusInHeader = header && header.contains(document.activeElement);

      // A variável fica só na barra que a usa: no <html> ela invalidava o estilo da página inteira.
      if (progressBar) progressBar.style.setProperty('--scroll-progress', progress.toFixed(4));

      if (header) {
        header.classList.toggle('scrolled', scrollY > 40);
        // Recolhe ao descer e volta ao subir; nunca com foco dentro nem fora do portal.
        var portalActive = portal && portal.classList.contains('active');
        var delta = scrollY - lastY;
        if (!portalActive || scrollY < 200 || focusInHeader) header.classList.remove('is-hidden');
        else if (delta > 8) header.classList.add('is-hidden');
        else if (delta < -8) header.classList.remove('is-hidden');
        lastY = scrollY;
      }

      // Saída do hero: 0 no topo, 1 quando o hero termina de sair da tela.
      if (hero && !reduceMotion) {
        // Depois que o hero saiu da tela o valor fica parado em 1: sem escrita a cada quadro.
        var heroExit = Math.min(1, Math.max(0, scrollY / heroHeight)).toFixed(4);
        if (heroExit !== lastHeroExit) {
          hero.style.setProperty('--hero-exit', heroExit);
          lastHeroExit = heroExit;
        }
      }

      var currentChapter = null;
      chapters.forEach(function (entry, i) { if (chapterTops[i] <= vh * 0.5) currentChapter = entry; });
      if (currentChapter !== lastChapter) {
        chapters.forEach(function (entry) {
          if (entry === currentChapter) entry.link.setAttribute('aria-current', 'location');
          else entry.link.removeAttribute('aria-current');
        });
        lastChapter = currentChapter;
      }

      photos.forEach(function (photo, i) {
        var rect = rects[i];
        if (!rect || !rect.height || rect.bottom < 0 || rect.top > vh) return;
        var distance = (vh / 2 - rect.top - rect.height / 2) / vh;
        photo.style.setProperty('--photo-drift', (Math.max(-1, Math.min(1, distance)) * 24).toFixed(1) + 'px');
      });

      if (navTargets.length) {
        var mid = scrollY + vh * 0.45;
        var current = null;
        navTargets.forEach(function (entry, i) { if (navTops[i] <= mid) current = entry; });
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
     5. CARDS — tilt sutil + glow no cursor (seção 12), delegado, sem loop
     ------------------------------------------------------------------------ */
  function initCardPresence() {
    if (reduceMotion || !canHover) return;

    var SELECTOR = '.kpi-card, .verified-action-card, .content-card, ' +
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
     10. DIVISORES ENTRE SEÇÕES (continuidade visual, seção 11)
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
    safe('divisores de seção', initSectionDividers);
    safe('reveal', initReveal);
    safe('scroll timeline', initScrollTimeline);
    safe('presença física dos cards', initCardPresence);
    safe('botões magnéticos', initMagneticButtons);
    safe('ripple', initRipple);
    safe('transição de view', initViewTransitionCover);
    safe('contador de KPI', initKpiCountUp);
  });
})();

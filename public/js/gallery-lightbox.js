/**
 * Lightbox acessível para as galerias do portal (progressive enhancement).
 * Sem JS, cada `.gallery-thumb` é apenas um botão com a imagem já visível —
 * nada depende deste script para o conteúdo aparecer.
 */
(function () {
  var overlay, dialogEl, imgEl, captionEl, closeBtn, prevBtn, nextBtn;
  var currentGroup = [];
  var currentIndex = 0;
  var lastFocused = null;

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function getGroup(trigger) {
    var container = trigger.closest('[data-gallery]');
    if (!container) return [trigger];
    return qsa('.gallery-thumb', container);
  }

  function render() {
    var trigger = currentGroup[currentIndex];
    var img = qs('img', trigger);
    var src = trigger.getAttribute('data-lightbox-src') || (img && img.src) || '';
    var alt = trigger.getAttribute('data-lightbox-alt') || (img && img.alt) || '';
    var caption = trigger.getAttribute('data-lightbox-caption') || '';
    imgEl.src = src;
    imgEl.alt = alt;
    captionEl.textContent = caption;
    var multi = currentGroup.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight') { step(1); return; }
    if (e.key === 'ArrowLeft') { step(-1); return; }
    if (e.key === 'Tab') {
      var focusable = qsa('button', dialogEl).filter(function (el) { return !el.hidden; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function step(delta) {
    if (currentGroup.length < 2) return;
    currentIndex = (currentIndex + delta + currentGroup.length) % currentGroup.length;
    render();
  }

  function openAt(group, index) {
    currentGroup = group;
    currentIndex = index;
    render();
    lastFocused = document.activeElement;
    overlay.hidden = false;
    void overlay.offsetWidth; // força reflow para o fade-in animar (não depende de requestAnimationFrame)
    overlay.classList.add('is-open');
    document.body.classList.add('lightbox-locked');
    document.addEventListener('keydown', onKeydown, true);
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('lightbox-locked');
    document.removeEventListener('keydown', onKeydown, true);
    window.setTimeout(function () {
      overlay.hidden = true;
      imgEl.src = '';
    }, 250);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function init() {
    overlay = document.getElementById('lightboxOverlay');
    var thumbs = qsa('.gallery-thumb');
    if (!overlay || !thumbs.length) return;

    dialogEl = qs('.lightbox-dialog', overlay);
    imgEl = qs('.lightbox-image', overlay);
    captionEl = qs('.lightbox-caption', overlay);
    closeBtn = qs('.lightbox-close', overlay);
    prevBtn = qs('.lightbox-prev', overlay);
    nextBtn = qs('.lightbox-next', overlay);

    thumbs.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var group = getGroup(trigger);
        openAt(group, group.indexOf(trigger));
      });
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

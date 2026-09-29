/**
 * Momentos de ritmo do portal que não pertencem ao motor de reveal:
 * - Silêncio: uma frase sozinha na tela; as palavras "acendem" conforme o
 *   scroll avança. Nada se move — só a luz das palavras e o fio de luz.
 * - Imagens tardias entram com fade quando terminam de carregar (sem o
 *   "pipocar" de imagem aparecendo pela metade).
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  function initSilence() {
    var section = document.querySelector('.silence');
    if (!section || reduceMotion) return;
    var line = section.querySelector('.silence-line');

    // Uma palavra por span; o ponto final fica colado à última palavra.
    var words = [];
    Array.prototype.slice.call(line.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) {
        if (words.length) words[words.length - 1].appendChild(node);
        return;
      }
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/\S/.test(part)) {
          var span = document.createElement('span');
          span.className = 'sw';
          span.textContent = part;
          line.insertBefore(span, node);
          words.push(span);
        } else {
          line.insertBefore(document.createTextNode(part), node);
        }
      });
      line.removeChild(node);
    });
    section.classList.add('is-scrubbed');

    var ticking = false;
    function update() {
      ticking = false;
      var rect = section.getBoundingClientRect();
      var p = clamp01(-rect.top / Math.max(1, rect.height - window.innerHeight));
      section.style.setProperty('--silence-p', p.toFixed(4));
      // As palavras acendem nos primeiros 75% e a frase repousa inteira no fim.
      var lit = (p / 0.75) * words.length;
      words.forEach(function (word, i) { word.style.setProperty('--lit', clamp01(lit - i).toFixed(3)); });
    }
    function schedule() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    // O listener de scroll só existe enquanto a seção está na tela.
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          window.addEventListener('scroll', schedule, { passive: true });
          schedule();
        } else {
          window.removeEventListener('scroll', schedule);
        }
      });
    }).observe(section);
    update();
  }

  function initImageFade() {
    document.querySelectorAll('#viewPortal img[loading="lazy"]').forEach(function (img) {
      if (img.complete && img.naturalWidth) return;
      img.classList.add('img-pending');
      function done() { img.classList.add('img-loaded'); }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  function init() {
    initSilence();
    initImageFade();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

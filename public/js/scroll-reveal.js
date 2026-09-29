/**
 * Entrada suave de títulos, imagens e itens de galeria ao aparecerem na tela.
 * Progressive enhancement: a classe "js-reveal" (que ativa o estado oculto via
 * CSS) só é aplicada aqui dentro. Sem JS, ou se algo falhar, o conteúdo
 * permanece 100% visível (fail-open).
 */
(function () {
  try {
    var solo = document.querySelectorAll('.reveal');
    var groups = document.querySelectorAll('.reveal-stagger');
    if (!solo.length && !groups.length) return;

    document.documentElement.classList.add('js-reveal');

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targets = [];

    solo.forEach(function (el) { targets.push(el); });
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
  } catch (err) {
    document.documentElement.classList.remove('js-reveal');
    if (window.console && console.error) console.error('[scroll-reveal] fallback ativado:', err);
  }
})();

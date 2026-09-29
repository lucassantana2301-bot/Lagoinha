/**
 * PRÓXIMO CULTO — transforma o selo fixo do hero ("Ao Vivo & Domingo") em uma
 * indicação real: o culto acontecendo agora ou o próximo, com quanto falta.
 *
 * A fonte é a própria grade de cultos verificada (data-weekday/data-times em
 * .schedule-card), então não existe uma segunda cópia dos horários para
 * desatualizar. O cálculo usa o fuso de São Paulo, independente do visitante.
 * Sem JS, o selo e a grade continuam mostrando o texto estático original.
 */
(function () {
  'use strict';

  var TIME_ZONE = 'America/Sao_Paulo';
  var WEEK = 7 * 24 * 60;
  var LIVE_WINDOW = 100; // minutos após o início em que o culto conta como "agora"
  var DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function nowInSaoPaulo() {
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return WEEKDAY_INDEX[parts.weekday] * 1440 + Number(parts.hour) * 60 + Number(parts.minute);
  }

  function readSchedule() {
    var services = [];
    document.querySelectorAll('.schedule-card[data-weekday]').forEach(function (card) {
      var day = Number(card.getAttribute('data-weekday'));
      var name = (card.querySelector('.schedule-name') || {}).textContent || '';
      card.getAttribute('data-times').split(',').forEach(function (time) {
        var hm = time.split(':');
        services.push({ card: card, day: day, name: name.trim(), time: time, start: day * 1440 + Number(hm[0]) * 60 + Number(hm[1]) });
      });
    });
    return services;
  }

  function hourLabel(time) {
    var hm = time.split(':');
    return Number(hm[0]) + 'h' + (hm[1] === '00' ? '' : hm[1]);
  }

  function durationLabel(minutes) {
    if (minutes < 60) return minutes + ' min';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h + 'h' + (m ? ' ' + String(m).padStart(2, '0') + 'min' : '');
  }

  function findState(services, now) {
    var live = null;
    var next = null;
    var nextDelta = Infinity;
    services.forEach(function (s) {
      var since = (now - s.start + WEEK) % WEEK;
      if (since < LIVE_WINDOW && (!live || s.start > live.start)) live = s;
      var until = (s.start - now + WEEK) % WEEK;
      if (until > 0 && until < nextDelta) { next = s; nextDelta = until; }
    });
    return { live: live, next: next, until: nextDelta };
  }

  function render(pill, services) {
    var now = nowInSaoPaulo();
    var state = findState(services, now);
    var today = Math.floor(now / 1440);
    var badge = pill.querySelector('.radar-badge');
    var text = pill.querySelector('.radar-text');
    var focus = state.live || state.next;
    if (!focus) return;

    pill.classList.toggle('is-live', !!state.live);
    if (state.live) {
      badge.textContent = 'Agora';
      text.innerHTML = '';
      text.append(state.live.name + ' • ', strong('começou às ' + hourLabel(state.live.time)));
    } else {
      var sameDay = state.next.day === today && state.until < 1440;
      var tomorrow = state.next.day === (today + 1) % 7 && state.until < 2880;
      badge.textContent = sameDay ? 'Hoje' : (tomorrow ? 'Amanhã' : DAYS[state.next.day]);
      text.innerHTML = '';
      text.append(state.next.name + ' • ', strong(hourLabel(state.next.time)));
      if (state.until <= 12 * 60) text.append(' • em ' + durationLabel(state.until));
    }
    pill.setAttribute('aria-label', badge.textContent + ': ' + text.textContent + '. Ver programação de cultos.');

    services.forEach(function (s) {
      s.card.classList.toggle('is-today', s.day === today);
      s.card.classList.toggle('is-live', !!state.live && s.card === state.live.card);
      s.card.classList.toggle('is-next', !state.live && s.card === state.next.card);
    });
    if (ruler) ruler.update(now, state);
  }

  function strong(value) {
    var el = document.createElement('strong');
    el.textContent = value;
    return el;
  }

  function node(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  /* A SEMANA EM LUZ — régua da semana acima da grade de cultos: uma marca por
     culto, uma agulha no "agora" real de São Paulo e um feixe preenchendo o
     tempo até o próximo culto. Decorativa (aria-hidden): as linhas da grade já
     trazem a mesma informação em texto. A agulha acelera do domingo até o agora
     quando a régua entra na tela. */
  var SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var ruler = null;

  function buildRuler(services) {
    var grid = document.querySelector('.schedule-grid');
    if (!grid || !grid.parentNode || !('IntersectionObserver' in window)) return null;

    var root = node('div', 'week');
    root.setAttribute('aria-hidden', 'true');
    var days = node('div', 'week-days');
    SHORT_DAYS.forEach(function (d) {
      var label = node('span');
      label.textContent = d;
      days.appendChild(label);
    });
    var track = node('div', 'week-track');
    var fills = [node('i', 'week-fill'), node('i', 'week-fill')];
    fills.forEach(function (f) { track.appendChild(f); });
    var marks = services.map(function (s, i) {
      var mark = node('span', 'week-mark');
      mark.style.setProperty('--x', (s.start / WEEK).toFixed(5));
      mark.style.setProperty('--i', i);
      track.appendChild(mark);
      return mark;
    });
    var needle = node('span', 'week-now');
    var needleLabel = node('em');
    needle.appendChild(needleLabel);
    var nextLabel = node('span', 'week-next-label');
    track.appendChild(needle);
    track.appendChild(nextLabel);
    root.appendChild(track);
    root.appendChild(days);
    grid.parentNode.insertBefore(root, grid);

    var observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        root.classList.add('is-on');
        observer.disconnect();
      }
    }, { threshold: 0.6 });
    observer.observe(root);

    function setFill(fill, a, b) {
      fill.style.setProperty('--a', a.toFixed(5));
      fill.style.setProperty('--b', b.toFixed(5));
    }

    return {
      update: function (now, state) {
        var x = now / WEEK;
        var minutes = now % 1440;
        needle.style.setProperty('--x', x.toFixed(5));
        needleLabel.textContent = 'Agora · ' + Math.floor(minutes / 60) + 'h' + String(minutes % 60).padStart(2, '0');
        var focus = state.live || state.next;
        marks.forEach(function (mark, i) {
          mark.classList.toggle('is-focus', services[i] === focus);
          mark.classList.toggle('is-live', services[i] === state.live);
        });
        nextLabel.style.setProperty('--x', (focus.start / WEEK).toFixed(5));
        nextLabel.textContent = focus.name + ' · ' + (state.live ? 'agora' : hourLabel(focus.time) + ' · em ' + durationLabel(state.until));
        var nx = focus.start / WEEK;
        if (state.live) {
          setFill(fills[0], nx, x);
          setFill(fills[1], 0, 0);
        } else if (nx > x) {
          setFill(fills[0], x, nx);
          setFill(fills[1], 0, 0);
        } else {
          // Próximo culto já é na semana seguinte: o feixe atravessa o fim da régua.
          setFill(fills[0], x, 1);
          setFill(fills[1], 0, nx);
        }
      }
    };
  }

  function init() {
    var pill = document.querySelector('.hero-live-radar');
    var services = readSchedule();
    if (!pill || !services.length || !window.Intl) return;
    ruler = buildRuler(services);
    render(pill, services);
    // Atualiza no virar de cada minuto; não é animação, só texto e posição.
    window.setTimeout(function tick() {
      render(pill, services);
      window.setTimeout(tick, 60000 - (Date.now() % 60000));
    }, 60000 - (Date.now() % 60000));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

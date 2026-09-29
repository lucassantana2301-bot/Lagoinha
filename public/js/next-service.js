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
  }

  function strong(value) {
    var el = document.createElement('strong');
    el.textContent = value;
    return el;
  }

  function init() {
    var pill = document.querySelector('.hero-live-radar');
    var services = readSchedule();
    if (!pill || !services.length || !window.Intl) return;
    render(pill, services);
    // Atualiza no virar de cada minuto; não é animação, só o texto do selo.
    window.setTimeout(function tick() {
      render(pill, services);
      window.setTimeout(tick, 60000 - (Date.now() % 60000));
    }, 60000 - (Date.now() % 60000));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

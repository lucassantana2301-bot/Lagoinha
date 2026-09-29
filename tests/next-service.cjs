const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'next-service.js'), 'utf8');

function classList() {
  const set = new Set();
  return { set, toggle(c, on) { on ? set.add(c) : set.delete(c); }, contains: c => set.has(c) };
}
function textNode() {
  return { textContent: '', set innerHTML(v) { this.textContent = v; }, append(...items) { this.textContent += items.map(i => typeof i === 'string' ? i : i.textContent).join(''); } };
}
const grid = [['0', '10:00,18:00', 'Celebração da Família'], ['1', '20:00', 'Culto Segunda'], ['2', '20:00', 'Culto Profético'], ['4', '20:00', 'Culto Fé'], ['6', '19:30,20:00', 'Jovens & Adolescentes']];

// weekday: 'Sun'..'Sat' no fuso de São Paulo; o Intl é substituído para fixar o instante.
function at(weekday, hour, minute) {
  const cards = grid.map(([day, times, name]) => ({
    day, classList: classList(),
    getAttribute: a => (a === 'data-weekday' ? day : times),
    querySelector: () => ({ textContent: name })
  }));
  const badge = textNode(), text = textNode();
  const pill = { classList: classList(), label: '', setAttribute(_, v) { this.label = v; }, querySelector: s => (s === '.radar-badge' ? badge : text) };
  const Intl = { DateTimeFormat: function () { return { formatToParts: () => [
    { type: 'weekday', value: weekday }, { type: 'hour', value: String(hour) }, { type: 'minute', value: String(minute) }] }; } };
  vm.runInNewContext(source, {
    Intl, Date,
    window: { Intl, setTimeout() {} },
    document: {
      readyState: 'complete',
      querySelector: () => pill,
      querySelectorAll: () => cards,
      createElement: () => textNode()
    }
  });
  const card = d => [...cards.find(c => c.day === d).classList.set].sort().join(' ');
  return { badge: badge.textContent, text: text.textContent, live: pill.classList.contains('is-live'), card };
}

let s = at('Thu', 18, 0);
assert.deepEqual([s.badge, s.text, s.live], ['Hoje', 'Culto Fé • 20h • em 2h', false]);
assert.equal(s.card('4'), 'is-next is-today');

s = at('Thu', 20, 30);
assert.deepEqual([s.badge, s.text, s.live], ['Agora', 'Culto Fé • começou às 20h', true]);
assert.equal(s.card('4'), 'is-live is-today');

s = at('Sun', 11, 30);
assert.deepEqual([s.badge, s.text], ['Agora', 'Celebração da Família • começou às 10h']);

s = at('Sun', 12, 0);
assert.deepEqual([s.badge, s.text], ['Hoje', 'Celebração da Família • 18h • em 6h']);

s = at('Sun', 17, 15);
assert.equal(s.text, 'Celebração da Família • 18h • em 45 min');

s = at('Sat', 19, 50);
assert.deepEqual([s.badge, s.text], ['Agora', 'Jovens & Adolescentes • começou às 19h30']);

s = at('Sat', 20, 10);
assert.equal(s.text, 'Jovens & Adolescentes • começou às 20h', 'o horário mais recente vence quando dois estão em andamento');

s = at('Sat', 23, 0);
assert.deepEqual([s.badge, s.text], ['Amanhã', 'Celebração da Família • 10h • em 11h'], 'virada de semana');
assert.equal(s.card('0'), 'is-next');

s = at('Fri', 10, 0);
assert.deepEqual([s.badge, s.text], ['Amanhã', 'Jovens & Adolescentes • 19h30']);

s = at('Tue', 22, 0);
assert.deepEqual([s.badge, s.text], ['Quinta', 'Culto Fé • 20h']);

s = at('Mon', 19, 59);
assert.equal(s.text, 'Culto Segunda • 20h • em 1 min');

console.log('Próximo culto: hoje, agora, amanhã, virada de semana e dois horários no sábado OK');

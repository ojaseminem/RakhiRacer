import { STUDIO } from '../config.js';

const $ = (id) => document.getElementById(id);
const fmt = (s) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
};

export class HUD {
  constructor() {
    this.spec = null;
    this.el = {
      speed: $('speed-num'), fill: $('sp-fill'), timer: $('timer'),
      boost: $('boostfill'), boostLabel: $('boostlabel'),
      abilityName: $('ability-name'), abilityFill: $('ability-fill'),
      itemName: $('item-name'), itemIcon: $('item-icon'),
      sectorNum: $('sector-num'), sectorName: $('sector-name'),
      pos: $('pos-num'), progressFill: $('progressfill'), progressDot: $('progressdot'),
      progressTicks: $('progressticks'), progressPct: $('progress-pct'), progressLeft: $('progress-left'),
      speedo: null, boostRow: $('boostrow'), spTicks: $('sp-ticks'),
      feed: $('feed'), lookback: $('lookback'),
      card: $('card'), cardTitle: $('card-title'), cardSub: $('card-sub'),
      duel: $('duel'), duelKicker: $('duel-kicker'), duelName: $('duel-name'), duelNote: $('duel-note'),
      itemHint: $('itemhint'), insetFrame: $('inset-frame'), insetLabel: $('inset-label'),
      chapter: $('chapter'), chapterKicker: $('chapter-kicker'), chapterTitle: $('chapter-title'),
      shout: $('shout'), subtitle: $('subtitle'), barkLayer: $('barklayer'),
      flash: $('flash'), skiphint: $('skiphint')
    };
    const c = this.el.fill;
    // the arc covers 402 of the circle's 515 units, which is where every
    // dasharray in the stylesheet comes from
    this.circ = 2 * Math.PI * 82;
    this.sweep = 402;
    // driven by the dash length alone. Using dashoffset for this is the usual
    // trick and it fought the wrap-around on a path shorter than the pattern,
    // so the arc only ever showed a stub.
    c.style.strokeDashoffset = '0';
    c.style.strokeDasharray = `0 ${this.circ * 2}`;
    this.el.speedo = c.closest('.speedo');
    this._lastSector = null;
    this._redline = false;
    this.barks = [];
    this.feedRows = [];
    this.buildTicks();
  }

  // ---- the dial's tick marks ---------------------------------------------
  // Drawn once. Eleven of them across the sweep, every other one long, which is
  // what turns a glowing arc into something you can actually read a speed off.
  buildTicks() {
    const g = this.el.spTicks;
    if (!g) return;
    const START = -0.5, SPAN = (402 / 515) * Math.PI * 2;   // matches the arc
    let out = '';
    for (let i = 0; i <= 10; i++) {
      const a = START + (i / 10) * SPAN;
      const major = i % 2 === 0;
      const r0 = major ? 68 : 72, r1 = 76;
      out += `<line class="${major ? 'major' : ''}" x1="${(100 + Math.cos(a) * r0).toFixed(1)}"`
           + ` y1="${(100 + Math.sin(a) * r0).toFixed(1)}"`
           + ` x2="${(100 + Math.cos(a) * r1).toFixed(1)}"`
           + ` y2="${(100 + Math.sin(a) * r1).toFixed(1)}"/>`;
    }
    g.innerHTML = out;
  }

  // ---- sector ticks on the progress line ---------------------------------
  setSectors(sectors, trackLength) {
    this.trackLength = trackLength || 0;
    const el = this.el.progressTicks;
    if (!el || !sectors) return;
    el.innerHTML = sectors
      .filter(sec => sec.from > 0)
      .map(sec => `<i style="left:${(sec.from * 100).toFixed(2)}%"></i>`)
      .join('');
  }

  setVehicle(spec) {
    this.spec = spec;
    this.el.abilityName.textContent = spec.ability.name;
    document.documentElement.style.setProperty('--ride', '#' + spec.body.toString(16).padStart(6, '0'));
    document.documentElement.style.setProperty('--ride-glow', '#' + spec.glow.toString(16).padStart(6, '0'));
  }

  update(p, raceTime, sector) {
    const e = this.el;
    e.speed.textContent = p.worldSpeedKmh;

    // the needle runs the full sweep, so flat out actually looks flat out
    // scaled a little past the car's own top speed rather than its boosted
    // ceiling, so ordinary driving uses most of the sweep and a boost is what
    // pushes the needle into the red
    const k = Math.min(1, p.speed / (p.spec.topSpeed * 1.12));
    e.fill.style.strokeDasharray = `${(this.sweep * k).toFixed(1)} ${this.circ * 2}`;
    // redline against the car's own top speed, not its boosted ceiling, so it
    // actually lights up during normal flat out driving
    const red = p.speed > p.spec.topSpeed * 0.96;
    if (red !== this._redline) {
      this._redline = red;
      if (e.speedo) e.speedo.classList.toggle('redline', red);
    }

    e.timer.textContent = fmt(raceTime);

    e.boost.style.width = p.boost + '%';
    e.boostRow.classList.toggle('full', p.boost > 99 && !p.boosting);
    e.boostRow.classList.toggle('hot', !!p.boosting);

    const ready = p.abilityCool <= 0;
    e.abilityFill.style.width = ready ? '100%' : `${(1 - p.abilityCool / p.spec.ability.cool) * 100}%`;
    e.abilityFill.parentElement.parentElement.classList.toggle('ready', ready);
    e.abilityFill.parentElement.parentElement.classList.toggle('active', p.abilityActive);

    const pct = Math.min(100, Math.max(0, p.t * 100));
    e.progressFill.style.width = pct.toFixed(2) + '%';
    e.progressDot.style.left = pct.toFixed(2) + '%';
    if (e.progressPct) e.progressPct.textContent = Math.round(pct) + '%';
    if (e.progressLeft && this.trackLength) {
      const km = (this.trackLength * (1 - p.t)) / 1000;
      e.progressLeft.textContent = km >= 1
        ? km.toFixed(1) + ' KM TO GO'
        : Math.round(km * 1000) + ' M TO GO';
    }

    if (sector !== this._lastSector) {
      this._lastSector = sector;
      e.sectorNum.textContent = sector.num;
      e.sectorName.textContent = sector.name;
    }
  }

  // ---- the running feed ---------------------------------------------------
  // Everything that happens to somebody goes through here: spins, hits,
  // eliminations. Without it half the chaos happens off screen behind her.
  event(glyph, who, what, color = '#ffc93d') {
    const layer = this.el.feed;
    if (!layer) return;
    const row = document.createElement('div');
    row.className = 'feed-row';
    row.style.setProperty('--fc', color);
    row.innerHTML = `<span class="feed-glyph">${glyph}</span><b>${who}</b><i>${what}</i>`;
    layer.appendChild(row);
    this.feedRows.push(row);
    while (this.feedRows.length > 5) this.retireFeedRow(this.feedRows.shift());
    setTimeout(() => {
      const i = this.feedRows.indexOf(row);
      if (i >= 0) { this.feedRows.splice(i, 1); this.retireFeedRow(row); }
    }, 5200);
  }

  retireFeedRow(row) {
    if (!row) return;
    row.classList.add('out');
    setTimeout(() => row.remove(), 500);
  }

  clearFeed() {
    this.feedRows.forEach(r => r.remove());
    this.feedRows = [];
    if (this.el.feed) this.el.feed.innerHTML = '';
  }

  lookingBack(on) {
    if (this.el.lookback) this.el.lookback.classList.toggle('show', !!on);
  }

  setPosition(pos, total) {
    this.el.pos.textContent = pos;
    $('pos-tot').textContent = total;
    this.el.pos.classList.toggle('lead', pos === 1);
  }

  setItem(item) {
    this.el.itemName.textContent = item ? item.name : 'NO ITEM';
    this.el.itemIcon.textContent = item ? item.glyph : '';
    this.el.itemIcon.style.background = item ? '#' + item.color.toString(16).padStart(6, '0') : 'transparent';
    $('itemslot').classList.toggle('has', !!item);
  }

  // ---- duels --------------------------------------------------------------
  // One relative at a time is the one she is actually racing. Saying so out
  // loud is what turns twelve cars into an opponent.
  duel(title, color, note) {
    const e = this.el;
    e.duelKicker.textContent = 'NOW RACING';
    e.duelName.textContent = title;
    e.duelNote.textContent = note || '';
    e.duel.style.setProperty('--dc', color);
    e.duel.classList.remove('won');
    e.duel.classList.remove('show');
    void e.duel.offsetWidth;
    e.duel.classList.add('show');
    clearTimeout(this._duelT);
    this._duelT = setTimeout(() => e.duel.classList.remove('show'), 4200);
  }

  duelWon(title, color) {
    const e = this.el;
    e.duelKicker.textContent = 'BEATEN';
    e.duelName.textContent = title;
    e.duelNote.textContent = 'one down';
    e.duel.style.setProperty('--dc', color);
    e.duel.classList.add('won');
    e.duel.classList.remove('show');
    void e.duel.offsetWidth;
    e.duel.classList.add('show');
    clearTimeout(this._duelT);
    this._duelT = setTimeout(() => e.duel.classList.remove('show'), 2600);
  }

  itemHint(item) {
    const e = this.el.itemHint;
    if (!item) { e.classList.remove('show'); return; }
    e.innerHTML = `<b>${item.name}</b><span>${item.blurb || ''}</span>`;
    e.classList.remove('show');
    void e.offsetWidth;
    e.classList.add('show');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => e.classList.remove('show'), 3600);
  }

  inset(on, label) {
    this.el.insetFrame.classList.toggle('show', !!on);
    if (label) this.el.insetLabel.textContent = label;
  }

  // ---- cinematic overlays -------------------------------------------------
  card(title, sub, dur = 2.4) {
    const e = this.el;
    e.cardTitle.textContent = title;
    e.cardSub.textContent = sub || '';
    e.card.classList.remove('show');
    void e.card.offsetWidth;
    e.card.classList.add('show');
    clearTimeout(this._cardT);
    this._cardT = setTimeout(() => e.card.classList.remove('show'), dur * 1000);
  }

  chapter(kicker, title, dur = 3.0) {
    const e = this.el;
    e.chapterKicker.textContent = kicker;
    e.chapterTitle.textContent = title;
    e.chapter.classList.remove('show');
    void e.chapter.offsetWidth;
    e.chapter.classList.add('show');
    clearTimeout(this._chapT);
    this._chapT = setTimeout(() => e.chapter.classList.remove('show'), dur * 1000);
  }

  shout(text, dur = 1.6) {
    const e = this.el.shout;
    e.textContent = text;
    e.classList.remove('show');
    void e.offsetWidth;
    e.classList.add('show');
    clearTimeout(this._shoutT);
    this._shoutT = setTimeout(() => e.classList.remove('show'), dur * 1000);
  }

  say(text, dur = 3.2) {
    const e = this.el.subtitle;
    e.textContent = text;
    e.classList.add('show');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => e.classList.remove('show'), dur * 1000);
  }

  // a speech bubble pinned to a screen position, used for the family barks
  bark(text, x, y, color) {
    const d = document.createElement('div');
    d.className = 'bark';
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    if (color) d.style.setProperty('--bark', color);
    this.el.barkLayer.appendChild(d);
    setTimeout(() => d.classList.add('go'), 16);
    setTimeout(() => d.remove(), 2200);
  }

  flash(color = '#fff', amount = 0.85, ms = 260) {
    const f = this.el.flash;
    f.style.background = color;
    f.style.opacity = amount;
    f.style.transition = 'none';
    void f.offsetWidth;
    f.style.transition = `opacity ${ms}ms ease-out`;
    f.style.opacity = 0;
  }

  skippable(on) { this.el.skiphint.classList.toggle('show', !!on); }

  // ---- vehicle select -----------------------------------------------------
  buildSelect(vehicles, onPick) {
    const rack = $('sel-rack');
    rack.innerHTML = '';
    this.selIndex = 0;
    this.cards = vehicles.map((v, i) => {
      const el = document.createElement('button');
      el.className = 'ridecard';
      el.style.setProperty('--c', '#' + v.body.toString(16).padStart(6, '0'));
      el.style.setProperty('--g', '#' + v.glow.toString(16).padStart(6, '0'));
      el.innerHTML = `
        <div class="rc-top">
          <span class="rc-tag">${v.tag}</span>
          <h3 class="rc-name">${v.name}</h3>
        </div>
        <div class="rc-view" data-view="${v.id}"></div>
        <p class="rc-quote">&ldquo;${v.quote}&rdquo;</p>
        <p class="rc-blurb">${v.blurb}</p>
        <div class="rc-stats">
          ${v.stats.map(([n, s]) => `
            <div class="rc-stat"><span>${n}</span>
              <i>${'<b class="on"></b>'.repeat(s)}${'<b></b>'.repeat(5 - s)}</i>
            </div>`).join('')}
        </div>
        <div class="rc-ability">
          <span class="rc-abname">${v.ability.name}</span>
          <span class="rc-abdesc">${v.ability.desc}</span>
        </div>`;
      el.onclick = () => { this.selIndex = i; this.syncSelect(); };
      el.ondblclick = () => onPick(v.id);
      rack.appendChild(el);
      return el;
    });
    this.vehicles = vehicles;
    this.syncSelect();

    $('sel-confirm').onclick = () => onPick(vehicles[this.selIndex].id);
    window.addEventListener('keydown', (ev) => {
      if (!document.getElementById('select').classList.contains('active')) return;
      if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { this.selIndex = (this.selIndex + 2) % 3; this.syncSelect(); }
      if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { this.selIndex = (this.selIndex + 1) % 3; this.syncSelect(); }
      if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); onPick(vehicles[this.selIndex].id); }
    });
  }

  syncSelect() {
    this.cards.forEach((c, i) => c.classList.toggle('on', i === this.selIndex));
    const v = this.vehicles[this.selIndex];
    document.documentElement.style.setProperty('--sel', '#' + v.body.toString(16).padStart(6, '0'));
    if (this.onSelectChange) this.onSelectChange(v, this.selIndex);
  }
}

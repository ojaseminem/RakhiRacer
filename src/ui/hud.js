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
      card: $('card'), cardTitle: $('card-title'), cardSub: $('card-sub'),
      chapter: $('chapter'), chapterKicker: $('chapter-kicker'), chapterTitle: $('chapter-title'),
      shout: $('shout'), subtitle: $('subtitle'), barkLayer: $('barklayer'),
      flash: $('flash'), skiphint: $('skiphint')
    };
    const c = this.el.fill;
    this.circ = 2 * Math.PI * 82;
    c.style.strokeDasharray = `${this.circ}`;
    c.style.strokeDashoffset = `${this.circ}`;
    this._lastSector = null;
    this.barks = [];
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
    const k = Math.min(1, p.speed / (p.spec.topSpeed * p.spec.boostMul));
    e.fill.style.strokeDashoffset = `${this.circ * (1 - k * 0.78)}`;
    e.timer.textContent = fmt(raceTime);
    e.boost.style.width = p.boost + '%';
    e.boostLabel.classList.toggle('hot', p.boosting);

    const ready = p.abilityCool <= 0;
    e.abilityFill.style.height = ready ? '100%' : `${(1 - p.abilityCool / p.spec.ability.cool) * 100}%`;
    e.abilityFill.parentElement.parentElement.classList.toggle('ready', ready);
    e.abilityFill.parentElement.parentElement.classList.toggle('active', p.abilityActive);

    const pct = Math.min(100, p.t * 100);
    e.progressFill.style.width = pct + '%';
    e.progressDot.style.left = pct + '%';

    if (sector !== this._lastSector) {
      this._lastSector = sector;
      e.sectorNum.textContent = sector.num;
      e.sectorName.textContent = sector.name;
    }
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

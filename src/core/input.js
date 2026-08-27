// Four things to press and nothing else. She is not a gamer, so the throttle is
// automatic and everything is forgiving.

export const Input = {
  steer: 0,        // -1 .. 1, already smoothed
  steerRaw: 0,
  boost: false,
  ability: false,
  abilityEdge: false,
  item: false,
  itemEdge: false,
  brake: false,
  skip: false,
  skipEdge: false,
  any: false,

  _keys: new Set(),
  _prevAbility: false,
  _prevItem: false,
  _prevSkip: false,

  attach() {
    const down = (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
      this.any = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft'].includes(e.code)) e.preventDefault();
    };
    const up = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => this._keys.clear());
  },

  pad() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    return gp && gp.connected ? gp : null;
  },

  update(dt) {
    const k = this._keys;
    let raw = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) raw -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) raw += 1;

    let boost = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('ArrowUp') || k.has('KeyW');
    let ability = k.has('Space');
    let item = k.has('KeyE') || k.has('KeyQ');
    let brake = k.has('ArrowDown') || k.has('KeyS');
    let skip = k.has('Escape');

    const gp = this.pad();
    if (gp) {
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.14) raw += ax;
      if (gp.buttons[7] && gp.buttons[7].pressed) boost = true;   // right trigger
      if (gp.buttons[0] && gp.buttons[0].pressed) ability = true; // A
      if (gp.buttons[2] && gp.buttons[2].pressed) item = true;    // X
      if (gp.buttons[6] && gp.buttons[6].pressed) brake = true;
      if (gp.buttons[9] && gp.buttons[9].pressed) skip = true;
      if (gp.buttons.some(b => b.pressed)) this.any = true;
    }

    raw = Math.max(-1, Math.min(1, raw));
    this.steerRaw = raw;
    // smoothing is what stops it feeling twitchy on a keyboard
    const rate = raw === 0 ? 9 : 7;
    this.steer += (raw - this.steer) * Math.min(1, rate * dt);
    if (Math.abs(this.steer) < 0.002) this.steer = 0;

    this.boost = boost;
    this.brake = brake;
    this.abilityEdge = ability && !this._prevAbility;
    this.itemEdge = item && !this._prevItem;
    this.skipEdge = skip && !this._prevSkip;
    this._prevAbility = ability;
    this._prevItem = item;
    this._prevSkip = skip;
    this.ability = ability;
    this.item = item;
    this.skip = skip;
  },

  clearAny() { this.any = false; }
};

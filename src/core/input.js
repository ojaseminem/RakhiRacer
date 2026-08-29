// ---------------------------------------------------------------------------
// Controls.
//
// A proper racing layout: W accelerates, S brakes, A and D steer, Shift boosts.
// The one concession to someone who has never held a controller is an idle
// cruise, applied in the vehicle rather than here: let go of everything and the
// car coasts down to a comfortable pace instead of stopping dead. Pressing W is
// still meaningfully faster, so it never feels like the game is driving.
// ---------------------------------------------------------------------------

export const Input = {
  steer: 0,          // -1 left .. +1 right, smoothed
  steerRaw: 0,
  throttle: 0,       // 0 .. 1
  brake: 0,          // 0 .. 1
  boost: false,
  ability: false, abilityEdge: false,
  item: false, itemEdge: false,
  look: false,       // hold to look behind
  skip: false, skipEdge: false,
  any: false,

  _keys: new Set(),
  _prevAbility: false,
  _prevItem: false,
  _prevSkip: false,

  attach() {
    const swallow = new Set([
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC'
    ]);
    const down = (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
      this.any = true;
      if (swallow.has(e.code)) e.preventDefault();
    };
    const up = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => this._keys.clear());
    // holding the right mouse button also looks behind, which is what a lot of
    // people reach for first
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousedown', (e) => { if (e.button === 2) this._rmb = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) this._rmb = false; });
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

    let throttle = (k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0;
    let brake = (k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0;
    let boost = k.has('ShiftLeft') || k.has('ShiftRight');
    let ability = k.has('Space');
    let item = k.has('KeyE') || k.has('KeyQ');
    let look = k.has('KeyC') || !!this._rmb;
    let skip = k.has('Escape');

    const gp = this.pad();
    if (gp) {
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.14) raw += ax;
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      if (rt > 0.05) throttle = Math.max(throttle, rt);
      if (lt > 0.05) brake = Math.max(brake, lt);
      if (gp.buttons[5] && gp.buttons[5].pressed) boost = true;   // right bumper
      if (gp.buttons[0] && gp.buttons[0].pressed) ability = true; // A
      if (gp.buttons[2] && gp.buttons[2].pressed) item = true;    // X
      if (gp.buttons[4] && gp.buttons[4].pressed) look = true;    // left bumper
      if (gp.buttons[9] && gp.buttons[9].pressed) skip = true;
      if (gp.buttons.some(b => b.pressed)) this.any = true;
    }

    raw = Math.max(-1, Math.min(1, raw));
    this.steerRaw = raw;
    // smoothing is what stops a keyboard feeling like an on/off switch
    const rate = raw === 0 ? 9 : 7;
    this.steer += (raw - this.steer) * Math.min(1, rate * dt);
    if (Math.abs(this.steer) < 0.002) this.steer = 0;

    this.throttle = throttle;
    this.brake = brake;
    this.boost = boost;
    this.look = look;
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

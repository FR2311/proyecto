/* ===== COLOR PICKER — componente autónomo ===== */
(function () {

  /* ---------- conversiones HSV / RGB / HEX ---------- */
  function hsvToRgb(h, s, v) {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const m = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
    return m.map(c => Math.round(c * 255));
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s, v];
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6 || !/^[0-9a-fA-F]+$/.test(hex)) return [0, 0, 0];
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2, '0')).join('');
  }

  /* ---------- clase ColorPicker ---------- */
  class ColorPicker {
    constructor({ anchor, initialColor, onChange }) {
      this.anchor   = anchor;
      this.onChange = onChange || (() => {});
      this._h = 200; this._s = 0.8; this._v = 0.6;
      this._dragging = false;
      this._setFromHex(initialColor || '#003087');
      this._build();
      this._bindClose();
    }

    /* --- conversión ---  */
    _setFromHex(hex) {
      const [r, g, b] = hexToRgb(hex);
      [this._h, this._s, this._v] = rgbToHsv(r, g, b);
    }
    _hex() {
      return rgbToHex(...hsvToRgb(this._h, this._s, this._v));
    }

    /* --- construcción del DOM --- */
    _build() {
      const pop = document.createElement('div');
      pop.className = 'cp-pop';
      pop.innerHTML = `
        <canvas class="cp-canvas" width="220" height="150"></canvas>
        <div class="cp-hue-row">
          <input class="cp-hue" type="range" min="0" max="360" step="1" value="${Math.round(this._h)}">
        </div>
        <div class="cp-bottom">
          <div class="cp-preview"></div>
          <span class="cp-hash">#</span>
          <input class="cp-hex" type="text" maxlength="6" spellcheck="false">
        </div>
      `;
      document.body.appendChild(pop);
      this._pop    = pop;
      this._canvas = pop.querySelector('.cp-canvas');
      this._hue    = pop.querySelector('.cp-hue');
      this._hex_in = pop.querySelector('.cp-hex');
      this._prev   = pop.querySelector('.cp-preview');
      pop.style.display = 'none';

      /* canvas: click y drag */
      this._canvas.addEventListener('mousedown',  e => { this._dragging = true;  this._pickXY(e); });
      this._canvas.addEventListener('touchstart', e => { e.preventDefault(); this._pickXY(e.touches[0]); }, { passive: false });
      this._canvas.addEventListener('touchmove',  e => { e.preventDefault(); this._pickXY(e.touches[0]); }, { passive: false });
      document.addEventListener('mousemove', e => { if (this._dragging) this._pickXY(e); });
      document.addEventListener('mouseup',   ()  => { this._dragging = false; });

      /* hue slider */
      this._hue.addEventListener('input', () => {
        this._h = parseFloat(this._hue.value);
        this._drawCanvas();
        this._sync();
      });

      /* hex input */
      this._hex_in.addEventListener('input', () => {
        const v = this._hex_in.value.trim();
        if (v.length === 6 && /^[0-9a-fA-F]+$/.test(v)) {
          this._setFromHex('#' + v);
          this._hue.value = Math.round(this._h);
          this._drawCanvas();
          this._syncPreview();
          this.onChange('#' + v.toUpperCase());
        }
      });

      this._drawCanvas();
      this._sync();
    }

    _pickXY(e) {
      const rect = this._canvas.getBoundingClientRect();
      this._s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this._v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      this._drawCanvas();
      this._sync();
    }

    _drawCanvas() {
      const ctx = this._canvas.getContext('2d');
      const w = this._canvas.width, h = this._canvas.height;
      ctx.clearRect(0, 0, w, h);

      /* gradiente horizontal: blanco → color del hue */
      const [r, g, b] = hsvToRgb(this._h, 1, 1);
      const gh = ctx.createLinearGradient(0, 0, w, 0);
      gh.addColorStop(0, '#fff');
      gh.addColorStop(1, `rgb(${r},${g},${b})`);
      ctx.fillStyle = gh;
      ctx.fillRect(0, 0, w, h);

      /* gradiente vertical: transparente → negro */
      const gv = ctx.createLinearGradient(0, 0, 0, h);
      gv.addColorStop(0, 'rgba(0,0,0,0)');
      gv.addColorStop(1, '#000');
      ctx.fillStyle = gv;
      ctx.fillRect(0, 0, w, h);

      /* cursor */
      const cx = this._s * w, cy = (1 - this._v) * h;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    _syncPreview() {
      const hex = this._hex();
      this._prev.style.background = hex;
    }

    _sync() {
      const hex = this._hex();
      this._prev.style.background = hex;
      this._hex_in.value = hex.replace('#', '').toUpperCase();
      this.onChange(hex);
    }

    /* --- mostrar / ocultar --- */
    show() {
      const rect = this.anchor.getBoundingClientRect();
      const scrollY = window.scrollY, scrollX = window.scrollX;
      this._pop.style.display = 'block';
      const pw = this._pop.offsetWidth || 256;
      let left = rect.left + scrollX;
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      let top = rect.bottom + scrollY + 8;
      this._pop.style.left = left + 'px';
      this._pop.style.top  = top + 'px';
      this._drawCanvas();
    }

    hide()   { this._pop.style.display = 'none'; }
    toggle() { this._pop.style.display === 'none' ? this.show() : this.hide(); }

    _bindClose() {
      document.addEventListener('click', e => {
        if (!this._pop.contains(e.target) && e.target !== this.anchor) this.hide();
      }, true);
    }

    /* --- API pública --- */
    setColor(hex) {
      this._setFromHex(hex);
      this._hue.value = Math.round(this._h);
      this._drawCanvas();
      this._syncPreview();
      this._hex_in.value = hex.replace('#', '').toUpperCase();
    }

    getColor() { return this._hex(); }

    destroy() { this._pop.remove(); }
  }

  window.ColorPicker = ColorPicker;

})();

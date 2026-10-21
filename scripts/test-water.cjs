// Run with Node.js: node scripts/test-water.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../style/water.js'), 'utf8');

function fixture({ reduced = false, supported = true, paused = false, shaderWorks = true, storageWorks = true } = {}) {
  function target(extra = {}) {
    const events = new Map();
    return Object.assign({
      addEventListener(name, listener) { events.set(name, listener); },
      fire(name, event = {}) { events.get(name)?.(event); }
    }, extra);
  }
  function classList() {
    const values = new Set();
    return {
      add: value => values.add(value), remove: value => values.delete(value),
      contains: value => values.has(value),
      toggle(value, enabled) { if (enabled) values.add(value); else values.delete(value); }
    };
  }
  const frames = new Map();
  const stored = new Map([['water-paused', String(paused)]]);
  const calls = { draws: 0, context: 0, deleted: 0 };
  let nextFrame = 0;
  const gl = {};
  for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ARRAY_BUFFER', 'STATIC_DRAW', 'FLOAT', 'TEXTURE0', 'TEXTURE_2D', 'UNPACK_FLIP_Y_WEBGL', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'CLAMP_TO_EDGE', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'LINEAR', 'RGB', 'UNSIGNED_BYTE', 'TRIANGLES']) gl[name] = name;
  for (const method of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'useProgram', 'bindBuffer', 'bufferData', 'enableVertexAttribArray', 'vertexAttribPointer', 'activeTexture', 'bindTexture', 'pixelStorei', 'texParameteri', 'texImage2D', 'uniform1i', 'uniform1f', 'uniform2f', 'uniform3f', 'viewport']) gl[method] = () => {};
  for (const method of ['createShader', 'createProgram', 'createBuffer', 'createTexture', 'getUniformLocation']) gl[method] = () => ({});
  for (const method of ['deleteShader', 'deleteProgram', 'deleteBuffer', 'deleteTexture']) gl[method] = () => calls.deleted++;
  gl.getShaderParameter = () => shaderWorks;
  gl.getProgramParameter = () => true;
  gl.getAttribLocation = () => 0;
  gl.NO_ERROR = 0;
  gl.getError = () => 0;
  gl.drawArrays = () => calls.draws++;
  const canvas = target({ dataset: {}, getContext() { calls.context++; return supported ? gl : null; } });
  const landscape = { clientWidth: 1316, clientHeight: 756, classList: classList() };
  const tooltip = {};
  const toggle = target({ hidden: true, classList: classList(), setAttribute(name, value) { this[name] = value; }, querySelector: () => tooltip });
  const preference = target({ matches: reduced });
  const document = target({ hidden: false, currentScript: { src: 'https://example.com/style/water.js' }, querySelector: selector => ({ '.water-surface': canvas, '.landscape': landscape, '.water-toggle': toggle })[selector] });
  const window = target({ devicePixelRatio: 3, matchMedia: () => preference, requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; }, cancelAnimationFrame(id) { frames.delete(id); } });
  class Image {
    constructor() { Object.assign(this, target(), { naturalWidth: 1500, naturalHeight: 1120 }); }
    set src(value) { this.fire('load'); }
  }
  const localStorage = {
    getItem(key) { if (!storageWorks) throw Error('Storage denied'); return stored.get(key); },
    setItem(key, value) { if (!storageWorks) throw Error('Storage denied'); stored.set(key, value); }
  };
  vm.runInNewContext(source, { document, window, Image, URL, localStorage });
  return { canvas, landscape, toggle, preference, document, window, frames, stored, calls,
    advance(timestamp) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(timestamp)); }
  };
}

let f = fixture();
assert.equal(f.canvas.dataset.state, 'running');
assert.ok(f.canvas.width * f.canvas.height <= 1802000, 'Rendering must respect the pixel budget on a high-DPI screen');
const before = f.calls.draws;
f.advance(100); f.advance(116); f.advance(134);
assert.equal(f.calls.draws - before, 1, 'Animation must cap rendering at 30 fps');
f.toggle.fire('click');
assert.equal(f.canvas.dataset.state, 'paused');
assert.equal(f.frames.size, 0);
assert.equal(f.stored.get('water-paused'), 'true');
assert.equal(f.toggle['aria-label'], 'Resume water animation');
f.toggle.fire('click');
assert.equal(f.canvas.dataset.state, 'running');
f.document.hidden = true; f.document.fire('visibilitychange');
assert.equal(f.frames.size, 0, 'A hidden page must stop rendering');
f.document.hidden = false; f.document.fire('visibilitychange');
assert.equal(f.frames.size, 1);
f.preference.matches = true; f.preference.fire('change');
assert.equal(f.frames.size, 0);
assert.equal(f.landscape.classList.contains('water-ready'), false);
assert.equal(f.toggle.hidden, true);
f.preference.matches = false; f.preference.fire('change');
assert.equal(f.canvas.dataset.state, 'running');
f.canvas.fire('webglcontextlost', { preventDefault() {} });
assert.equal(f.frames.size, 0);
assert.equal(f.landscape.classList.contains('water-ready'), false);
f.canvas.fire('webglcontextrestored');
assert.equal(f.canvas.dataset.state, 'running');
f.window.fire('pagehide'); assert.equal(f.frames.size, 0);
f.window.fire('pageshow'); assert.equal(f.frames.size, 1);

f = fixture({ reduced: true });
assert.equal(f.calls.context, 0, 'Reduced-motion visitors must not allocate a WebGL context');
assert.equal(f.frames.size, 0);
f.preference.matches = false; f.preference.fire('change');
assert.equal(f.canvas.dataset.state, 'running');
f = fixture({ supported: false });
assert.equal(f.canvas.dataset.state, 'static');
assert.equal(f.toggle.hidden, true);
f = fixture({ shaderWorks: false });
assert.equal(f.canvas.dataset.state, 'static');
assert.ok(f.calls.deleted > 0, 'Failed shader resources must be released');
f = fixture({ paused: true });
assert.equal(f.canvas.dataset.state, 'paused');
assert.equal(f.frames.size, 0, 'The saved pause preference must survive a new visit');
f = fixture({ storageWorks: false });
f.toggle.fire('click');
assert.equal(f.canvas.dataset.state, 'paused', 'Pause must work even if storage is denied');
console.log('Passed: render budget, frame cap, pause persistence, hidden-page suspension, reduced motion, WebGL/shader fallback, context restoration, page restoration, and blocked storage.');

(() => {
  'use strict';

  const canvas = document.querySelector('.water-surface');
  const landscape = document.querySelector('.landscape');
  const toggle = document.querySelector('.water-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const image = new Image();
  let gl;
  let program;
  let buffer;
  let texture;
  let uniforms;
  let frame = 0;
  let previousFrame = 0;
  let time = 0;
  let ready = false;
  let lost = false;
  let imageLoaded = false;
  let userPaused = false;

  try { userPaused = localStorage.getItem('water-paused') === 'true'; } catch { /* Storage is optional. */ }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_image;
    uniform vec2 u_cover;
    uniform float u_aspect;
    uniform vec3 u_phase;

    void main() {
      vec2 p = (v_uv - 0.5) * vec2(u_aspect, 1.0);
      float a = dot(p, vec2(0.8, 0.6)) * 24.0 + u_phase.x;
      float b = dot(p, vec2(-0.6, 0.8)) * 36.0 - u_phase.y;
      float c = dot(p, vec2(0.95, -0.31)) * 51.0 + u_phase.z;
      vec2 flow = vec2(0.8, 0.6) * cos(a)
        + vec2(-0.6, 0.8) * cos(b) * 0.48
        + vec2(0.95, -0.31) * cos(c) * 0.24;
      vec2 uv = (v_uv - 0.5) * u_cover + 0.5;
      uv += flow * vec2(1.0 / u_aspect, 1.0) * u_cover * 0.0032;
      vec3 color = texture2D(u_image, uv).rgb;
      float light = sin(a + 0.8) * sin(b - 0.5) * 0.021
        + sin(c + a) * 0.009;
      color *= 1.0 + light;
      color += vec3(0.65, 0.8, 0.72) * max(light, 0.0) * 0.08;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    previousFrame = 0;
  }

  function release() {
    if (!gl || lost) return;
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    texture = buffer = program = null;
  }

  function fallback() {
    stop();
    ready = false;
    landscape.classList.remove('water-ready');
    canvas.dataset.state = 'static';
    toggle.hidden = true;
    release();
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Water shader unavailable');
    }
    return shader;
  }

  function resize() {
    if (!ready || lost) return;
    const width = landscape.clientWidth;
    const height = landscape.clientHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1800000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = width / height;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform2f(uniforms.cover, Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
    draw();
  }

  function draw() {
    // Wrap phases on the CPU to keep mobile shader precision stable over long visits.
    const cycle = Math.PI * 2;
    gl.uniform3f(uniforms.phase, time * 0.52 % cycle, time * 0.38 % cycle, time * 0.29 % cycle);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(timestamp) {
    frame = 0;
    if (!ready || lost || userPaused || reducedMotion.matches || document.hidden) return;
    if (!previousFrame) previousFrame = timestamp;
    const elapsed = timestamp - previousFrame;
    if (elapsed >= 1000 / 30) {
      time += Math.min(elapsed, 100) / 1000;
      previousFrame = timestamp;
      draw();
    }
    frame = window.requestAnimationFrame(tick);
  }

  function updatePlayback() {
    stop();
    if (!ready || lost) return;
    const still = reducedMotion.matches;
    landscape.classList.toggle('water-ready', !still);
    toggle.hidden = still;
    toggle.classList.toggle('is-paused', userPaused);
    toggle.setAttribute('aria-label', userPaused ? 'Resume water animation' : 'Pause water animation');
    toggle.querySelector('.tooltip').textContent = userPaused ? 'Resume water' : 'Pause water';
    canvas.dataset.state = still ? 'static' : userPaused || document.hidden ? 'paused' : 'running';
    if (!still && !userPaused && !document.hidden) frame = window.requestAnimationFrame(tick);
  }

  function initialize() {
    if (reducedMotion.matches || !imageLoaded || ready || lost) return;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power'
      });
      if (!gl) return fallback();
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      let fragment;
      try { fragment = compile(gl.FRAGMENT_SHADER, fragmentSource); }
      catch (error) { gl.deleteShader(vertex); throw error; }
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Water program unavailable');
      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Water texture unavailable');
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
      uniforms = {
        cover: gl.getUniformLocation(program, 'u_cover'),
        aspect: gl.getUniformLocation(program, 'u_aspect'),
        phase: gl.getUniformLocation(program, 'u_phase')
      };
      ready = true;
      resize();
      updatePlayback();
    } catch { fallback(); }
  }

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem('water-paused', String(userPaused)); } catch { /* Keep the in-page preference. */ }
    updatePlayback();
  });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', updatePlayback);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', updatePlayback);
  reducedMotion.addEventListener('change', () => {
    if (!ready) initialize();
    updatePlayback();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    fallback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    texture = buffer = program = null;
    initialize();
  });
  image.addEventListener('load', () => {
    imageLoaded = true;
    initialize();
  });
  image.addEventListener('error', fallback);
  image.src = new URL('../bgs/IMG_0368.JPG', document.currentScript.src).href;
})();

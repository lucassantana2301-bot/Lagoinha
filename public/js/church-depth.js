/**
 * A IGREJA EM PROFUNDIDADE — transforma a fotografia real (img.church-fallback)
 * em uma cena com sensação espacial, guiada pelo scroll.
 *
 * - WebGL puro (um único plano + shader), sem bibliotecas.
 * - A profundidade é estimada no shader: a base da foto (mãos, cabeças) fica
 *   perto; o topo e as luzes do palco ficam longe. A câmera faz um "dolly":
 *   planos próximos crescem mais rápido que o fundo enquanto o scroll avança.
 * - O loop de render só existe com a seção na tela, e só redesenha quando algo
 *   mudou (ou quando há poeira animada, apenas em desktop).
 * - Sem WebGL, a mesma coreografia roda sobre a <img> com CSS.
 * - Com prefers-reduced-motion, nada disso roda: a seção vira uma composição
 *   estática com todo o texto visível.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var PHASE_ENDS = [0.2, 0.4, 0.6]; // depois de 0.6 é o "hero moment"

  var VERTEX = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAGMENT = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes, uImg, uShift;',
    'uniform float uZoom, uDolly, uLight, uTime, uDust, uReveal, uFit;',
    'float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }',
    'float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    // object-fit: cover (uFit = 0) até contain (uFit = 1); em telas em pé um meio-termo
    // evita que a foto horizontal vire só um recorte ampliado.
    'vec2 cover(vec2 uv) {',
    '  float sr = uRes.x / uRes.y, ir = uImg.x / uImg.y;',
    '  vec2 coverS = sr > ir ? vec2(1.0, ir / sr) : vec2(sr / ir, 1.0);',
    '  vec2 containS = sr > ir ? vec2(sr / ir, 1.0) : vec2(1.0, ir / sr);',
    '  return (uv - 0.5) * mix(coverS, containS, uFit) + 0.5;',
    '}',
    // 1 = perto (base da foto), 0 = longe (palco e luzes)
    'float depthAt(vec2 uv) {',
    '  float vertical = smoothstep(0.92, 0.05, uv.y);',
    '  return clamp(vertical * 0.85 - luma(texture2D(uTex, uv).rgb) * 0.25 + 0.15, 0.0, 1.0);',
    '}',
    'vec2 project(vec2 c, float d) {',
    '  return 0.5 + c / (uZoom * (1.0 + (d - 0.35) * uDolly)) + uShift * (d - 0.35);',
    '}',
    'void main() {',
    '  vec2 c = cover(vUv) - 0.5;',
    '  vec2 uv = 0.5 + c / uZoom;',
    '  uv = project(c, depthAt(uv));',
    '  uv = project(c, depthAt(uv));',
    // fora da foto (letterbox): esmaece para o fundo em vez de repetir a borda
    '  vec2 edge = smoothstep(vec2(0.0), vec2(0.06), uv) * smoothstep(vec2(0.0), vec2(0.06), 1.0 - uv);',
    '  float inside = edge.x * edge.y;',
    '  uv = clamp(uv, 0.001, 0.999);',
    '  vec3 col = texture2D(uTex, uv).rgb * inside + vec3(0.024, 0.024, 0.04) * (1.0 - inside);',
    // grade: sombras frias, altas quentes, contraste leve
    '  float l = luma(col);',
    '  col = mix(col * vec3(0.86, 0.9, 1.06), col * vec3(1.08, 1.0, 0.86), smoothstep(0.25, 0.85, l));',
    '  col = (col - 0.5) * 1.08 + 0.5;',
    // feixe de luz do palco, que cresce no momento final
    '  float beam = smoothstep(0.35, 1.0, uv.y) * max(0.0, 1.0 - abs(vUv.x - 0.5) * 1.3);',
    '  col += vec3(1.0, 0.86, 0.45) * beam * uLight * 0.18;',
    // poeira em suspensão, só visível dentro da luz
    '  if (uDust > 0.0) {',
    '    float dust = 0.0;',
    '    for (int i = 0; i < 3; i++) {',
    '      float fi = float(i);',
    '      vec2 g = vUv * uRes / (90.0 + fi * 60.0) + vec2(uTime * (0.02 + fi * 0.01), -uTime * (0.035 + fi * 0.012));',
    '      vec2 id = floor(g);',
    '      vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5;',
    '      float h = hash(id + fi * 7.0);',
    '      float r = length(fract(g) - 0.5 - o * 0.7);',
    '      dust += smoothstep(0.06 - fi * 0.012, 0.0, r) * step(0.82, h) * (0.5 + 0.5 * sin(uTime * 1.3 + h * 40.0));',
    '    }',
    '    col += vec3(1.0, 0.9, 0.6) * dust * uDust * (0.2 + beam * 0.9);',
    '  }',
    // vinheta + grão de filme (também disfarça a resolução limitada da foto)
    '  vec2 v = (vUv - 0.5) * vec2(1.1, 1.3);',
    '  col *= 1.0 - dot(v, v) * 0.9;',
    '  col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.045;',
    '  gl_FragColor = vec4(col * uReveal, 1.0);',
    '}'
  ].join('\n');

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  function createRenderer(canvas, isSmall) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return null;

    function shader(type, source) {
      var s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ['uTex', 'uRes', 'uImg', 'uShift', 'uZoom', 'uDolly', 'uLight', 'uTime', 'uDust', 'uReveal', 'uFit'].forEach(function (name) {
      u[name] = gl.getUniformLocation(program, name);
    });

    var texture = gl.createTexture();
    var imageSize = null;
    var dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1 : 1.5);

    return {
      gl: gl,
      setImage: function (image) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        // Foto sem potência de 2: sem mipmap, com clamp (exigência do WebGL1).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        imageSize = [image.naturalWidth, image.naturalHeight];
      },
      ready: function () { return !!imageSize; },
      resize: function () {
        var w = Math.round(canvas.clientWidth * dpr);
        var h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      draw: function (s) {
        gl.uniform1i(u.uTex, 0);
        gl.uniform2f(u.uRes, canvas.width, canvas.height);
        gl.uniform2f(u.uImg, imageSize[0], imageSize[1]);
        gl.uniform2f(u.uShift, s.shiftX, s.shiftY);
        gl.uniform1f(u.uZoom, s.zoom);
        gl.uniform1f(u.uDolly, s.dolly);
        gl.uniform1f(u.uLight, s.light);
        gl.uniform1f(u.uTime, s.time);
        gl.uniform1f(u.uDust, s.dust);
        gl.uniform1f(u.uReveal, s.reveal);
        gl.uniform1f(u.uFit, s.fit);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  function init() {
    var section = document.querySelector('.church-scene');
    if (!section) return;
    if (reduceMotion) {
      section.classList.add('is-static');
      return;
    }

    var canvas = section.querySelector('.church-canvas');
    var photo = section.querySelector('.church-fallback');
    var phased = Array.prototype.slice.call(section.querySelectorAll('[data-phase]'));
    var isSmall = window.matchMedia('(max-width: 760px)').matches;
    section.classList.add('is-scrubbed');

    var renderer = null;
    try {
      renderer = createRenderer(canvas, isSmall);
    } catch (err) {
      if (window.console) console.warn('[church-depth] WebGL indisponível, usando a foto:', err);
    }

    var state = { p: 0, target: 0, enter: 0, mx: 0, my: 0, tmx: 0, tmy: 0, phase: -1 };
    var running = false;
    var rafId = 0;
    var lastDrawn = '';
    var start = performance.now();

    function loadTexture() {
      if (!renderer || renderer.ready() || loadTexture.started) return;
      loadTexture.started = true;
      var image = new Image();
      image.decoding = 'async';
      image.onload = function () {
        renderer.setImage(image);
        renderer.resize();
        section.classList.add('gl-ready');
        lastDrawn = '';
      };
      image.src = photo.currentSrc || photo.src;
    }

    function setPhase(phase) {
      if (phase === state.phase) return;
      state.phase = phase;
      phased.forEach(function (el) {
        var own = Number(el.getAttribute('data-phase'));
        // O "hero moment" (fase 3) permanece; as palavras aparecem uma por vez.
        el.classList.toggle('is-active', own === 3 ? phase >= 3 : own === phase);
        el.classList.toggle('is-past', own < phase && own !== 3);
      });
    }

    function frame(now) {
      rafId = 0;
      if (!running) return;
      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight;
      state.target = clamp01(-rect.top / Math.max(1, rect.height - vh));
      state.enter = clamp01(1 - rect.top / vh);
      // Desaceleração precisa: a câmera persegue o scroll em vez de colar nele.
      state.p += (state.target - state.p) * 0.085;
      state.mx += (state.tmx - state.mx) * 0.06;
      state.my += (state.tmy - state.my) * 0.06;
      var p = state.p;

      // Antecipação: a primeira palavra só entra quando a cena já ocupa a tela.
      setPhase(state.enter < 0.85 ? -1 : p < PHASE_ENDS[0] ? 0 : p < PHASE_ENDS[1] ? 1 : p < PHASE_ENDS[2] ? 2 : 3);
      section.style.setProperty('--scene-p', p.toFixed(4));
      section.style.setProperty('--scene-release', smooth(0.9, 1, p).toFixed(4));

      var dust = renderer && !isSmall ? 1 : 0;
      if (renderer && renderer.ready()) {
        var s = {
          // Em pé: enquadramento mais aberto e aproximação menor, para a foto não amolecer.
          fit: vh > window.innerWidth ? 0.55 : 0,
          zoom: 1.04 + smooth(0, 1, p) * (vh > window.innerWidth ? 0.16 : 0.3),
          dolly: p * (isSmall ? 0.22 : 0.38),
          shiftX: state.mx * 0.022,
          shiftY: (p - 0.5) * 0.05 + state.my * 0.015,
          light: smooth(0.5, 0.9, p),
          time: (now - start) / 1000,
          dust: dust,
          reveal: 0.3 + 0.7 * smooth(0, 1, state.enter)
        };
        var key = [s.zoom, s.shiftX, s.shiftY, s.reveal].map(function (n) { return n.toFixed(4); }).join();
        if (dust || key !== lastDrawn) {
          renderer.draw(s);
          lastDrawn = key;
        }
      }
      rafId = window.requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running) return;
      running = true;
      if (renderer) renderer.resize();
      rafId = window.requestAnimationFrame(frame);
    }
    function stopLoop() {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) loadTexture(); });
    }, { rootMargin: '150% 0px' }).observe(section);

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.isIntersecting ? startLoop() : stopLoop(); });
    }).observe(section);

    if (renderer) {
      window.addEventListener('resize', function () { if (running) { renderer.resize(); lastDrawn = ''; } });
      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        renderer = null;
        section.classList.remove('gl-ready');
      });
    }

    if (canHover) {
      section.addEventListener('pointermove', function (e) {
        state.tmx = (e.clientX / window.innerWidth) * 2 - 1;
        state.tmy = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

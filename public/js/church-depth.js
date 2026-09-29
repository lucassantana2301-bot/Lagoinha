/**
 * A IGREJA EM PROFUNDIDADE — transforma a fotografia real (img.church-fallback)
 * em uma cena com sensação de câmera entrando no ambiente, guiada pelo scroll.
 *
 * Linguagem de câmera (tudo em um único shader, sem bibliotecas):
 * - Dolly: a profundidade é estimada no shader (base da foto perto, palco e
 *   luzes longe); planos próximos crescem mais rápido que o fundo.
 * - Rack focus: o foco começa nas mãos em primeiro plano e é puxado para o
 *   palco; no fim, as mãos passam desfocadas pela câmera (oclusão).
 * - Luz volumétrica: raios saem das luzes do palco e ganham força no momento final.
 * - Respiração: micro-oscilação da câmera quando o scroll para (só desktop).
 *
 * Desempenho:
 * - O loop só existe com a seção na tela; no celular só redesenha quando algo muda.
 * - Três níveis de qualidade; um guarda mede o tempo real dos quadros e reduz
 *   nível e resolução sozinho se o hardware não acompanhar.
 * - Sem WebGL, a mesma coreografia roda sobre a <img>; com
 *   prefers-reduced-motion, a seção é uma composição estática.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var PHASE_ENDS = [0.2, 0.4, 0.6]; // depois de 0.6 é o "hero moment"
  // Qualidade: 2 = foco com 8 amostras + raios; 1 = foco com 6 amostras; 0 = foco com 4.
  var TIER_DPR = [1, 1.25, 1.5];

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
    'uniform float uZoom, uDolly, uLight, uTime, uDust, uReveal, uFit, uFocus, uBlur, uRays, uQuality;',
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
    // 1 = perto (base da foto), 0 = longe (palco e luzes). A luminância é lida
    // numa vizinhança (4 amostras) para a profundidade não mudar bruscamente nas
    // silhuetas — senão o deslocamento desenha um halo claro em volta dos braços.
    'float depthAt(vec2 uv) {',
    '  vec2 o = vec2(0.009, 0.014);',
    '  float l = luma(texture2D(uTex, uv + o).rgb) + luma(texture2D(uTex, uv - o).rgb)',
    '          + luma(texture2D(uTex, uv + vec2(o.x, -o.y)).rgb) + luma(texture2D(uTex, uv + vec2(-o.x, o.y)).rgb);',
    '  float vertical = smoothstep(0.92, 0.05, uv.y);',
    '  return clamp(vertical * 0.85 - l * 0.0625 + 0.15, 0.0, 1.0);',
    '}',
    'vec2 project(vec2 c, float d) {',
    '  return 0.5 + c / (uZoom * (1.0 + (d - 0.35) * uDolly)) + uShift * (d - 0.35);',
    '}',
    'void main() {',
    '  vec2 c = cover(vUv) - 0.5;',
    '  vec2 uv = project(c, depthAt(0.5 + c / uZoom));',
    '  float d = depthAt(uv);',
    '  uv = project(c, d);',
    // fora da foto (letterbox): esmaece para o fundo em vez de repetir a borda
    '  vec2 edge = smoothstep(vec2(0.0), vec2(0.06), uv) * smoothstep(vec2(0.0), vec2(0.06), 1.0 - uv);',
    '  float inside = edge.x * edge.y;',
    '  uv = clamp(uv, 0.001, 0.999);',
    '  vec3 col = texture2D(uTex, uv).rgb;',
    // rack focus: desfoque em disco proporcional à distância do plano focado
    '  float coc = clamp(abs(d - uFocus) * uBlur, 0.0, 1.0);',
    '  if (coc > 0.03) {',
    '    float taps = uQuality > 1.5 ? 8.0 : (uQuality > 0.5 ? 6.0 : 4.0);',
    '    vec2 aspect = vec2(uImg.y / uImg.x, 1.0);',
    '    float spin = hash(vUv * uRes) * 6.2831;',
    '    vec3 acc = col;',
    '    for (int i = 0; i < 8; i++) {',
    '      float fi = float(i);',
    '      if (fi >= taps) break;',
    '      float a = fi * 2.39996 + spin;',
    '      vec2 o = vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / taps) * coc * 0.013 * aspect;',
    '      acc += texture2D(uTex, clamp(uv + o, 0.001, 0.999)).rgb;',
    '    }',
    '    col = acc / (taps + 1.0);',
    '  }',
    '  col = col * inside + vec3(0.024, 0.024, 0.04) * (1.0 - inside);',
    // grade: sombras frias, altas quentes, contraste leve
    '  float l = luma(col);',
    '  col = mix(col * vec3(0.86, 0.9, 1.06), col * vec3(1.08, 1.0, 0.86), smoothstep(0.25, 0.85, l));',
    '  col = (col - 0.5) * 1.08 + 0.5;',
    // luz volumétrica: marcha em direção às luzes do palco somando o que é brilhante
    '  if (uQuality > 1.5 && uRays > 0.01) {',
    '    vec2 lightPos = vec2(0.5 + uShift.x * 3.0, 0.97);',
    '    vec2 stepv = (lightPos - uv) / 12.0;',
    '    vec2 q = uv + stepv * hash(vUv * uRes + 3.7);',
    '    float ill = 0.0, decay = 1.0;',
    '    for (int i = 0; i < 12; i++) {',
    '      q += stepv;',
    '      ill += max(luma(texture2D(uTex, q).rgb) - 0.55, 0.0) * decay;',
    '      decay *= 0.88;',
    '    }',
    '    col += vec3(1.0, 0.84, 0.52) * ill * uRays * 0.3 * inside;',
    '  }',
    // feixe suave de cima, que cresce no momento final
    '  float beam = smoothstep(0.35, 1.0, uv.y) * max(0.0, 1.0 - abs(vUv.x - 0.5) * 1.3);',
    '  col += vec3(1.0, 0.86, 0.45) * beam * uLight * 0.14 * inside;',
    // poeira em suspensão, só dentro da luz e só no nível mais alto
    '  if (uDust > 0.0) {',
    '    float dust = 0.0;',
    '    for (int i = 0; i < 3; i++) {',
    '      float fi = float(i);',
    '      vec2 g = vUv * uRes / (90.0 + fi * 60.0) + vec2(uTime * (0.02 + fi * 0.01), -uTime * (0.035 + fi * 0.012));',
    '      vec2 id = floor(g);',
    '      vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5;',
    '      float h = hash(id + fi * 7.0);',
    '      float r = length(fract(g) - 0.5 - o * 0.7);',
    '      dust += smoothstep(0.05 - fi * 0.01, 0.0, r) * step(0.86, h) * (0.5 + 0.5 * sin(uTime * 1.3 + h * 40.0));',
    '    }',
    '    col += vec3(1.0, 0.9, 0.6) * dust * uDust * beam * 0.8;',
    '  }',
    // vinheta + grão de filme (também disfarça a resolução limitada da foto)
    '  vec2 v = (vUv - 0.5) * vec2(1.1, 1.3);',
    '  col *= 1.0 - dot(v, v) * 0.9;',
    '  col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.045;',
    '  gl_FragColor = vec4(col * uReveal, 1.0);',
    '}'
  ].join('\n');

  var UNIFORMS = ['uTex', 'uRes', 'uImg', 'uShift', 'uZoom', 'uDolly', 'uLight', 'uTime', 'uDust', 'uReveal',
    'uFit', 'uFocus', 'uBlur', 'uRays', 'uQuality'];

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  function createRenderer(canvas) {
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
    UNIFORMS.forEach(function (name) { u[name] = gl.getUniformLocation(program, name); });

    var texture = gl.createTexture();
    var imageSize = null;
    var dpr = 1;

    return {
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
      setDpr: function (value) { dpr = Math.min(window.devicePixelRatio || 1, value); },
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
        gl.uniform1f(u.uFocus, s.focus);
        gl.uniform1f(u.uBlur, s.blur);
        gl.uniform1f(u.uRays, s.rays);
        gl.uniform1f(u.uQuality, s.quality);
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
      renderer = createRenderer(canvas);
    } catch (err) {
      if (window.console) console.warn('[church-depth] WebGL indisponível, usando a foto:', err);
    }

    // Celular começa no nível 1; desktop com 8+ núcleos no 2. O guarda abaixo corrige para baixo.
    var tier = isSmall ? 1 : ((navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1);
    var perf = { frames: 0, time: 0 };
    if (renderer) renderer.setDpr(TIER_DPR[tier]);

    var state = { p: 0, target: 0, enter: 0, mx: 0, my: 0, tmx: 0, tmy: 0, phase: -1, last: 0 };
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

    function watchPerformance(dt) {
      if (tier === 0 || !dt) return;
      perf.frames += 1;
      perf.time += dt;
      // Decide rápido: 45 quadros ou 1,5 s, o que vier primeiro (em hardware lento, 90 quadros levariam segundos demais).
      if (perf.frames < 45 && perf.time < 1.5) return;
      // Abaixo de ~40 fps sustentados: um nível a menos (e menos pixels).
      if (perf.time / perf.frames > 0.025) {
        tier -= 1;
        renderer.setDpr(TIER_DPR[tier]);
        renderer.resize();
      }
      perf.frames = 0;
      perf.time = 0;
    }

    function frame(now) {
      rafId = 0;
      if (!running) return;
      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight;
      var portrait = vh > window.innerWidth;
      state.target = clamp01(-rect.top / Math.max(1, rect.height - vh));
      state.enter = clamp01(1 - rect.top / vh);
      // Desaceleração precisa: a câmera persegue o scroll em vez de colar nele.
      // Baseada em tempo, para ter o mesmo ritmo a 30 ou 120 fps.
      var dt = state.last ? Math.min(0.1, (now - state.last) / 1000) : 0;
      state.last = now;
      var follow = 1 - Math.exp(-dt * 5.5);
      var drift = 1 - Math.exp(-dt * 3.8);
      state.p += (state.target - state.p) * follow;
      state.mx += (state.tmx - state.mx) * drift;
      state.my += (state.tmy - state.my) * drift;
      var p = state.p;
      var t = (now - start) / 1000;

      // Antecipação: a primeira palavra só entra quando a cena já ocupa a tela.
      setPhase(state.enter < 0.85 ? -1 : p < PHASE_ENDS[0] ? 0 : p < PHASE_ENDS[1] ? 1 : p < PHASE_ENDS[2] ? 2 : 3);
      section.style.setProperty('--scene-p', p.toFixed(4));
      section.style.setProperty('--scene-release', smooth(0.9, 1, p).toFixed(4));

      if (renderer && renderer.ready()) {
        // Respiração: só onde já existe loop contínuo (desktop); no celular a cena para quando o scroll para.
        var breathing = !isSmall && tier > 0;
        var light = smooth(0.5, 0.9, p);
        var s = {
          fit: portrait ? 0.55 : 0,
          zoom: (1.04 + smooth(0, 1, p) * (portrait ? 0.16 : 0.3)) * (breathing ? 1 + Math.sin(t * 0.55) * 0.0035 : 1),
          dolly: p * (isSmall ? 0.2 : 0.3),
          shiftX: state.mx * 0.018 + (breathing ? Math.sin(t * 0.37) * 0.0025 : 0),
          shiftY: (p - 0.5) * 0.05 + state.my * 0.012 + (breathing ? Math.cos(t * 0.29) * 0.002 : 0),
          // Foco puxado das mãos (perto) para o palco (longe) entre 5% e 65% da cena.
          focus: 0.9 - smooth(0.05, 0.65, p) * 0.78,
          blur: isSmall ? 1.2 : 1.6,
          rays: 0.25 + 0.75 * light,
          light: light,
          quality: tier,
          time: t,
          dust: tier === 2 ? 1 : 0,
          reveal: 0.3 + 0.7 * smooth(0, 1, state.enter)
        };
        var key = [s.zoom, s.shiftX, s.shiftY, s.reveal, s.focus].map(function (n) { return n.toFixed(4); }).join();
        if (breathing || key !== lastDrawn) {
          renderer.draw(s);
          lastDrawn = key;
          watchPerformance(dt);
        }
      }
      rafId = window.requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running) return;
      running = true;
      state.last = 0;
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

/* eslint-disable */
// @ts-nocheck
// Animaciones abstractas de los ejercicios, dibujadas en canvas (generado desde animaciones/animaciones.js).
// Solo guarda la geometría de cada animación, por id. Los nombres, páginas y series del libro
// viven en el contenido personal y no se publican.
// Uso: SCAnim.play(canvas, id, resaltado?) devuelve una función para detener.
type Resalte = { p: string[]; s: string[] };
let SCAnim: {
  draw: (cv: HTMLCanvasElement, id: string, ms: number, opt?: { still?: boolean; hl?: Resalte }) => void;
  play: (cv: HTMLCanvasElement, id: string, hl?: Resalte) => () => void;
  pose: (id: string, ms: number) => any;
  ik: (a: number[], b: number[], l1: number, l2: number, dir: number) => number[];
  periodOf: (id: string) => number;
};
(function () {

  'use strict';

  var W = 360, H = 270;
  // Largos de la figura (unidades del lienzo de 360 x 270)
  var L = { T: 66, TH: 58, SH: 56, UA: 40, FA: 38, NK: 22, HR: 13, LW: 8 };
  var PERIOD = 3770; // igual que la muestra: sin(t / 600)

  function colors(el) {
    var cs = getComputedStyle(el || document.documentElement);
    function v(n, d) { var x = cs.getPropertyValue(n).trim(); return x || d; }
    return { fg: v('--accent', '#c9b3f5'), line: v('--line', '#3a3049'), rose: v('--rose', '#f2b8c6'), muted: v('--muted', '#a99fb6') };
  }

  // ---------- Geometría ----------
  function rad(d) { return d * Math.PI / 180; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function unit(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; }
  function rot(v, deg) { var r = rad(deg), c = Math.cos(r), s = Math.sin(r); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
  // Articulación media (rodilla o codo) entre a y b, con dir = +1 (antihorario) o -1
  function ik(a, b, l1, l2, dir) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 0.001;
    var ang = Math.atan2(dy, dx), off = 0;
    if (d < l1 + l2) off = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    var t = ang + dir * off;
    return [a[0] + l1 * Math.cos(t), a[1] + l1 * Math.sin(t)];
  }

  // Interpola dos posturas campo por campo
  function lerpPose(a, b, u) {
    var o = {}, k;
    for (k in a) {
      var x = a[k], y = b[k] === undefined ? x : b[k];
      if (Array.isArray(x)) o[k] = [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u];
      else if (typeof x === 'number') o[k] = x + (y - x) * u;
      else o[k] = x;
    }
    return o;
  }
  // Recorre los cuadros clave en bucle con transición suave
  function poseAt(ex, ph) {
    var f = ex.frames, n = f.length, w = ex.weights || f.map(function () { return 1; });
    var tot = w.reduce(function (s, x) { return s + x; }, 0), acc = 0, x = ph * tot;
    for (var i = 0; i < n; i++) {
      if (x <= acc + w[i] || i === n - 1) {
        var u = Math.min(1, Math.max(0, (x - acc) / w[i]));
        return lerpPose(f[i], f[(i + 1) % n], (1 - Math.cos(Math.PI * u)) / 2);
      }
      acc += w[i];
    }
  }

  // Calcula los puntos que faltan (hombro, cabeza, rodillas, codos, manos relativas)
  function solve(p) {
    var P = {}, k;
    for (k in p) P[k] = p[k];
    if (!P.sh) P.sh = [P.hip[0] + L.T * Math.cos(rad(P.tr)), P.hip[1] + L.T * Math.sin(rad(P.tr))];
    if (!P.head) P.head = add(P.sh, rot(unit(P.mid || P.hip, P.sh).map(function (x) { return x * L.NK; }), P.nk || 0));
    if (P.hdR) P.hd = add(P.sh, P.hdR);
    if (P.hd2R) P.hd2 = add(P.sh, P.hd2R);
    var kb = P.kb === undefined ? 1 : P.kb, eb = P.eb === undefined ? -1 : P.eb;
    if (P.ft && !P.kn) P.kn = ik(P.hip, P.ft, L.TH, L.SH, kb);
    if (P.ft2 && !P.kn2) P.kn2 = ik(P.hip, P.ft2, L.TH, L.SH, P.kb2 === undefined ? kb : P.kb2);
    if (P.hd && !P.el) P.el = ik(P.sh, P.hd, L.UA, L.FA, eb);
    if (P.hd2 && !P.el2) P.el2 = ik(P.sh, P.hd2, L.UA, L.FA, P.eb2 === undefined ? eb : P.eb2);
    return P;
  }

  // ---------- Trazo ----------
  function path(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
  function disc(c, p, r, col) { c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill(); }
  function box(c, x, y, w, h, col) { c.strokeStyle = col; c.lineWidth = 3; c.strokeRect(x, y, w, h); }
  function bench(c, x1, x2, h, col) {
    c.strokeStyle = col; c.lineCap = 'round';
    c.lineWidth = 7; path(c, [[x1, h], [x2, h]]);
    c.lineWidth = 3; path(c, [[x1 + 12, h], [x1 + 12, 0]]); path(c, [[x2 - 12, h], [x2 - 12, 0]]);
  }
  function dumbbell(c, p, col) { disc(c, p, 9, col.rose); c.strokeStyle = col.line; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], 4, 0, Math.PI * 2); c.stroke(); }

  // Figura de perfil: miembros lejanos tenues, luego torso, pierna y brazo cercanos, cabeza
  function figure(c, P, col) {
    c.strokeStyle = col.fg; c.lineWidth = L.LW; c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalAlpha = 0.42;
    if (P.ft2) path(c, [P.hip, P.kn2, P.ft2]);
    if (P.hd2) path(c, [P.sh, P.el2, P.hd2]);
    c.globalAlpha = 1;
    c.beginPath(); c.moveTo(P.hip[0], P.hip[1]);
    if (P.mid) c.quadraticCurveTo(P.mid[0], P.mid[1], P.sh[0], P.sh[1]); else c.lineTo(P.sh[0], P.sh[1]);
    c.stroke();
    if (P.ft) path(c, [P.hip, P.kn, P.ft]);
    if (P.hd) path(c, [P.sh, P.el, P.hd]);
    disc(c, P.head, L.HR, col.fg);
  }

  // Figura de frente (X-band walk y chop): hombros y cadera como barras cortas
  function front(c, P, col) {
    c.strokeStyle = col.fg; c.lineWidth = L.LW; c.lineCap = 'round'; c.lineJoin = 'round';
    var hw = 13, sw = P.sw || 22;
    var hl = [P.hip[0] - hw, P.hip[1]], hr = [P.hip[0] + hw, P.hip[1]];
    var sl = [P.neck[0] - sw, P.neck[1]], sr = [P.neck[0] + sw, P.neck[1]];
    path(c, [P.ftL, ik(hl, P.ftL, L.TH, L.SH, -1), hl, hr, ik(hr, P.ftR, L.TH, L.SH, 1), P.ftR]);
    path(c, [P.hip, P.neck]);
    path(c, [P.hdL, P.elL || ik(sl, P.hdL, L.UA, L.FA, -1), sl, sr, P.elR || ik(sr, P.hdR, L.UA, L.FA, 1), P.hdR]);
    disc(c, [P.neck[0] + (P.hx || 0), P.neck[1] + 24], L.HR, col.fg);
  }

  // Cuenta del tiempo de sostener (planchas): anillo pequeño arriba a la derecha
  function holdRing(c, s, ph, col) {
    c.save(); c.setTransform(s, 0, 0, s, 0, 0);
    c.lineWidth = 3; c.strokeStyle = col.line; c.beginPath(); c.arc(W - 30, 30, 12, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = col.muted; c.beginPath(); c.arc(W - 30, 30, 12, -Math.PI / 2, -Math.PI / 2 + ph * Math.PI * 2); c.stroke();
    c.restore();
  }
  function breathe(P, ms, amp, keys) {
    var d = Math.sin(ms / 900) * amp;
    keys.forEach(function (k) { if (P[k]) P[k] = [P[k][0], P[k][1] + d]; });
    return P;
  }
  // Pulso de tensión (RKC): anillos suaves que salen de la cadera
  function pulse(c, p, ph, col) {
    for (var i = 0; i < 2; i++) {
      var q = (ph * 2 + i / 2) % 1;
      c.globalAlpha = (1 - q) * 0.6; c.strokeStyle = col.rose; c.lineWidth = 2;
      c.beginPath(); c.arc(p[0], p[1], 10 + q * 22, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }

  // ---------- Ejercicios ----------
  // Coordenadas: x hacia la derecha, y hacia arriba desde el piso (y = 0).
  // hip/sh/head/ft/hd = cadera, hombro, cabeza, pie, mano. "2" = lado lejano (tenue).
  // tr = ángulo del tronco en grados (de la cadera al hombro). kb/eb = hacia dónde doblan rodilla y codo.
  var EX = [
    // ===== Rutina A =====
    {
      id: 'a-glute-bridge', 
      floor: 0.78, still: 0.5,
      frames: [
        { sh: [98, 10], head: [70, 16], hip: [180, 18], ft: [262, 4] },
        { sh: [98, 10], head: [70, 16], hip: [180, 70], ft: [262, 4] }
      ]
    },
    {
      id: 'a-one-arm-row', 
      still: 0.5,
      bg: function (c, P, col) { bench(c, 100, 285, 40, col.line); },
      fg: function (c, P, col) { dumbbell(c, P.hd, col); },
      frames: [
        { hip: [165, 104], tr: 8, ft: [150, 0], ft2: [118, 46], kn2: [178, 46], hd2: [244, 44], eb2: 1, hd: [236, 34], eb: 1 },
        { hip: [165, 104], tr: 8, ft: [150, 0], ft2: [118, 46], kn2: [178, 46], hd2: [244, 44], eb2: 1, hd: [204, 96], eb: -1 }
      ]
    },
    {
      id: 'a-box-squat', 
      still: 0.5,
      bg: function (c, P, col) { box(c, 104, 0, 56, 50, col.line); },
      frames: [
        { hip: [200, 112], tr: 90, ft: [210, 0], ft2: [216, 0], hdR: [72, -8] },
        { hip: [150, 60], tr: 52, ft: [210, 0], ft2: [216, 0], hdR: [72, 6] }
      ]
    },
    {
      id: 'a-db-bench-press', 
      still: 0.5,
      bg: function (c, P, col) { bench(c, 50, 215, 40, col.line); },
      fg: function (c, P, col) { dumbbell(c, P.hd, col); },
      frames: [
        { sh: [90, 50], head: [62, 54], hip: [176, 50], ft: [236, 0], ft2: [244, 0], el: [120, 32], hd: [106, 64] },
        { sh: [90, 50], head: [62, 54], hip: [176, 50], ft: [236, 0], ft2: [244, 0], el: [94, 92], hd: [96, 130] }
      ]
    },
    {
      id: 'a-db-rdl', 
      still: 0.5,
      fg: function (c, P, col) { dumbbell(c, P.hd, col); },
      frames: [
        { hip: [190, 112], tr: 90, ft: [198, 0], ft2: [204, 0], hdR: [8, -74] },
        { hip: [160, 104], tr: 18, ft: [198, 0], ft2: [204, 0], hdR: [2, -76] }
      ]
    },
    {
      id: 'a-side-lying-abduction', 
      floor: 0.78, still: 0.5,
      frames: [
        { sh: [96, 14], head: [68, 22], hip: [178, 16], ft2: [292, 4], ft: [292, 14] },
        { sh: [96, 14], head: [68, 22], hip: [178, 16], ft2: [292, 4], ft: [276, 74] }
      ]
    },
    {
      id: 'a-front-plank', 
      floor: 0.78, hold: true, still: 0,
      frames: [
        { ft: [62, 2], hip: [172, 28], sh: [236, 44], el: [236, 4], hd: [274, 4] }
      ],
      mod: function (P, ms) { return breathe(P, ms, 1.5, ['hip']); }
    },
    {
      id: 'a-side-plank-knees', 
      floor: 0.78, hold: true, still: 0.4, weights: [1, 3, 1],
      frames: [
        { sh: [104, 42], hip: [170, 10], el: [104, 4], hd: [130, 4], kn: [226, 6], ft: [196, 34] },
        { sh: [104, 42], hip: [170, 40], el: [104, 4], hd: [130, 4], kn: [226, 6], ft: [196, 34] },
        { sh: [104, 42], hip: [170, 40], el: [104, 4], hd: [130, 4], kn: [226, 6], ft: [196, 34] }
      ]
    },

    // ===== Rutina B =====
    {
      id: 'b-fe-single-leg-glute-bridge', 
      floor: 0.78, still: 0.5,
      bg: function (c, P, col) { box(c, 236, 0, 64, 40, col.line); },
      frames: [
        { sh: [98, 10], head: [70, 16], hip: [178, 22], ft: [262, 42], ft2: [228, 70], kb2: 1 },
        { sh: [98, 10], head: [70, 16], hip: [178, 74], ft: [262, 42], ft2: [226, 124], kb2: 1 }
      ]
    },
    {
      id: 'b-front-lat-pulldown', 
      zoom: 0.86, still: 0.5,
      bg: function (c, P, col) {
        c.strokeStyle = col.line; c.lineCap = 'round';
        c.lineWidth = 5; path(c, [[300, 0], [300, 262], [196, 262]]);
        box(c, 128, 0, 66, 54, col.line);
        c.lineWidth = 7; path(c, [[220, 96], [244, 96]]);
        c.lineWidth = 3; c.beginPath(); c.arc(196, 256, 7, 0, Math.PI * 2); c.stroke();
      },
      fg: function (c, P, col) {
        c.strokeStyle = col.rose; c.lineWidth = 2; path(c, [[196, 249], P.hd]);
        disc(c, P.hd, 7, col.rose);
      },
      frames: [
        { hip: [164, 62], tr: 100, ft: [238, 0], ft2: [244, 0], hd: [196, 222], eb: 1 },
        { hip: [164, 62], tr: 104, ft: [238, 0], ft2: [244, 0], hd: [182, 132], eb: 1 }
      ]
    },
    {
      id: 'b-step-up', 
      floor: 0.94, zoom: 0.72, still: 0.5, weights: [1, 1, 1, 1],
      bg: function (c, P, col) { box(c, 196, 0, 80, 56, col.line); },
      frames: [
        { hip: [166, 106], tr: 86, ft: [224, 56], ft2: [160, 0], hdR: [4, -76] },
        { hip: [200, 150], tr: 84, ft: [224, 56], ft2: [190, 40], kb2: 1, hdR: [4, -76] },
        { hip: [224, 166], tr: 90, ft: [224, 56], ft2: [238, 56], hdR: [4, -76] },
        { hip: [200, 150], tr: 84, ft: [224, 56], ft2: [190, 40], kb2: 1, hdR: [4, -76] }
      ]
    },
    {
      id: 'b-db-overhead-press', 
      zoom: 0.86, still: 0.5,
      fg: function (c, P, col) { dumbbell(c, P.hd, col); },
      frames: [
        { hip: [180, 112], tr: 90, nk: -8, ft: [186, 0], ft2: [192, 0], hdR: [22, 4], eb: 1 },
        { hip: [180, 112], tr: 90, nk: -8, ft: [186, 0], ft2: [192, 0], hdR: [12, 74], eb: 1 }
      ]
    },
    {
      id: 'b-45-hyperextension', 
      still: 0.5,
      bg: function (c, P, col) {
        c.strokeStyle = col.line; c.lineCap = 'round';
        c.lineWidth = 3; path(c, [[80, 0], [240, 0]]); path(c, [[96, 0], [96, 22]]); path(c, [[196, 0], [196, 84]]);
        c.lineWidth = 7; path(c, [[90, 14], [112, 14]]); path(c, [[176, 76], [206, 104]]);
      },
      frames: [
        { hip: [186, 108], ft: [104, 28], ft2: [104, 28], kb: -1, tr: -70, nk: 0 },
        { hip: [186, 108], ft: [104, 28], ft2: [104, 28], kb: -1, tr: 42, nk: 0 }
      ]
    },
    {
      id: 'b-side-lying-clam', 
      floor: 0.78, still: 0.5,
      frames: [
        { sh: [96, 14], head: [68, 22], hip: [176, 16], kn2: [206, 8], ft2: [264, 6], kn: [206, 20], ft: [264, 16] },
        { sh: [96, 14], head: [68, 22], hip: [176, 16], kn2: [206, 8], ft2: [264, 6], kn: [214, 64], ft: [264, 16] }
      ]
    },
    {
      id: 'b-crunch', 
      floor: 0.78, still: 0.5,
      frames: [
        { hip: [180, 14], mid: [140, 12], sh: [100, 12], ft: [252, 2], ft2: [258, 2] },
        { hip: [180, 14], mid: [142, 12], sh: [116, 44], ft: [252, 2], ft2: [258, 2] }
      ]
    },
    {
      id: 'b-side-crunch', 
      floor: 0.78, still: 0.5,
      frames: [
        { hip: [184, 14], mid: [144, 12], sh: [104, 14], ft: [292, 4], ft2: [290, 12] },
        { hip: [184, 14], mid: [148, 12], sh: [120, 44], ft: [292, 4], ft2: [290, 12] }
      ]
    },

    // ===== Rutina C =====
    {
      id: 'c-glute-march', 
      still: 0.25,
      bg: function (c, P, col) { bench(c, 36, 116, 40, col.line); },
      frames: [
        { sh: [100, 48], head: [78, 58], hip: [180, 62], ft: [250, 0], ft2: [258, 0] },
        { sh: [100, 48], head: [78, 58], hip: [180, 62], ft: [244, 46], ft2: [258, 0] },
        { sh: [100, 48], head: [78, 58], hip: [180, 62], ft: [250, 0], ft2: [258, 0] },
        { sh: [100, 48], head: [78, 58], hip: [180, 62], ft: [250, 0], ft2: [252, 46] }
      ]
    },
    {
      id: 'c-cable-column-row', 
      still: 0.5,
      bg: function (c, P, col) {
        c.strokeStyle = col.line; c.lineCap = 'round'; c.lineWidth = 5; path(c, [[318, 0], [318, 210]]);
        c.lineWidth = 3; c.beginPath(); c.arc(310, 164, 6, 0, Math.PI * 2); c.stroke();
      },
      fg: function (c, P, col) { c.strokeStyle = col.rose; c.lineWidth = 2; path(c, [[304, 164], P.hd]); disc(c, P.hd, 7, col.rose); },
      frames: [
        { hip: [150, 108], tr: 80, ft: [162, 0], ft2: [140, 0], hd: [242, 160] },
        { hip: [150, 108], tr: 86, ft: [162, 0], ft2: [140, 0], hd: [182, 146] }
      ]
    },
    {
      id: 'c-bodyweight-squat', 
      still: 0.5,
      frames: [
        { hip: [184, 112], tr: 90, ft: [194, 0], ft2: [200, 0], hdR: [72, -8] },
        { hip: [146, 50], tr: 50, ft: [194, 0], ft2: [200, 0], hdR: [72, 8] }
      ]
    },
    {
      id: 'c-db-incline-press', 
      zoom: 0.92, still: 0.5,
      bg: function (c, P, col) {
        c.strokeStyle = col.line; c.lineCap = 'round';
        c.lineWidth = 7; path(c, [[136, 44], [190, 44]]); path(c, [[140, 44], [74, 112]]);
        c.lineWidth = 3; path(c, [[176, 44], [176, 0]]); path(c, [[110, 74], [110, 0]]);
      },
      fg: function (c, P, col) { dumbbell(c, P.hd, col); },
      frames: [
        { hip: [152, 54], tr: 136, ft: [232, 0], ft2: [240, 0], el: [124, 66], hd: [118, 112] },
        { hip: [152, 54], tr: 136, ft: [232, 0], ft2: [240, 0], el: [112, 132], hd: [114, 170] }
      ]
    },
    {
      id: 'c-reaching-sl-rdl', 
      still: 0.5,
      frames: [
        { hip: [180, 112], tr: 90, ft: [186, 0], ft2: [172, 6], kb2: 1, hdR: [6, -74] },
        { hip: [176, 106], tr: 10, ft: [186, 0], ft2: [66, 90], kb2: 1, hdR: [10, -78] }
      ]
    },
    {
      id: 'c-x-band-walk', 
      view: 'front', still: 0.25, period: 6400,
      draw: function (c, P, col) {
        c.strokeStyle = col.rose; c.lineWidth = 2;
        path(c, [P.ftL, P.hdR]); path(c, [P.ftR, P.hdL]);
        front(c, P, col);
      },
      frames: (function () {
        var f = [];
        function at(x, l, r) { return { hip: [x, 104], neck: [x, 170], ftL: [l, 0], ftR: [r, 0], hdL: [x - 20, 92], hdR: [x + 20, 92] }; }
        f.push(at(130, 104, 156)); f.push(at(146, 104, 188)); f.push(at(162, 136, 188)); f.push(at(178, 136, 220));
        f.push(at(194, 168, 220)); f.push(at(178, 136, 220)); f.push(at(162, 136, 188)); f.push(at(146, 104, 188));
        return f;
      })()
    },
    {
      id: 'c-rkc-plank', 
      floor: 0.78, hold: true, still: 0,
      fg: function (c, P, col, ph) { pulse(c, P.hip, ph, col); },
      frames: [
        { ft: [70, 2], hip: [178, 28], sh: [242, 42], el: [256, 4], hd: [292, 4] }
      ],
      mod: function (P, ms) { return breathe(P, ms, 1, ['hip']); }
    },
    {
      id: 'c-rope-horizontal-chop', 
      view: 'front', still: 0.5,
      bg: function (c, P, col) {
        c.strokeStyle = col.line; c.lineCap = 'round'; c.lineWidth = 5; path(c, [[36, 0], [36, 210]]);
        c.lineWidth = 3; c.beginPath(); c.arc(44, 150, 6, 0, Math.PI * 2); c.stroke();
      },
      draw: function (c, P, col) {
        c.strokeStyle = col.rose; c.lineWidth = 2;
        var m = [(P.hdL[0] + P.hdR[0]) / 2, (P.hdL[1] + P.hdR[1]) / 2];
        path(c, [[50, 150], m]);
        front(c, P, col);
        disc(c, m, 7, col.rose);
      },
      frames: [
        { hip: [186, 104], neck: [184, 170], sw: 16, hx: -3, ftL: [152, 0], ftR: [220, 0], hdL: [112, 146], hdR: [120, 140], elL: [136, 152], elR: [150, 148] },
        { hip: [186, 104], neck: [188, 170], sw: 16, hx: 3, ftL: [152, 0], ftR: [220, 0], hdL: [262, 146], hdR: [268, 140], elL: [212, 156], elR: [238, 150] }
      ]
    }
  ];

  var byId = {};
  EX.forEach(function (e) { byId[e.id] = e; });

  // ---------- Músculos resaltados (halo rosa detrás de la figura) ----------
  function seg(c, a, b, t0, t1, w, col, al) {
    var p = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], q = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
    c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; path(c, [p, q]); c.globalAlpha = 1;
  }
  function blob(c, p, r, col, al) { c.globalAlpha = al; c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  function along(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  // hl = { p: [músculos principales], s: [músculos de apoyo] }
  function overlay(c, P, hl, col) {
    var lv = {}, r = col.rose;
    hl.s.forEach(function (k) { lv[k] = 0.38; });
    hl.p.forEach(function (k) { lv[k] = 0.9; });
    Object.keys(lv).forEach(function (k) {
      var a = lv[k];
      if (P.neck) { // vista de frente
        var sw = P.sw || 22;
        if (k === 'gmedio' || k === 'gluteos') { blob(c, [P.hip[0] - 14, P.hip[1]], 15, r, a); blob(c, [P.hip[0] + 14, P.hip[1]], 15, r, a); }
        else if (k === 'oblicuos' || k === 'abdomen') seg(c, P.hip, P.neck, 0.1, 0.8, 30, r, a);
        else if (k === 'deltoides') { blob(c, [P.neck[0] - sw, P.neck[1]], 14, r, a); blob(c, [P.neck[0] + sw, P.neck[1]], 14, r, a); }
        return;
      }
      var legs = [[P.kn, P.ft, 1], [P.kn2, P.ft2, 0.6]];
      if (k === 'gluteos') blob(c, P.hip, 20, r, a);
      else if (k === 'gmedio') blob(c, along(P.hip, P.sh, 0.12), 15, r, a);
      else if (k === 'isquios' || k === 'cuadriceps') legs.forEach(function (l) { if (l[0]) seg(c, P.hip, l[0], 0.08, 0.95, 26, r, a * l[2]); });
      else if (k === 'dorsales') seg(c, P.hip, P.sh, 0.35, 0.95, 26, r, a);
      else if (k === 'espalda') seg(c, P.hip, P.sh, 0.7, 1, 26, r, a);
      else if (k === 'erectores') seg(c, P.hip, P.sh, 0.05, 0.5, 24, r, a);
      else if (k === 'abdomen' || k === 'oblicuos') seg(c, P.hip, P.sh, 0.1, 0.8, 24, r, a);
      else if (k === 'deltoides') blob(c, P.sh, 15, r, a);
      else if (k === 'pecho') blob(c, along(P.hip, P.sh, 0.82), 15, r, a);
      else if ((k === 'biceps' || k === 'triceps') && P.el) seg(c, P.sh, P.el, 0.1, 0.9, 20, r, a);
    });
  }

  // Dibuja un cuadro de la animación "id" en el tiempo ms
  function draw(cv, id, ms, opt) {
    var ex = byId[id]; if (!ex) return;
    var c = cv.getContext('2d'), s = cv.width / W, col = colors(cv);
    var period = ex.period || PERIOD, ph = (opt && opt.still) ? (ex.still || 0) : (opt && opt.ph !== undefined) ? opt.ph : ((ms % period) / period);
    var F = H * (ex.floor || 0.86), k = ex.zoom || 1;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(s, 0, 0, s, 0, 0);
    // Piso
    c.strokeStyle = col.line; c.lineWidth = 3; c.lineCap = 'round'; path(c, [[20, F], [W - 20, F]]);
    // A partir de aquí: y hacia arriba, origen en el piso, zoom centrado
    c.translate(W / 2, F); c.scale(k, -k); c.translate(-W / 2, 0);
    var P = poseAt(ex, ph);
    if (ex.mod) P = ex.mod(P, (opt && opt.still) ? 0 : ms);
    if (ex.view !== 'front') P = solve(P);
    if (ex.bg) ex.bg(c, P, col, ph);
    if (opt && opt.hl) overlay(c, P, opt.hl, col);
    var done = false;
    if (opt && opt.render) done = opt.render(c, P, col, ex, ph, ms); else if (ex.draw) ex.draw(c, P, col, ph); else figure(c, P, col);
    if (ex.fg && !done) ex.fg(c, P, col, ph);
    if (ex.hold) holdRing(c, s, (opt && opt.still) ? 1 : (ms % 10000) / 10000, col);
  }

  // Anima en bucle. Respeta "reducir movimiento". Devuelve una función para detener.
  function play(cv, id, hl) {
    var reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, raf = 0, on = true;
    if (reduce) { draw(cv, id, 0, { still: true, hl: hl }); return function () {}; }
    function tick(ts) { if (!on) return; draw(cv, id, ts, { hl: hl }); raf = requestAnimationFrame(tick); }
    raf = requestAnimationFrame(tick);
    return function () { on = false; cancelAnimationFrame(raf); };
  }

  SCAnim = {
    draw: draw,
    play: play,
    // Postura resuelta en el tiempo ms (para escenas 3D): { P, view, hold }
    pose: function (id, ms) {
      var ex = byId[id], period = ex.period || PERIOD, ph = (ms % period) / period;
      var P = poseAt(ex, ph); if (ex.mod) P = ex.mod(P, ms); if (ex.view !== 'front') P = solve(P);
      return { P: P, view: ex.view || 'side', hold: !!ex.hold };
    },
    ik: ik,
    periodOf: function (id) { return (byId[id] && byId[id].period) || PERIOD; }
  };
})();
export { SCAnim };

/* eslint-disable */
// @ts-nocheck
// Escena 3D de la cinemática (three.js 0.150.1, fijada para conservar la luz original).
// Se carga solo cuando abres la vista previa. Portada de cinematica-sesion.html sin cambios de estilo.
import * as T from 'three';
import { SCAnim } from './animaciones';

const SC = 0.009, CX = 180, Yv = new T.Vector3(0, 1, 0);

/** Crea la escena dentro de `canvas`. `frame(seg, local, ts)` dibuja un cuadro; `dispose()` libera todo. */
export function crearEscena(canvas, sceneEl, reduce) {
  var curEx = null;
  // ---------- Escena ----------
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  var scene = new T.Scene(); scene.background = new T.Color(0x120e19); scene.fog = new T.Fog(0x120e19, 7, 17);
  var cam = new T.PerspectiveCamera(38, 4 / 3, 0.1, 40);
  function resize() { var w = sceneEl.clientWidth, h = sceneEl.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  var ro = null;
  if ('ResizeObserver' in window) { ro = new ResizeObserver(resize); } if (ro) ro.observe(sceneEl); resize();

  scene.add(new T.HemisphereLight(0x6a5a8c, 0x120e19, 0.9));
  var key = new T.SpotLight(0xffe2ea, 1.5, 14, 0.55, 0.7, 1); key.position.set(-2.4, 5, 3.2); key.target.position.set(0, 0.6, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
  var rim = new T.DirectionalLight(0xb79cff, 1.2); rim.position.set(3, 3, -4); scene.add(rim);
  var fill = new T.PointLight(0xf2b8c6, 0.7, 8); fill.position.set(2.5, 1.2, 2.5); scene.add(fill);

  function canvasTex(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); var tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 4; return tx; }
  var floorTex = canvasTex(512, 512, function (g, w, h) {
    var r = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); r.addColorStop(0, '#47386a'); r.addColorStop(0.55, '#231a35'); r.addColorStop(1, '#120e19'); g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(201,179,245,.16)'; g.lineWidth = 2; for (var i = 1; i < 9; i++) { g.beginPath(); g.arc(w / 2, h / 2, i * 28, 0, 6.283); g.stroke(); }
    g.strokeStyle = 'rgba(201,179,245,.08)'; for (var a = 0; a < 24; a++) { g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a / 24 * 6.283) * w / 2, h / 2 + Math.sin(a / 24 * 6.283) * h / 2); g.stroke(); }
  });
  var floor = new T.Mesh(new T.CircleGeometry(9, 64), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.25 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  var wallTex = canvasTex(1024, 256, function (g, w, h) {
    g.fillStyle = '#171022'; g.fillRect(0, 0, w, h);
    for (var x = 0; x < w; x += 128) { var l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, 'rgba(201,179,245,0)'); l.addColorStop(0.5, 'rgba(201,179,245,.9)'); l.addColorStop(1, 'rgba(201,179,245,0)'); g.fillStyle = l; g.fillRect(x + 60, 20, 5, h - 40); }
    g.fillStyle = 'rgba(242,184,198,.25)'; g.fillRect(0, h - 36, w, 3);
  });
  wallTex.wrapS = T.RepeatWrapping; wallTex.repeat.set(4, 1);
  var wall = new T.Mesh(new T.CylinderGeometry(8, 8, 5.5, 64, 1, true), new T.MeshBasicMaterial({ map: wallTex, side: T.BackSide, fog: true })); wall.position.y = 2.7; scene.add(wall);
  var ring1 = new T.Mesh(new T.RingGeometry(1.9, 1.96, 96), new T.MeshBasicMaterial({ color: 0xc9b3f5, transparent: true, opacity: 0.6 })); ring1.rotation.x = -Math.PI / 2; ring1.position.y = 0.005; scene.add(ring1);
  var ring2 = new T.Mesh(new T.RingGeometry(2.5, 2.53, 96), new T.MeshBasicMaterial({ color: 0xf2b8c6, transparent: true, opacity: 0.25 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.005; scene.add(ring2);
  var dust; (function () { var n = 160, pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 10; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * 10; } var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); dust = new T.Points(g, new T.PointsMaterial({ color: 0xd9c9ff, size: 0.03, transparent: true, opacity: 0.55, depthWrite: false })); scene.add(dust); })();

  // ---------- Personaje (cilindros cónicos y esferas) ----------
  var matA = new T.MeshStandardMaterial({ color: 0xa68ee0, roughness: 0.5, metalness: 0.05 });
  var matB = new T.MeshStandardMaterial({ color: 0x7d66bd, roughness: 0.55, metalness: 0.05 });
  var rig = new T.Group(); scene.add(rig);
  function limb(rBot, rTop, mat, flat) { var m = new T.Mesh(new T.CylinderGeometry(rTop, rBot, 1, 16), mat); m.castShadow = true; m.userData.flat = flat || 1; rig.add(m); return m; }
  function place(m, a, b) { var d = b.clone().sub(a), len = d.length() || 0.001; m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Yv, d.normalize()); m.scale.set(1, len, m.userData.flat); m.visible = true; }
  var R = {
    thN: limb(0.058, 0.088, matA), shN: limb(0.04, 0.06, matA), thF: limb(0.058, 0.088, matB), shF: limb(0.04, 0.06, matB),
    ftN: limb(0.03, 0.04, matA), ftF: limb(0.03, 0.04, matB),
    uaN: limb(0.04, 0.052, matA), faN: limb(0.03, 0.04, matA), uaF: limb(0.04, 0.052, matB), faF: limb(0.03, 0.04, matB),
    tor: limb(0.115, 0.125, matA, 0.72), tor2: limb(0.115, 0.125, matA, 0.72), pel: limb(0.085, 0.085, matA), shb: limb(0.058, 0.058, matA), neck: limb(0.045, 0.045, matA)
  };
  var balls = []; for (var bi = 0; bi < 16; bi++) { var bm = new T.Mesh(new T.SphereGeometry(1, 20, 14), matA); bm.castShadow = true; rig.add(bm); balls.push(bm); }
  var head = new T.Mesh(new T.SphereGeometry(0.115, 24, 18), matA); head.castShadow = true; head.scale.set(0.95, 1.08, 0.92); rig.add(head);
  // Halos de músculo (aditivos)
  var glows = [], glowS = [];
  for (var gi = 0; gi < 14; gi++) { var gm = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 18), new T.MeshBasicMaterial({ color: 0xd4457a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); rig.add(gm); glows.push(gm); }
  for (var gs = 0; gs < 8; gs++) { var sm = new T.Mesh(new T.SphereGeometry(1, 18, 12), new T.MeshBasicMaterial({ color: 0xd4457a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); rig.add(sm); glowS.push(sm); }
  var DBm = new T.MeshStandardMaterial({ color: 0x2c2636, roughness: 0.4, metalness: 0.7 });
  var dbs = [0, 1].map(function () { var g = new T.Group(), bar = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.3, 10), DBm), p1 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.05, 6), DBm), p2 = p1.clone(); bar.rotation.x = Math.PI / 2; p1.rotation.x = Math.PI / 2; p2.rotation.x = Math.PI / 2; p1.position.z = 0.12; p2.position.z = -0.12; g.add(bar, p1, p2); g.traverse(function (o) { o.castShadow = true; }); g.visible = false; rig.add(g); return g; });
  var cableM = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 1, 6), new T.MeshBasicMaterial({ color: 0xf2b8c6 })); cableM.visible = false; scene.add(cableM);
  var bandM = [0, 1].map(function () { var m = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 1, 6), new T.MeshBasicMaterial({ color: 0xf2b8c6 })); m.visible = false; scene.add(m); return m; });

  function V(p, z) { return new T.Vector3((p[0] - CX) * SC, p[1] * SC, z || 0); }
  function lerp3(a, b, u) { return a.clone().lerp(b, u); }
  var bi2 = 0;
  function ball(p, r) { var b = balls[bi2++]; if (!b) return; b.position.copy(p); b.scale.setScalar(r); b.visible = true; }
  var DB = { 'a-one-arm-row': 1, 'a-db-bench-press': 2, 'a-db-rdl': 2, 'b-db-overhead-press': 2, 'c-db-incline-press': 2 };

  function legSet(a, k, f, mt, ms, fm, dir, r0) { place(R[mt], a, k); place(R[ms], k, f); var fe = f.clone().addScaledVector(dir, 0.15); place(R[fm], f, fe); ball(k, 0.058); ball(f, 0.04); }
  function armSet(s, e, h, mu, mf) { place(R[mu], s, e); place(R[mf], e, h); ball(e, 0.04); ball(h, 0.035); }

  var J = {};
  function setRig(po) {
    var P = po.P; Object.keys(R).forEach(function (k) { R[k].visible = false; }); balls.forEach(function (b) { b.visible = false; }); bi2 = 0;
    var zl = 0.09, za = 0.19, fd;
    if (po.view !== 'front') {
      var sh = V(P.sh), hp = V(P.hip), hdN = P.head ? V(P.head) : sh.clone();
      J = { hipC: hp, shC: sh, neck: sh, hipN: V(P.hip, zl), hipF: V(P.hip, -zl) };
      if (P.mid) { var md = V(P.mid); place(R.tor, hp, md); place(R.tor2, md, sh); } else place(R.tor, hp, sh);
      place(R.pel, V(P.hip, -0.11), V(P.hip, 0.11)); place(R.shb, V(P.sh, -za), V(P.sh, za));
      place(R.neck, sh, hdN); head.position.copy(hdN); head.visible = true;
      if (P.kn) { var d1 = [P.ft[0] - P.kn[0], P.ft[1] - P.kn[1]], n1 = Math.hypot(d1[0], d1[1]) || 1; fd = new T.Vector3(-d1[1] / n1, d1[0] / n1, 0); legSet(J.hipN, V(P.kn, zl), V(P.ft, zl), 'thN', 'shN', 'ftN', fd); J.knN = V(P.kn, zl); }
      var k2 = P.kn2 || P.kn, f2 = P.ft2 || P.ft;
      if (k2) { var d2 = [f2[0] - k2[0], f2[1] - k2[1]], n2 = Math.hypot(d2[0], d2[1]) || 1; legSet(J.hipF, V(k2, -zl), V(f2, -zl), 'thF', 'shF', 'ftF', new T.Vector3(-d2[1] / n2, d2[0] / n2, 0)); J.knF = V(k2, -zl); }
      if (P.hd) { J.elN = V(P.el, za); J.hdN = V(P.hd, za); armSet(V(P.sh, za), J.elN, J.hdN, 'uaN', 'faN'); var e2 = P.el2 || P.el, h2 = P.hd2 || P.hd; J.elF = V(e2, -za); J.hdF = V(h2, -za); armSet(V(P.sh, -za), J.elF, J.hdF, 'uaF', 'faF'); }
      else { J.elN = J.elF = J.hdN = J.hdF = null; }
      ball(V(P.sh, za), 0.07); ball(V(P.sh, -za), 0.07); ball(hp, 0.13);
    } else {
      var ik = SCAnim.ik, hw = 13, sw = P.sw || 22, hl = [P.hip[0] - hw, P.hip[1]], hr = [P.hip[0] + hw, P.hip[1]], sl = [P.neck[0] - sw, P.neck[1]], sr = [P.neck[0] + sw, P.neck[1]];
      var kl = ik(hl, P.ftL, 58, 56, -1), kr = ik(hr, P.ftR, 58, 56, 1), el = P.elL || ik(sl, P.hdL, 40, 38, -1), er = P.elR || ik(sr, P.hdR, 40, 38, 1);
      fd = new T.Vector3(0, 0, 1);
      var hp2 = V(P.hip), nk = V(P.neck);
      J = { hipC: hp2, shC: nk, neck: nk, hipN: V(hl), hipF: V(hr), knN: V(kl), knF: V(kr), elN: V(el), elF: V(er), hdN: V(P.hdL), hdF: V(P.hdR), sl: V(sl), sr: V(sr), front: true };
      legSet(V(hl), V(kl), V(P.ftL), 'thN', 'shN', 'ftN', fd); legSet(V(hr), V(kr), V(P.ftR), 'thF', 'shF', 'ftF', fd);
      place(R.tor, hp2, nk); place(R.pel, V(hl), V(hr)); place(R.shb, V(sl), V(sr));
      armSet(V(sl), V(el), V(P.hdL), 'uaN', 'faN'); armSet(V(sr), V(er), V(P.hdR), 'uaF', 'faF');
      var hh = V([P.neck[0] + (P.hx || 0), P.neck[1] + 26]); place(R.neck, nk, hh); head.position.copy(hh); head.visible = true;
      ball(V(sl), 0.07); ball(V(sr), 0.07); ball(hp2, 0.12);
    }
  }
  var gC = 0, gSn = 0;
  function gcyl(a, b, t0, t1, r, al) { if (!a || !b || gC >= glows.length) return; var m = glows[gC++], p = lerp3(a, b, t0), q = lerp3(a, b, t1), d = q.clone().sub(p), len = d.length() || 0.001; m.position.copy(p).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Yv, d.normalize()); m.scale.set(r, len, r * 0.8); m.material.opacity = al; m.visible = true; }
  function gsph(p, r, al) { if (!p || gSn >= glowS.length) return; var m = glowS[gSn++]; m.position.copy(p); m.scale.setScalar(r); m.material.opacity = al; m.visible = true; }
  function glowMuscles(hl, ms) {
    glows.forEach(function (m) { m.visible = false; }); glowS.forEach(function (m) { m.visible = false; }); gC = 0; gSn = 0;
    var pulse = 0.75 + 0.25 * Math.sin(ms / 380), lv = {};
    hl.s.forEach(function (k) { lv[k] = 0.25; }); hl.p.forEach(function (k) { lv[k] = 0.5 * pulse; });
    Object.keys(lv).forEach(function (k) {
      var a = lv[k], hp = J.hipC, sh = J.shC;
      if (k === 'gluteos') gsph(hp, 0.2, a);
      else if (k === 'gmedio') { gsph(lerp3(hp, sh, 0.1).add(new T.Vector3(0, 0, 0.12)), 0.13, a); gsph(lerp3(hp, sh, 0.1).add(new T.Vector3(0, 0, -0.12)), 0.13, a); }
      else if (k === 'isquios' || k === 'cuadriceps') { gcyl(J.hipN, J.knN, 0.1, 0.92, 0.115, a); gcyl(J.hipF, J.knF, 0.1, 0.92, 0.115, a * 0.7); }
      else if (k === 'dorsales') gcyl(hp, sh, 0.38, 0.92, 0.17, a);
      else if (k === 'espalda') gcyl(hp, sh, 0.72, 1, 0.16, a);
      else if (k === 'erectores') gcyl(hp, sh, 0.06, 0.5, 0.15, a);
      else if (k === 'abdomen' || k === 'oblicuos') gcyl(hp, sh, 0.1, 0.8, 0.15, a);
      else if (k === 'deltoides') { gsph(J.front ? J.sl : sh.clone().add(new T.Vector3(0, 0, 0.19)), 0.1, a); gsph(J.front ? J.sr : sh.clone().add(new T.Vector3(0, 0, -0.19)), 0.1, a); }
      else if (k === 'pecho') gsph(lerp3(hp, sh, 0.82).add(new T.Vector3(0, 0, 0.04)), 0.14, a);
      else if ((k === 'biceps' || k === 'triceps') && J.elN) { gcyl(sh.clone().add(new T.Vector3(0, 0, 0.19)), J.elN, 0.1, 0.9, 0.065, a); }
    });
  }

  // ---------- Utilería por ejercicio ----------
  var padMat = new T.MeshStandardMaterial({ color: 0x3c3250, roughness: 0.8 }), frameMat = new T.MeshStandardMaterial({ color: 0x6d5fa0, roughness: 0.4, metalness: 0.6 }), matMat = new T.MeshStandardMaterial({ color: 0x4a3b78, roughness: 0.9 });
  function bx(g, x1, x2, y1, y2, d, mat) { var m = new T.Mesh(new T.BoxGeometry((x2 - x1) * SC, (y2 - y1) * SC, d), mat); m.position.set(((x1 + x2) / 2 - CX) * SC, ((y1 + y2) / 2) * SC, 0); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
  function beam(g, a, b, w, d, mat) { var A = V(a), B = V(b), dd = B.clone().sub(A), m = new T.Mesh(new T.BoxGeometry(w * SC, 1, d), mat); m.position.copy(A).addScaledVector(dd, 0.5); m.quaternion.setFromUnitVectors(Yv, dd.clone().normalize()); m.scale.y = dd.length(); m.castShadow = m.receiveShadow = true; g.add(m); }
  function bench(g, x1, x2, h) { bx(g, x1, x2, h - 8, h, 0.4, padMat); bx(g, x1 + 12, x1 + 20, 0, h - 8, 0.06, frameMat); bx(g, x2 - 20, x2 - 12, 0, h - 8, 0.06, frameMat); }
  function pbox(g, x1, x2, h) { bx(g, x1, x2, 0, h, 0.55, padMat); }
  function col(g, x, top) { bx(g, x - 6, x + 6, 0, top, 0.14, frameMat); }
  var PROPS = {}, MATS = ['a-glute-bridge', 'a-side-lying-abduction', 'a-front-plank', 'a-side-plank-knees', 'b-fe-single-leg-glute-bridge', 'b-side-lying-clam', 'b-crunch', 'b-side-crunch', 'c-rkc-plank'];
  var CABLE = { 'b-front-lat-pulldown': [196, 256], 'c-cable-column-row': [310, 164], 'c-rope-horizontal-chop': [44, 150] };
  function propsFor(id) {
    if (PROPS[id]) return PROPS[id];
    var g = new T.Group();
    if (MATS.indexOf(id) >= 0) { var m = new T.Mesh(new T.BoxGeometry(3.4, 0.025, 0.95), matMat); m.position.y = 0.0125; m.receiveShadow = true; g.add(m); }
    if (id === 'a-one-arm-row') bench(g, 100, 285, 40);
    if (id === 'a-box-squat') pbox(g, 104, 160, 50);
    if (id === 'a-db-bench-press') bench(g, 50, 215, 40);
    if (id === 'b-fe-single-leg-glute-bridge') pbox(g, 236, 300, 40);
    if (id === 'b-step-up') pbox(g, 196, 276, 56);
    if (id === 'c-glute-march') bench(g, 36, 116, 40);
    if (id === 'b-front-lat-pulldown') { col(g, 300, 262); bx(g, 196, 300, 256, 262, 0.14, frameMat); pbox(g, 128, 194, 54); bx(g, 220, 244, 92, 100, 0.3, padMat); }
    if (id === 'c-cable-column-row') { col(g, 318, 210); pbox(g, 120, 190, 36); }
    if (id === 'c-rope-horizontal-chop') col(g, 36, 210);
    if (id === 'c-db-incline-press') { beam(g, [140, 44], [74, 112], 36, 0.4, padMat); bx(g, 136, 190, 36, 44, 0.4, padMat); bx(g, 176, 184, 0, 36, 0.06, frameMat); bx(g, 100, 108, 0, 74, 0.06, frameMat); }
    if (id === 'b-45-hyperextension') { beam(g, [176, 76], [206, 104], 30, 0.4, padMat); bx(g, 190, 200, 0, 84, 0.1, frameMat); bx(g, 86, 116, 10, 18, 0.3, frameMat); bx(g, 100, 106, 0, 10, 0.1, frameMat); }
    g.visible = false; scene.add(g); PROPS[id] = g; return g;
  }
  var shownProps = null;
  function setProps(id) { if (shownProps) shownProps.visible = false; shownProps = propsFor(id); shownProps.visible = true; }

  function drawProps(id, po) {
    var P = po.P, n = DB[id] || 0, hs = [J.hdN, J.hdF];
    dbs.forEach(function (d, i) { d.visible = i < n && !!hs[i]; if (d.visible) d.position.copy(hs[i]); });
    var cb = CABLE[id];
    if (cb && (P.hd || P.hdL)) { var a = V(cb), b = P.hd ? V(P.hd, 0.19) : lerp3(J.hdN, J.hdF, 0.5), d = b.clone().sub(a); cableM.position.copy(a).addScaledVector(d, 0.5); cableM.quaternion.setFromUnitVectors(Yv, d.clone().normalize()); cableM.scale.y = d.length(); cableM.visible = true; } else cableM.visible = false;
    if (id === 'c-x-band-walk') { [[V(P.ftL), J.hdF], [V(P.ftR), J.hdN]].forEach(function (pr, i) { var d = pr[1].clone().sub(pr[0]), m = bandM[i]; m.position.copy(pr[0]).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Yv, d.clone().normalize()); m.scale.y = d.length(); m.visible = true; }); } else bandM.forEach(function (m) { m.visible = false; });
  }

  // ---------- Cámara ----------
  var SHOTS = [{ az: -0.6, dir: 1, h: 1.15, R0: 4.8, R1: 3.5, fov: 36, ty: 0.7 }, { az: 0.55, dir: -1, h: 0.5, R0: 4.2, R1: 3.1, fov: 42, ty: 0.6 }, { az: 0.2, dir: 1, h: 2.1, R0: 5.2, R1: 4.2, fov: 34, ty: 0.5 }, { az: -0.3, dir: -1, h: 0.9, R0: 3.9, R1: 3.2, fov: 46, ty: 0.8 }];
  function ease(u) { return u * u * (3 - 2 * u); }
  function camPlace(s, local, dur, focus) {
    var u = Math.min(1, local / dur), tx = focus.x, ty, az, rad, h, fov;
    if (s.k === 'ex' || s.k === 'rest') { var sh = SHOTS[(s.shot || 0) % SHOTS.length]; az = sh.az + sh.dir * 0.22 * (local / 1000); rad = sh.R0 + (sh.R1 - sh.R0) * ease(u); h = sh.h; fov = sh.fov; ty = sh.ty; }
    else if (s.i === 0) { az = -0.95 + 0.7 * ease(u); rad = 9.5 - 4 * ease(u); h = 3.4 - 2.2 * ease(u); fov = 40; ty = 0.7; }
    else { az = 0.9 - 1.5 * ease(u); rad = 6.5 - 1.5 * ease(u); h = 1.6; fov = 40; ty = 0.7; }
    if (reduce) { az = 0; rad = 4.2; h = 1.1; }
    var ar = cam.aspect; if (ar < 1.33) { rad *= 1.33 / ar * 0.9; ty -= 0.12; }
    cam.position.set(tx + Math.sin(az) * rad, h, Math.cos(az) * rad); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(tx, ty, 0);
  }

  var ENV_T = 0;
  function frameScene(s, local, ts) {
    var e = s.e, ms = (s.k === 'ex' && !reduce) ? local : 0;
    if (!e) return;
    if (curEx !== e.anim) { curEx = e.anim; setProps(curEx); }
    var po = SCAnim.pose(e.anim, ms); setRig(po); glowMuscles({ p: e.p, s: e.s }, ts); drawProps(e.anim, po);
    var fx = (po.P.hip[0] - CX) * SC; camPlace(s, local, s.d, { x: fx * 0.6 });
    ring1.material.opacity = 0.45 + 0.15 * Math.sin(ts / 700); ring2.rotation.z = ts / 9000;
    dust.rotation.y = ts / 40000; dust.position.y = Math.sin(ts / 3000) * 0.05;
    renderer.render(scene, cam);
  }

  function dispose() {
    if (ro) ro.disconnect();
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { var m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(function (x) { if (x.map) x.map.dispose(); x.dispose(); }); }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return { frame: frameScene, dispose: dispose, resize: resize };
}

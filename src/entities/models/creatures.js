// Enemigos: Bellotín, Escarabajo, Avispón y Planta ígnea (flor-dragón).
// Frente de cada modelo = +Z local; se gira en Y hacia la dirección de marcha (vista 3/4 hacia cámara).
import {
  THREE, TAU, cached, mat, tex, rnd, noiseFill, merge, vcolor, scaleUV, capsuleBetween, tube, lathe,
  mesh, group, makeEye, setEyeX, blink, faceDir, damp, segs, glowSprite, isLow,
} from './common.js';

// =====================================================================================
// BELLOTÍN
// =====================================================================================
function acornRes() {
  return cached('res:acorn', () => {
    const nutTex = tex('acornNut', 256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, '#5a2c10'); gr.addColorStop(0.12, '#8a4a1c'); gr.addColorStop(0.45, '#c8782f');
      gr.addColorStop(0.8, '#e09a48'); gr.addColorStop(0.93, '#f2cf8a'); gr.addColorStop(1, '#f6dca0');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // vetas verticales sutiles
      for (let i = 0; i < 46; i++) {
        const x = rnd() * w; g.strokeStyle = `rgba(${rnd() < 0.5 ? '90,40,10' : '255,220,160'},${0.05 + rnd() * 0.08})`;
        g.lineWidth = 1 + rnd() * 3; g.beginPath(); g.moveTo(x, h); g.bezierCurveTo(x + 6, h * 0.6, x - 6, h * 0.3, x + rnd() * 4, h * 0.05); g.stroke();
      }
      noiseFill(g, w, h, 10, 2);
    });
    const capTex = tex('acornCap', 256, 128, (g, w, h) => {
      g.fillStyle = '#4a2810'; g.fillRect(0, 0, w, h);
      const rows = 9, cols = 16;
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
        const sw = w / cols, sh = h / rows, x = c * sw + (r % 2) * sw / 2, y = r * sh;
        const gr = g.createLinearGradient(0, y, 0, y + sh * 1.3);
        const l = 0.85 + rnd() * 0.3;
        gr.addColorStop(0, `rgb(${70 * l | 0},${38 * l | 0},${16 * l | 0})`);
        gr.addColorStop(0.55, `rgb(${150 * l | 0},${96 * l | 0},${50 * l | 0})`);
        gr.addColorStop(1, `rgb(${185 * l | 0},${128 * l | 0},${70 * l | 0})`);
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + sh * 0.55, sw * 0.52, sh * 0.8, 0, 0, Math.PI); g.lineTo(x - sw * 0.52, y); g.fill();
        g.strokeStyle = 'rgba(40,18,6,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y + sh * 0.55, sw * 0.52, sh * 0.8, 0, 0, Math.PI); g.stroke();
      }
      noiseFill(g, w, h, 14, 1);
    });
    const n = segs(28, 22, 14);
    const nut = lathe([[0, 0.07], [0.035, 0.08], [0.06, 0.1], [0.13, 0.125], [0.21, 0.165], [0.28, 0.22], [0.33, 0.29], [0.355, 0.36], [0.362, 0.43], [0.352, 0.5], [0.33, 0.55], [0.2, 0.57], [0, 0.575]], n);
    const capG = lathe([[0.31, 0.5], [0.37, 0.51], [0.4, 0.535], [0.412, 0.565], [0.405, 0.605], [0.38, 0.655], [0.33, 0.71], [0.25, 0.76], [0.14, 0.792], [0, 0.802]], n);
    scaleUV(capG, 3, 1);
    const stem = tube([[0, 0.78, 0], [0.01, 0.86, 0], [0.05, 0.92, 0.0], [0.1, 0.94, 0]], 0.032, 10, 6, (t) => 1 - t * 0.35);
    const foot = new THREE.SphereGeometry(1, 14, 10);
    const brow = capsuleBetween([-0.07, 0, 0], [0.07, 0, 0], 0.03, 3, 6);
    const mouth = new THREE.TorusGeometry(0.055, 0.016, 6, 14, Math.PI);
    const tooth = new THREE.ConeGeometry(0.02, 0.04, 6); tooth.rotateX(Math.PI);
    [nut, capG, stem, foot, brow, mouth, tooth].forEach((g) => (g.userData.shared = true));
    return {
      nut, capG, stem, foot, brow, mouth, tooth,
      nutMat: mat('acornNut', { physical: true, map: nutTex, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, rim: [0xffe0b0, 0.35, 3] }),
      capMat: mat('acornCap', { map: capTex, bumpMap: capTex, bumpScale: 2.5, roughness: 0.85, rim: [0xffd8a0, 0.25, 3] }),
      darkMat: mat('acornDark', { color: 0x3a1c0a, roughness: 0.6 }),
      footMat: mat('acornFoot', { color: 0x5a2e12, roughness: 0.55, rim: [0xffc890, 0.2, 3] }),
      mouthMat: mat('mouthDark', { color: 0x2a0c06, roughness: 0.5 }),
      toothMat: mat('tooth', { color: 0xfff6e8, roughness: 0.3 }),
    };
  });
}

/** Bellotín: bellota enfadada que camina. s = { vx, time, squashed(bool), dead(bool) } */
export function createAcornModel() {
  const R = acornRes();
  const root = new THREE.Group();
  const squashG = group(), yawG = group(), flip = group(), off = group(), bodyG = group();
  root.add(squashG); squashG.add(yawG); yawG.add(flip); flip.add(off); off.add(bodyG);
  flip.position.y = 0.42; off.position.y = -0.42;
  const nut = mesh(R.nut, R.nutMat); const cap = mesh(R.capG, R.capMat); const stem = mesh(R.stem, R.footMat);
  bodyG.add(nut, cap, stem);
  // cara
  const face = group(); bodyG.add(face);
  const eyes = [-1, 1].map((sx) => { const e = makeEye(0.108, 'brown', 1, 1.12, 0.78); e.position.set(sx * 0.118, 0.375, 0.29); e.rotation.y = sx * 0.28; face.add(e); return e; });
  const brows = [-1, 1].map((sx) => { const b = mesh(R.brow, R.darkMat, false); b.position.set(sx * 0.12, 0.485, 0.345); b.rotation.set(-0.25, sx * 0.3, sx * 0.42); face.add(b); return b; });
  const mouth = mesh(R.mouth, R.mouthMat, false); mouth.position.set(0, 0.225, 0.3); mouth.rotation.x = -0.35; face.add(mouth);
  const tooth = mesh(R.tooth, R.toothMat, false); tooth.position.set(0.03, 0.262, 0.305); face.add(tooth);
  const feet = [-1, 1].map((sx) => { const f = mesh(R.foot, R.footMat); f.scale.set(0.085, 0.065, 0.12); f.position.set(sx * 0.15, 0.06, 0.03); off.add(f); return f; });
  const st = { dir: -1, sq: 0, wasSq: false, deadT: 0, blinkOff: Math.random() * 4 };
  return {
    root,
    update(dt, s) {
      const t = s.time;
      yawG.rotation.y = faceDir(st, s.vx, dt, 0.85);
      // aplastado: tortita con ojos en X
      if (s.squashed && !st.wasSq) { st.sq = 0; eyes.forEach((e) => setEyeX(e, true)); }
      if (!s.squashed && st.wasSq) eyes.forEach((e) => setEyeX(e, false));
      st.wasSq = s.squashed;
      if (s.squashed) {
        st.sq += dt;
        const k = Math.min(1, st.sq / 0.08), wob = Math.sin(st.sq * 30) * Math.exp(-st.sq * 8) * 0.12;
        squashG.scale.set(1 + 0.45 * k + wob, 1 - 0.74 * k - wob * 0.5, 1 + 0.45 * k + wob);
        feet.forEach((f) => (f.position.z = 0.03));
        return;
      }
      squashG.scale.set(1, 1, 1);
      if (s.dead) {
        st.deadT += dt;
        flip.rotation.z = Math.min(Math.PI, st.deadT * 14) + st.deadT * 2; flip.rotation.x = 0.3;
        eyes.forEach((e) => setEyeX(e, true));
        return;
      }
      // caminar: pasitos, balanceo y rebote con squash & stretch
      const ph = t * 11;
      const bob = Math.abs(Math.sin(ph));
      bodyG.position.y = bob * 0.035;
      bodyG.rotation.z = Math.sin(ph) * 0.09;
      bodyG.rotation.x = 0.06;
      bodyG.scale.set(1 + (1 - bob) * 0.03, 1 - (1 - bob) * 0.04, 1 + (1 - bob) * 0.03);
      feet.forEach((f, i) => {
        const p = ph + i * Math.PI;
        f.position.z = 0.03 + Math.sin(p) * 0.09;
        f.position.y = 0.06 + Math.max(0, Math.cos(p)) * 0.05;
        f.rotation.x = -Math.cos(p) * 0.4;
      });
      const bl = blink(t, st.blinkOff);
      eyes.forEach((e) => (e.scale.y = 0.108 * 1.12 * bl));
      const browB = Math.sin(t * 3.1) * 0.012 + bob * 0.01;
      brows.forEach((b) => (b.position.y = 0.485 + browB));
      mouth.scale.set(1, 1 + Math.sin(t * 5) * 0.1, 1);
    },
  };
}

// =====================================================================================
// ESCARABAJO
// =====================================================================================
function beetleRes() {
  return cached('res:beetle', () => {
    const shellTex = tex('beetleShell', 256, 128, (g, w, h) => {
      // v: arriba (polo) → borde. Degradado iridiscente + ribete dorado + punteado
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#4ef0a8'); gr.addColorStop(0.35, '#10a868'); gr.addColorStop(0.75, '#08607a');
      gr.addColorStop(0.88, '#122c6a'); gr.addColorStop(0.9, '#f6cf5a'); gr.addColorStop(0.97, '#c0841c'); gr.addColorStop(1, '#6a3c0c');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 40; c++) {
        const x = (c + (r % 2) * 0.5) * w / 40, y = 8 + r * h * 0.085;
        g.fillStyle = 'rgba(0,30,40,0.25)'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
      }
      // franjas longitudinales (meridianos)
      for (let c = 0; c < 8; c++) { g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(c * w / 8 + 6, 0, 5, h * 0.86); }
    });
    const bump = tex('beetleBump', 256, 128, (g, w, h) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 40; c++) {
        const x = (c + (r % 2) * 0.5) * w / 40, y = 8 + r * h * 0.085;
        g.fillStyle = '#404040'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
      }
      g.fillStyle = '#c0c0c0'; g.fillRect(0, h * 0.88, w, h * 0.06);
    }, { srgb: false });
    const n = segs(26, 20, 12);
    const half = (start) => { const g = new THREE.SphereGeometry(1, n / 2 | 0, segs(14, 10, 7), start, Math.PI, 0, Math.PI / 2); g.scale(0.37, 0.4, 0.47); return g; };
    const shellR = half(Math.PI / 2); shellR.translate(0.012, 0, 0);
    const shellL = half(Math.PI * 1.5); shellL.translate(-0.012, 0, 0);
    const shell = merge([shellR, shellL]);
    const belly = new THREE.SphereGeometry(1, n, 8, 0, TAU, Math.PI / 2, Math.PI / 2); belly.scale(0.35, 0.1, 0.44);
    const rimG = new THREE.TorusGeometry(1, 0.06, 6, n); rimG.rotateX(Math.PI / 2); rimG.scale(0.37, 0.6, 0.47);
    const head = new THREE.SphereGeometry(0.19, 18, 14);
    const legR = merge([capsuleBetween([0, 0, 0], [0.12, 0.06, 0], 0.042, 3, 6), capsuleBetween([0.12, 0.06, 0], [0.17, -0.19, 0.02], 0.036, 3, 6), new THREE.SphereGeometry(0.048, 8, 6).translate(0.17, -0.19, 0.02)]);
    const legL = legR.clone().scale(-1, 1, 1);
    // invertir caras al espejar
    { const p = legL.attributes.position, nn = legL.attributes.normal; for (let i = 0; i < p.count; i += 3) { for (const a of [p, nn]) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); } } }
    const ant = (sx) => tube([[sx * 0.05, 0, 0], [sx * 0.09, 0.16, 0.05], [sx * 0.13, 0.32, 0.03], [sx * 0.2, 0.4, 0.1]], 0.014, 12, 5);
    const antennae = merge([ant(-1), ant(1), new THREE.SphereGeometry(0.035, 8, 6).translate(-0.2, 0.4, 0.1), new THREE.SphereGeometry(0.035, 8, 6).translate(0.2, 0.4, 0.1)]);
    const mand = (sx) => tube([[sx * 0.05, 0, 0], [sx * 0.08, -0.03, 0.06], [sx * 0.03, -0.05, 0.11]], 0.022, 8, 5, (t) => 1 - t * 0.8);
    const mandibles = merge([mand(-1), mand(1)]);
    const lid = new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI * 0.42);
    // estela del caparazón giratorio (aditiva, color por vértice desvanecido por ángulo)
    const trail = new THREE.RingGeometry(0.3, 0.62, 40, 1, 0, Math.PI * 1.5); trail.rotateX(-Math.PI / 2);
    vcolor(trail, (x, y, z, c) => { let a = Math.atan2(-z, x); if (a < 0) a += TAU; const k = Math.pow(1 - a / (Math.PI * 1.5), 1.6); const r = Math.hypot(x, z); const e = Math.sin(Math.PI * (r - 0.3) / 0.32); c.setRGB(0.4 * k * e, 1.0 * k * e, 0.8 * k * e); });
    [shell, belly, rimG, head, legR, legL, antennae, mandibles, lid, trail].forEach((g) => (g.userData.shared = true));
    return {
      shell, belly, rimG, head, legR, legL, antennae, mandibles, lid, trail,
      shellMat: mat('beetleShell', {
        physical: true, map: shellTex, bumpMap: bump, bumpScale: 1.5, metalness: 0.3, roughness: 0.3,
        clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.45, iridescenceIOR: 1.5, iridescenceThicknessRange: [300, 600],
        env: 0.7, rim: [0x9ffff0, 0.18, 2.6],
      }),
      bellyMat: mat('beetleBelly', { color: 0x15203a, roughness: 0.5 }),
      rimMat: mat('beetleRim', { color: 0xe8b23a, metalness: 0.9, roughness: 0.3, env: 1 }),
      headMat: mat('beetleHead', { physical: true, color: 0x1e2550, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, env: 0.6, rim: [0x9fc8ff, 0.4, 2.5] }),
      legMat: mat('beetleLeg', { color: 0x1c2a4a, roughness: 0.4, metalness: 0.2, env: 0.5 }),
      goldMat: mat('beetleGold', { color: 0xffc04a, metalness: 0.8, roughness: 0.3, env: 1, emissive: 0x3a2000 }),
      trailMat: cached('mat:beetleTrail', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
    };
  });
}

/** Escarabajo: camina; al pisarlo se esconde en su caparazón. s = { vx, time, shell(bool), shellSpin(bool), waking(0..1), dead } */
export function createBeetleModel() {
  const R = beetleRes();
  const root = new THREE.Group();
  const yawG = group(), flip = group(), off = group(), bodyG = group(), shellG = group();
  root.add(yawG); yawG.add(flip); flip.add(off); off.add(bodyG);
  flip.position.y = 0.36; off.position.y = -0.36;
  bodyG.add(shellG);
  shellG.add(mesh(R.shell, R.shellMat), mesh(R.belly, R.bellyMat, false), mesh(R.rimG, R.rimMat, false));
  // cabeza
  const headG = group(); bodyG.add(headG);
  headG.add(mesh(R.head, R.headMat));
  const eyes = [-1, 1].map((sx) => { const e = makeEye(0.095, 'green', 1, 1.1, 0.85); e.position.set(sx * 0.085, 0.11, 0.12); e.rotation.y = sx * 0.3; headG.add(e); return e; });
  const lids = [-1, 1].map((sx) => { const l = mesh(R.lid, R.headMat, false); l.scale.setScalar(0.108); l.position.set(sx * 0.085, 0.11, 0.12); l.rotation.set(0.35, sx * 0.3, sx * -0.55); headG.add(l); return l; });
  const ant = mesh(R.antennae, R.legMat, false); ant.position.set(0, 0.14, 0.04); headG.add(ant);
  const mand = mesh(R.mandibles, R.goldMat, false); mand.position.set(0, -0.06, 0.13); headG.add(mand);
  // patas (trípode)
  const legs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const lg = group(mesh(sx > 0 ? R.legR : R.legL, R.legMat));
    lg.position.set(sx * 0.27, 0.0, 0.2 - i * 0.2); lg.rotation.y = sx * (i - 1) * -0.35;
    lg.userData = { sx, i, base: lg.rotation.y, ph: ((i % 2) ^ (sx > 0 ? 1 : 0)) * Math.PI };
    off.add(lg); legs.push(lg);
  }
  const trail = mesh(R.trail, R.trailMat, false); trail.visible = false; trail.position.y = 0.2; root.add(trail);
  const st = { dir: -1, shellK: 0, deadT: 0, spin: 0, blinkOff: Math.random() * 4 };
  return {
    root,
    update(dt, s) {
      const t = s.time;
      const inShell = s.shell || s.shellSpin;
      st.shellK = damp(st.shellK, inShell ? 1 : 0, 16, dt);
      const k = st.shellK;
      if (s.shellSpin) {
        st.spin += dt * 26 * (s.vx >= 0 ? -1 : 1);
        yawG.rotation.y = st.spin;
        trail.visible = true; trail.rotation.y = st.spin + (s.vx >= 0 ? Math.PI : 0); trail.scale.set(s.vx >= 0 ? 1 : -1, 1, 1);
      } else {
        trail.visible = false;
        yawG.rotation.y = faceDir(st, s.vx, dt, 1.05);
        if (inShell) yawG.rotation.y = st.yaw;
      }
      if (s.dead) {
        st.deadT += dt; flip.rotation.z = Math.min(Math.PI, st.deadT * 12);
        legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 30 + i) * 0.5));
        eyes.forEach((e) => setEyeX(e, true));
        trail.visible = false;
        return;
      }
      flip.rotation.z = 0;
      // cuerpo: al esconderse, baja al suelo y la cabeza/patas se retraen
      const wake = s.waking || 0;
      const shake = wake > 0 ? Math.sin(t * 70) * 0.03 * (0.3 + wake) : 0;
      bodyG.position.set(shake, 0.24 - 0.22 * k, 0);
      shellG.position.y = 0;
      const ss = 1 + 0.08 * k; shellG.scale.set(ss, ss, ss);
      const headOut = 1 - k + k * wake * 0.75;
      headG.position.set(0, 0.03 + 0.05 * (1 - k), 0.3 + 0.12 * headOut);
      headG.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * headOut));
      headG.visible = headOut > 0.05;
      const ph = t * 12;
      const legOut = Math.max(1 - k, k * wake * 0.7);
      legs.forEach((l) => {
        const { base, ph: o } = l.userData;
        const p = ph + o;
        l.visible = legOut > 0.03;
        l.scale.setScalar(Math.max(0.001, legOut));
        l.position.y = 0.22 - 0.2 * k;
        const walking = inShell ? 0 : 1;
        l.rotation.y = base + Math.sin(p) * 0.45 * walking + (inShell ? Math.sin(t * 40 + o) * 0.3 * wake : 0);
        l.rotation.z = Math.max(0, Math.cos(p)) * 0.25 * walking * l.userData.sx;
      });
      if (!inShell) {
        bodyG.position.y += Math.abs(Math.sin(ph)) * 0.02;
        bodyG.rotation.z = Math.sin(ph) * 0.04;
        ant.rotation.x = Math.sin(t * 4) * 0.12 - 0.1; ant.rotation.z = Math.sin(t * 3.3) * 0.08;
      } else bodyG.rotation.z = shake * 2;
      if (s.shellSpin) { shellG.rotation.x = 0.06; } else shellG.rotation.x = 0;
      const bl = blink(t, st.blinkOff);
      eyes.forEach((e) => (e.scale.y = 0.095 * 1.1 * bl));
      lids.forEach((l) => (l.position.y = 0.11 + (wake > 0 ? 0.02 : 0)));
    },
  };
}

// =====================================================================================
// AVISPÓN
// =====================================================================================
function waspRes() {
  return cached('res:wasp', () => {
    const bodyTex = tex('waspBody', 128, 256, (g, w, h) => {
      // arriba del canvas = frente (cabeza); abajo = cola
      const bands = [[0, '#ffcf2a'], [0.24, '#ffcf2a'], [0.3, '#2a170c'], [0.44, '#2a170c'], [0.5, '#ffc21a'], [0.62, '#ffb810'], [0.68, '#24140a'], [0.82, '#24140a'], [0.87, '#f2a812'], [0.93, '#1c0f08'], [1, '#1c0f08']];
      for (let i = 0; i < bands.length - 1; i++) {
        const [a, ca] = bands[i], [b] = bands[i + 1];
        g.fillStyle = ca; g.fillRect(0, a * h, w, (b - a) * h + 1);
      }
      // pelusa
      for (let i = 0; i < 2600; i++) {
        const x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(${rnd() < 0.5 ? '255,240,180' : '40,20,5'},${0.12 + rnd() * 0.12})`;
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 5); g.stroke();
      }
    });
    const wingTex = tex('waspWing', 128, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(220,245,255,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(60,50,40,0.85)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, h * 0.5); g.quadraticCurveTo(w * 0.5, h * 0.3, w, h * 0.42); g.stroke();
      g.lineWidth = 1.2;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(w * i / 6.5, h * 0.4); g.quadraticCurveTo(w * i / 6 + 8, h * 0.7, w * i / 6 + 14, h); g.stroke(); g.beginPath(); g.moveTo(w * i / 6.5, h * 0.42); g.lineTo(w * i / 6 + 10, 0); g.stroke(); }
    }, { repeat: false });
    const compound = tex('waspEye', 128, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w * 0.25, h * 0.45, 2, w * 0.25, h * 0.5, w * 0.35);
      gr.addColorStop(0, '#ff6a3a'); gr.addColorStop(0.5, '#a0141c'); gr.addColorStop(1, '#300408');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      const s = 4;
      for (let y = 0; y < h + s; y += s * 0.87) for (let x = 0; x < w + s; x += s * 1.5) {
        const xx = x + ((y / (s * 0.87)) % 2 ? s * 0.75 : 0);
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(xx + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5); } g.closePath(); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(w * 0.2, h * 0.32, 6, 4, -0.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(w * 0.3, h * 0.62, 2.4, 0, TAU); g.fill();
    }, { repeat: false });
    const body = new THREE.SphereGeometry(1, segs(24, 18, 12), segs(18, 14, 10)); body.rotateX(Math.PI / 2); body.scale(0.27, 0.255, 0.33);
    const head = new THREE.SphereGeometry(0.17, 16, 12);
    const eye = new THREE.SphereGeometry(1, 16, 12);
    const sting = new THREE.ConeGeometry(0.055, 0.2, 10); sting.rotateX(-Math.PI / 2);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0); wingShape.bezierCurveTo(0.1, 0.12, 0.34, 0.14, 0.44, 0.06); wingShape.bezierCurveTo(0.48, 0.01, 0.42, -0.06, 0.3, -0.07); wingShape.bezierCurveTo(0.18, -0.08, 0.06, -0.05, 0, 0);
    const wing = new THREE.ShapeGeometry(wingShape, 8);
    { const uv = wing.attributes.uv, p = wing.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 0.48, (p.getY(i) + 0.08) / 0.23); }
    wing.rotateX(-Math.PI / 2);
    const legs = merge([0.1, -0.02, -0.14].flatMap((z) => [-1, 1].map((sx) => capsuleBetween([sx * 0.1, 0.0, z], [sx * 0.16, -0.16, z - 0.05], 0.022, 3, 5))));
    const ant = (sx) => tube([[sx * 0.04, 0, 0], [sx * 0.08, 0.12, 0.06], [sx * 0.15, 0.2, 0.14]], 0.012, 10, 5);
    const antennae = merge([ant(-1), ant(1), new THREE.SphereGeometry(0.026, 8, 6).translate(-0.15, 0.2, 0.14), new THREE.SphereGeometry(0.026, 8, 6).translate(0.15, 0.2, 0.14)]);
    const brow = capsuleBetween([-0.06, 0, 0], [0.06, 0, 0], 0.022, 3, 6);
    [body, head, eye, sting, wing, legs, antennae, brow].forEach((g) => (g.userData.shared = true));
    return {
      body, head, eye, sting, wing, legs, antennae, brow,
      bodyMat: mat('waspBody', { physical: true, map: bodyTex, roughness: 0.65, sheen: 1, sheenColor: new THREE.Color(0xfff0a0), sheenRoughness: 0.4, rim: [0xfff0b0, 0.45, 2.5] }),
      darkMat: mat('waspDark', { physical: true, color: 0x24140a, roughness: 0.45, clearcoat: 0.6, rim: [0xffd890, 0.3, 2.5] }),
      eyeMat: mat('waspEye', { map: compound, roughness: 0.1, emissive: 0xff3010, emissiveIntensity: 0.25 }),
      wingMat: cached('mat:waspWing', () => new THREE.MeshPhysicalMaterial({ map: wingTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.5, emissive: 0xc8f0ff, emissiveIntensity: 0.15, emissiveMap: wingTex })),
      browMat: mat('waspBrow', { color: 0xffc21a, roughness: 0.6 }),
    };
  });
}

/** Avispón: vuela. s = { vx, time, dead } */
export function createWaspModel() {
  const R = waspRes();
  const root = new THREE.Group();
  const yawG = group(), flip = group(), bodyG = group();
  root.add(yawG); yawG.add(flip); flip.add(bodyG);
  flip.position.y = 0.4;
  bodyG.add(mesh(R.body, R.bodyMat));
  const sting = mesh(R.sting, R.darkMat, false); sting.position.set(0, -0.04, -0.4); bodyG.add(sting);
  const headG = group(mesh(R.head, R.darkMat)); headG.position.set(0, 0.06, 0.33); bodyG.add(headG);
  const eyes = [-1, 1].map((sx) => { const e = mesh(R.eye, R.eyeMat, false); e.scale.set(0.085, 0.12, 0.09); e.position.set(sx * 0.1, 0.04, 0.07); e.rotation.y = sx * 0.5; headG.add(e); return e; });
  const brows = [-1, 1].map((sx) => { const b = mesh(R.brow, R.browMat, false); b.position.set(sx * 0.085, 0.165, 0.13); b.rotation.set(0, sx * 0.4, sx * 0.5); headG.add(b); return b; });
  const ant = mesh(R.antennae, R.darkMat, false); ant.position.set(0, 0.12, 0.05); headG.add(ant);
  const legs = mesh(R.legs, R.darkMat, false); legs.position.y = -0.18; bodyG.add(legs);
  const wings = [];
  for (const sx of [-1, 1]) for (const ghost of [0, 1]) {
    if (ghost && isLow()) continue;
    const w = mesh(R.wing, R.wingMat, false); w.scale.set(sx, 1, 1);
    const wg = group(w); wg.position.set(sx * 0.07, 0.22, 0.02); wg.rotation.y = sx * 0.35;
    wg.userData = { sx, ghost }; w.material = R.wingMat; bodyG.add(wg); wings.push(wg);
    if (ghost) w.scale.multiplyScalar(0.97);
  }
  const st = { dir: -1, deadT: 0 };
  return {
    root,
    update(dt, s) {
      const t = s.time;
      yawG.rotation.y = faceDir(st, s.vx, dt, 1.1);
      if (s.dead) {
        st.deadT += dt; flip.rotation.z = Math.min(Math.PI, st.deadT * 12);
        wings.forEach((w) => (w.rotation.z = w.userData.sx * 0.2));
        return;
      }
      bodyG.rotation.x = 0.18 + Math.sin(t * 2.2) * 0.1;
      bodyG.position.y = Math.sin(t * 9) * 0.02;
      bodyG.rotation.z = Math.sin(t * 3) * 0.06;
      wings.forEach((w) => {
        const { sx, ghost } = w.userData;
        const a = Math.sin(t * 52 + (ghost ? 1.9 : 0));
        w.rotation.z = sx * (0.25 + a * 0.7);
        w.rotation.x = Math.cos(t * 52) * 0.15;
      });
      legs.rotation.x = Math.sin(t * 4) * 0.15 + 0.1;
      ant.rotation.x = Math.sin(t * 6) * 0.1;
      brows.forEach((b) => (b.position.y = 0.165 + Math.sin(t * 4) * 0.008));
    },
  };
}

// =====================================================================================
// PLANTA ÍGNEA (flor-dragón)
// =====================================================================================
function plantRes() {
  return cached('res:plant', () => {
    const stemTex = tex('plantStem', 64, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#1d6a24'); gr.addColorStop(0.5, '#52c23a'); gr.addColorStop(1, '#1d6a24');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(10,50,10,0.35)'; g.fillRect(0, i * h / 8, w, 2); }
      noiseFill(g, w, h, 12, 2);
    });
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.1, 0.12, 0.35, 0.14, 0.52, 0.02); leafShape.bezierCurveTo(0.36, -0.1, 0.12, -0.1, 0, 0);
    const leaf = new THREE.ShapeGeometry(leafShape, 10);
    { const p = leaf.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -x * x * 0.9 + Math.abs(y) * 0.6); p.setY(i, y); } leaf.computeVertexNormals(); }
    vcolor(leaf, (x, y, z, c) => { const k = Math.min(1, x / 0.52); const v = Math.abs(y) < 0.012 ? 1.25 : 1; c.setRGB((0.12 + 0.35 * k) * v, (0.45 + 0.35 * k) * v, (0.12 + 0.05 * k) * v); });
    const leafG = merge([leaf.clone().rotateX(-Math.PI / 2 + 0.3), leaf.clone().rotateX(-Math.PI / 2 + 0.3).rotateY(Math.PI)], true);
    const stem = tube([[0, -0.05, 0], [0.05, 0.25, 0], [-0.05, 0.55, 0.02], [0, 0.85, 0.02]], 0.075, 16, 10, (t) => 1 - t * 0.25);
    scaleUV(stem, 1, 2);
    const n = segs(24, 18, 12);
    const jawCol = (front) => (x, y, z, c) => {
      const f = THREE.MathUtils.clamp((z + 0.1) / 0.45, 0, 1), up = THREE.MathUtils.clamp(y / 0.26, 0, 1);
      // carmesí/magenta arriba-atrás → naranja-amarillo en el labio delantero
      const r = 0.45 + 0.5 * f, gg = 0.015 + 0.36 * f * (1 - up * 0.75), b = 0.16 * (1 - f) + 0.03;
      c.setRGB(r, gg * front, b);
    };
    const upper = new THREE.SphereGeometry(1, n, segs(12, 9, 6), 0, TAU, 0, Math.PI / 2); upper.scale(0.29, 0.25, 0.36); upper.translate(0, 0, 0.13);
    vcolor(upper, jawCol(1));
    const lower = new THREE.SphereGeometry(1, n, segs(10, 8, 6), 0, TAU, Math.PI / 2, Math.PI / 2); lower.scale(0.25, 0.14, 0.32); lower.translate(0, 0, 0.13);
    vcolor(lower, jawCol(1.1));
    const discU = new THREE.CircleGeometry(1, n); discU.rotateX(Math.PI / 2); discU.scale(0.27, 1, 0.34); discU.translate(0, -0.002, 0.13);
    const discL = new THREE.CircleGeometry(1, n); discL.rotateX(-Math.PI / 2); discL.scale(0.23, 1, 0.3); discL.translate(0, 0.002, 0.13);
    const mouthTex = tex('plantMouth', 128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w * 0.3, 2, w / 2, w / 2, w / 2);
      gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.3, '#ffb020'); gr.addColorStop(0.65, '#e0300c'); gr.addColorStop(1, '#5a0410');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }, { repeat: false });
    const teethFor = (sign, rx, rz, cnt) => merge(Array.from({ length: cnt }, (_, i) => {
      const a = -Math.PI * 0.42 + (i / (cnt - 1)) * Math.PI * 0.84;
      const tg = new THREE.ConeGeometry(0.026, 0.07, 6); if (sign < 0) tg.rotateX(Math.PI);
      tg.translate(Math.sin(a) * rx * 0.92, sign * 0.03, 0.13 + Math.cos(a) * rz * 0.92);
      return tg;
    }));
    const teethU = teethFor(-1, 0.27, 0.34, 6), teethL = teethFor(1, 0.23, 0.3, 5);
    // corola/gorguera de pétalos detrás de la cabeza
    const petal = new THREE.Shape();
    petal.moveTo(0, 0); petal.bezierCurveTo(0.12, 0.08, 0.14, 0.3, 0, 0.42); petal.bezierCurveTo(-0.14, 0.3, -0.12, 0.08, 0, 0);
    const pg = new THREE.ShapeGeometry(petal, 8);
    { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, y * y * 0.6 - x * x * 1.5); } }
    vcolor(pg, (x, y, z, c) => { const k = y / 0.42; c.setRGB(1 - 0.3 * k, 0.75 - 0.72 * k, 0.04 + 0.06 * k); });
    const petals = [];
    const NP = 9;
    for (let i = 0; i < NP; i++) {
      const a = -Math.PI * 0.85 + (i / (NP - 1)) * Math.PI * 1.7;
      const g = pg.clone(); g.scale(1, 0.9 + (i % 2) * 0.25, 1); g.translate(0, 0.12, 0); g.rotateZ(a); g.rotateX(-0.35);
      petals.push(g);
    }
    const frill = merge(petals, true);
    const horn = (sx) => tube([[sx * 0.08, 0.18, 0.12], [sx * 0.12, 0.3, 0.06], [sx * 0.2, 0.36, -0.06], [sx * 0.27, 0.33, -0.12]], 0.035, 10, 6, (t) => 1 - t * 0.9);
    const horns = merge([horn(-1), horn(1)]);
    const brow = capsuleBetween([-0.07, 0, 0], [0.07, 0, 0], 0.03, 3, 6);
    const pod = new THREE.SphereGeometry(1, 14, 10); pod.scale(0.12, 0.09, 0.12);
    [leafG, stem, upper, lower, discU, discL, teethU, teethL, frill, horns, brow, pod].forEach((g) => (g.userData.shared = true));
    return {
      leafG, stem, upper, lower, discU, discL, teethU, teethL, frill, horns, brow, pod,
      stemMat: mat('plantStem', { map: stemTex, roughness: 0.55, rim: [0xd8ffb0, 0.3, 2.5] }),
      leafMat: mat('plantLeaf', { vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, rim: [0xe0ffb0, 0.25, 2.5] }),
      jawMat: mat('plantJaw', { physical: true, vertexColors: true, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2, rim: [0xff9060, 0.15, 2.5] }),
      mouthMat: mat('plantMouth', { map: mouthTex, emissive: 0xffffff, emissiveMap: mouthTex, emissiveIntensity: 1.6, roughness: 0.6 }),
      toothMat: mat('tooth', { color: 0xfff6e8, roughness: 0.3 }),
      frillMat: mat('plantFrill', { vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, emissive: 0xff4010, emissiveIntensity: 0.08, rim: [0xffd080, 0.12, 2] }),
      hornMat: mat('plantHorn', { color: 0xffb02a, roughness: 0.35, metalness: 0.2, emissive: 0x401000 }),
      browMat: mat('plantBrow', { color: 0x5a0a1a, roughness: 0.5 }),
    };
  });
}

/** Planta ígnea dentro de una columna. s = { time, out(0..1), dead, aim(-1|1) } */
export function createFirePlantModel() {
  const R = plantRes();
  const root = new THREE.Group();
  const swayG = group(); root.add(swayG);
  const leaves = mesh(R.leafG, R.leafMat); leaves.position.y = 0.1; root.add(leaves);
  const leaves2 = mesh(R.leafG, R.leafMat); leaves2.position.y = 0.22; leaves2.rotation.y = Math.PI / 2; leaves2.scale.setScalar(0.75); root.add(leaves2);
  swayG.add(mesh(R.stem, R.stemMat));
  const headG = group(); headG.position.set(0, 0.95, 0); swayG.add(headG);
  const frill = mesh(R.frill, R.frillMat); frill.position.set(0, 0.0, -0.08); headG.add(frill);
  const upperG = group(), lowerG = group(); upperG.position.set(0, 0.0, -0.1); lowerG.position.set(0, -0.0, -0.1); headG.add(upperG, lowerG);
  upperG.add(mesh(R.upper, R.jawMat), mesh(R.discU, R.mouthMat, false), mesh(R.teethU, R.toothMat, false));
  lowerG.add(mesh(R.lower, R.jawMat), mesh(R.discL, R.mouthMat, false), mesh(R.teethL, R.toothMat, false));
  const horns = mesh(R.horns, R.hornMat, false); upperG.add(horns);
  const eyes = [-1, 1].map((sx) => { const e = makeEye(0.085, 'red', 1, 1.1, 0.9); e.position.set(sx * 0.12, 0.2, 0.2); e.rotation.y = sx * 0.35; upperG.add(e); return e; });
  const brows = [-1, 1].map((sx) => { const b = mesh(R.brow, R.browMat, false); b.position.set(sx * 0.12, 0.29, 0.25); b.rotation.set(-0.3, sx * 0.35, sx * 0.5); upperG.add(b); return b; });
  const glow = glowSprite('plantGlow', 0xff7a20, 0.5, 0.9); glow.position.set(0, 0, 0.25); headG.add(glow);
  const st = { yaw: 0, openT: 0, open: 0.1 };
  return {
    root,
    update(dt, s) {
      const t = s.time, out = s.out ?? 1, aim = s.aim || -1;
      root.visible = !s.dead;
      st.openT = out >= 0.999 ? st.openT + dt : 0;
      // ciclo: anticipación → disparo (≈1 s tras salir del todo) → cierre
      const o = st.openT;
      let target = 0.12 + Math.sin(t * 3) * 0.05;
      if (o > 0.45 && o < 1.0) target = 0.12 + (o - 0.45) / 0.55 * 0.5;
      else if (o >= 1.0 && o < 1.35) target = 0.85;
      st.open = damp(st.open, target, o >= 1.0 && o < 1.1 ? 40 : 10, dt);
      const recoil = o >= 1.0 && o < 1.5 ? Math.sin((o - 1.0) / 0.5 * Math.PI) : 0;
      upperG.rotation.x = -st.open * 0.75;
      lowerG.rotation.x = st.open * 0.45;
      st.yaw = damp(st.yaw, aim * 1.15, 6, dt);
      headG.rotation.y = st.yaw;
      headG.rotation.x = -0.05 - recoil * 0.25;
      headG.position.z = -recoil * 0.06;
      headG.position.y = 0.95 + Math.sin(t * 2.4) * 0.02;
      swayG.rotation.z = Math.sin(t * 1.7) * 0.05 - aim * 0.06;
      swayG.rotation.x = Math.sin(t * 1.3) * 0.03;
      frill.rotation.z = Math.sin(t * 2.1) * 0.06;
      frill.scale.setScalar(1 + st.open * 0.12);
      glow.scale.setScalar(0.25 + st.open * 0.9);
      glow.material.opacity = 0.9;
      const lf = 0.35 + 0.65 * out;
      leaves.scale.set(lf, 1, lf); leaves.rotation.y = Math.sin(t * 1.2) * 0.08;
      const bl = blink(t, 1.3);
      eyes.forEach((e) => (e.scale.y = 0.085 * 1.1 * bl));
      brows.forEach((b) => (b.position.y = 0.29 - st.open * 0.03));
    },
  };
}

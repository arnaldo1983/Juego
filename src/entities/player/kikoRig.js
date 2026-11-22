// KIKO — rig jerárquico + animación procedural.
import * as THREE from 'three';
import { getKikoAssets, U, OUTFIT } from './kikoAssets.js';

const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI;
const YAW = 0.44; // giro hacia la cámara (~25°)

// Dimensiones base (forma pequeña); la forma grande escala segmentos.
const THIGH = 0.11, SHIN = 0.09, BOOT_H = 0.07, TORSO_H = 0.27;

function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
}
function skinned(geo, mat) {
  const n = geo.userData.boneN, seg = geo.userData.boneSeg, dir = geo.userData.boneDir;
  const bones = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Bone();
    if (i) { b.position.y = seg * dir; bones[i - 1].add(b); }
    bones.push(b);
  }
  const m = new THREE.SkinnedMesh(geo, mat);
  m.add(bones[0]);
  m.updateMatrixWorld(true);
  m.bind(new THREE.Skeleton(bones));
  m.castShadow = true; m.frustumCulled = false;
  return { mesh: m, bones };
}
class Spring1 {
  constructor(x = 0) { this.x = x; this.v = 0; }
  step(target, k, c, dt) { this.v += (k * (target - this.x) - c * this.v) * dt; this.x += this.v * dt; return this.x; }
}

export function createKiko() {
  const { G, M } = getKikoAssets();
  const root = new THREE.Group(); root.name = 'kiko';
  const off = new THREE.Group(); root.add(off);
  const yaw = new THREE.Group(); off.add(yaw);
  const body = new THREE.Group(); yaw.add(body);

  // ---- caderas
  const hips = new THREE.Group(); body.add(hips);
  const shorts = mesh(G.shorts, M.cloth); hips.add(shorts);
  // ---- piernas
  const legs = [1, -1].map((side) => {
    const hip = new THREE.Group(); hip.position.set(0, 0.0, 0.078 * side); hips.add(hip);
    const thigh = mesh(G.thigh, M.fur); hip.add(thigh);
    const cuff = mesh(G.cuff, M.cloth); hip.add(cuff);
    const knee = new THREE.Group(); hip.add(knee);
    const shin = mesh(G.shin, M.fur); knee.add(shin);
    const ankle = new THREE.Group(); knee.add(ankle);
    const boot = mesh(G.boot, M.leather); ankle.add(boot);
    return { side, hip, thigh, knee, shin, ankle, cuff };
  });
  // ---- cola
  const tailRoot = new THREE.Group(); tailRoot.position.set(-0.12, 0.05, 0); hips.add(tailRoot);
  const tail = skinned(G.tail, M.tail); tailRoot.add(tail.mesh);
  // ---- torso
  const torso = new THREE.Group(); hips.add(torso);
  const torsoMesh = mesh(G.torso, M.fur); torso.add(torsoMesh);
  const gear = mesh(G.gear, M.leather); torso.add(gear);
  // ---- brazos
  const arms = [1, -1].map((side) => {
    const sh = new THREE.Group(); sh.position.set(0.0, 0.205, 0.148 * side); torso.add(sh);
    const up = mesh(G.upperArm, M.fur); sh.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -0.058; sh.add(elbow);
    const fore = mesh(G.foreArm, M.fur); elbow.add(fore);
    return { side, sh, up, elbow, fore };
  });
  // ---- cuello, bufanda, cabeza
  const neck = new THREE.Group(); neck.position.y = TORSO_H - 0.01; torso.add(neck);
  const scarf = mesh(G.scarf, M.scarf); scarf.position.y = 0.0; scarf.rotation.z = 0.12; neck.add(scarf);
  const scarfRoot = new THREE.Group(); scarfRoot.position.set(-0.13, 0.0, 0); neck.add(scarfRoot);
  const sTail = skinned(G.scarfTail, M.scarf); scarfRoot.add(sTail.mesh);
  const head = new THREE.Group(); head.position.y = 0.045; neck.add(head);
  const headMesh = mesh(G.head, M.fur); head.add(headMesh);
  const nose = mesh(G.nose, M.gloss, false); head.add(nose);
  const mouth = mesh(G.mouth, M.mouth, false); head.add(mouth);
  const mouthO = mesh(G.mouthO, M.mouthO, false); mouthO.visible = false; head.add(mouthO);
  const eyes = [1, -1].map((side) => {
    const sock = new THREE.Group();
    sock.position.set(0.182, 0.212, 0.1 * side);
    sock.rotation.set(0.06 * side, -0.42 * side, 0.0);
    head.add(sock);
    const ball = mesh(G.eye, M.eye, false); ball.scale.set(0.6, 1.3, 1.05); sock.add(ball);
    const hl = mesh(G.hl, M.hl, false); hl.position.x = 0.004; hl.scale.set(1, 1.3, 1.05); sock.add(hl);
    const brow = mesh(G.brow, M.brow, false); brow.position.set(0.0, 0.118, 0); sock.add(brow);
    return { side, sock, ball, hl, brow };
  });
  const ears = [1, -1].map((side) => {
    const e = new THREE.Group(); e.position.set(-0.025, 0.345, 0.125 * side); head.add(e);
    const m = mesh(G.ear, M.fur); e.add(m);
    return { side, e };
  });

  // ---------------------------------------------------------------- estado de animación
  const st = {
    t: 0, phase: 0, yaw: -YAW, b: 0, fromB: 0, lastGrow: -1, lastPower: 0,
    lastOnGround: true, lastVy: 0, lastVx: 0, sq: new Spring1(0), stretch: 0,
    blink: 0, nextBlink: 1.5, lookT: 2, look: { y: 0, p: 0 }, lookTarget: { y: 0, p: 0 },
    throwT: 1, lastThrow: false, dyingT: 0, victoryT: 0, airT: 0, idleT: 0,
    ear: [new Spring1(0), new Spring1(0)], earTw: 0,
    tailZ: [0, 1, 2, 3].map(() => new Spring1(0)), tailX: [0, 1, 2, 3].map(() => new Spring1(0)), tailBase: new Spring1(0.95),
    scZ: [0, 1, 2, 3].map(() => new Spring1(0)), scX: [0, 1, 2, 3].map(() => new Spring1(0)), scBase: new Spring1(-0.4),
    P: null, glow: 0, star: 0,
  };
  // canales de pose suavizados
  const P = {
    lean: 0, hipDrop: 0, twist: 0, bodyX: 0, roll: 0,
    hp: 0, hy: 0, hr: 0,
    aZ: [0, 0], aX: [0, 0], el: [0, 0],
    lZ: [0, 0], kn: [0, 0], ft: [0, 0], lX: [0, 0],
    earBack: 0, eyeOpen: 1, eyeWide: 1, browUp: 0, mouthO: 0, plant: 1,
  };
  st.P = P;

  function setPose(T, rate, dt) {
    for (const k in T) {
      const v = T[k];
      if (Array.isArray(v)) { P[k][0] = damp(P[k][0], v[0], rate, dt); P[k][1] = damp(P[k][1], v[1], rate, dt); }
      else P[k] = damp(P[k], v, rate, dt);
    }
  }

  function update(dtIn, s) {
    const dt = Math.min(Math.max(dtIn, 0), 1 / 20);
    st.t += dt; const t = st.t;
    U.uTime.value = t;
    const facing = s.facing >= 0 ? 1 : -1;
    const speed = s.speed || 0;
    const runMax = s.runMax || 10;
    const fwd = s.vx * facing;

    // ---------------- tamaño / transformación
    const targetB = s.power > 0 ? 1 : 0;
    if (s.growT >= 0) {
      if (st.lastGrow < 0 || s.growT < st.lastGrow) st.fromB = st.b;
      const g = s.growT;
      const pulse = 0.5 - 0.5 * Math.cos(g * PI * 7); // 3.5 pulsos
      const env = Math.min(1, g * 1.25);
      st.b = st.fromB === targetB ? targetB : lerp(st.fromB, targetB, clamp(env * (0.55 + 0.45 * pulse) + ss(0.8, 1, g) * 0.45, 0, 1));
      const fl = (1 - g) * (0.5 + 0.5 * Math.sin(g * 50));
      const col = s.power === 2 ? [1.0, 0.55, 0.15] : [0.9, 0.95, 1.0];
      U.uFlash.value.setRGB(col[0] * fl * 0.9, col[1] * fl * 0.9, col[2] * fl * 0.9);
    } else {
      st.b = targetB; U.uFlash.value.setRGB(0, 0, 0);
    }
    st.lastGrow = s.growT;
    const b = st.b;
    const S = 1 + 0.62 * b, legF = 1 + 0.55 * b, torsoF = 1 + 0.2 * b, headF = 1 - 0.16 * b, armF = 1 + 0.32 * b;

    // ---------------- colores según poder
    const fire = s.power === 2;
    const O = fire ? OUTFIT.fire : OUTFIT.normal;
    M_set(O);
    st.glow = damp(st.glow, fire ? 1 : 0, 6, dt); U.uTipGlow.value = st.glow;
    st.star = damp(st.star, s.star ? 0.9 : 0, 8, dt); U.uStar.value = st.star;

    // ---------------- eventos
    if (s.onGround && !st.lastOnGround && !s.climbing) {
      const imp = clamp(-st.lastVy / 22, 0, 1);
      st.sq.x = -(0.06 + 0.2 * imp); st.sq.v = 0;
    }
    if (s.throwing && !st.lastThrow) st.throwT = 0;
    st.lastThrow = s.throwing; st.throwT += dt;
    st.airT = s.onGround ? 0 : st.airT + dt;
    if (s.dying) st.dyingT += dt; else st.dyingT = 0;
    if (s.victory) st.victoryT += dt; else st.victoryT = 0;
    const accX = clamp((s.vx - st.lastVx) / dt, -120, 120) * facing;
    const accY = clamp((s.vy - st.lastVy) / dt, -150, 150);

    // ---------------- parpadeo y mirada
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) { st.blink = 0.16; st.nextBlink = 1.8 + Math.random() * 3 + (Math.random() < 0.2 ? -1.5 : 0); }
    let blinkK = 1;
    if (st.blink > 0) { st.blink -= dt; blinkK = Math.abs(st.blink / 0.16 * 2 - 1); }
    st.lookT -= dt;
    const still = speed < 0.4 && s.onGround && !s.dying && !s.climbing;
    st.idleT = still ? st.idleT + dt : 0;
    if (st.lookT <= 0) {
      st.lookT = 1.4 + Math.random() * 2.6;
      const r = Math.random();
      st.lookTarget = r < 0.4 ? { y: -0.55, p: -0.05 } : r < 0.65 ? { y: 0.35, p: 0.12 } : r < 0.8 ? { y: -0.2, p: -0.22 } : { y: 0, p: 0 };
    }

    // ---------------- pose objetivo
    const T = {};
    const walkK = clamp(speed / 6.4, 0, 1), runK = clamp((speed - 6.4) / (runMax - 6.4), 0, 1);
    let rate = 14;
    let yawT = facing > 0 ? -YAW : -PI + YAW;
    let plant = s.onGround ? 1 : 0;
    // ciclo de pasos
    const rateC = Math.min(22, speed * (2.1 - 0.35 * runK) / S + 0.0);
    if (s.onGround && !s.skid) st.phase += rateC * dt;
    const ph = st.phase, sn = Math.sin(ph), cs = Math.cos(ph);
    const A = (0.72 + 0.35 * runK) * Math.min(1, walkK * 1.6);

    Object.assign(T, {
      lean: 0.02, hipDrop: 0, twist: 0, bodyX: 0, roll: 0, hp: 0, hy: 0, hr: 0,
      aZ: [0.08, 0.08], aX: [0.22, 0.22], el: [0.25, 0.25], lZ: [0.04, -0.04], kn: [-0.06, -0.06], ft: [0, 0], lX: [0.04, 0.04],
      earBack: 0, eyeOpen: 1, eyeWide: 1, browUp: 0, mouthO: 0,
    });

    if (s.dying) {
      const d = st.dyingT;
      yawT = -PI / 2 + Math.sin(d * 9) * 0.06 * Math.max(0, 1 - d);
      rate = 18; plant = 0;
      Object.assign(T, {
        lean: -0.12, aZ: [0.35, 0.35], aX: [2.3, 2.3], el: [0.9, 0.9], lZ: [0.5, -0.1], kn: [-0.9, -0.3], lX: [0.35, 0.35],
        hp: -0.2, hr: Math.sin(d * 5) * 0.08, earBack: -0.35, eyeOpen: 1, eyeWide: 1.18, browUp: 1, mouthO: 1,
      });
    } else if (s.victory) {
      const v = st.victoryT;
      yawT = -PI / 2 + 0.15;
      const hop = Math.max(0, Math.sin(v * 7));
      Object.assign(T, {
        aZ: [0.25, 0.25], aX: [2.5, 2.5], el: [0.3, 0.3], hipDrop: -hop * 0.06, lean: -0.05, hp: -0.25,
        eyeOpen: 0.45, mouthO: 0.8, earBack: -0.2, lZ: [0.1, -0.1], kn: [-0.2 * hop, -0.2 * hop],
      });
      plant = 0.5;
    } else if (s.climbing) {
      plant = 0; rate = 16;
      yawT = facing > 0 ? -0.3 : -PI + 0.3;
      Object.assign(T, {
        bodyX: 0.1 * facing, lean: 0.05, aZ: [2.5, 2.25], aX: [0.12, 0.12], el: [0.6, 0.9], lZ: [1.0, 0.75], kn: [-1.5, -1.25], lX: [0.05, 0.05],
        hp: -0.15, hy: -0.35, earBack: 0.15, ft: [0.4, 0.4],
      });
    } else if (s.crouch && s.onGround) {
      Object.assign(T, {
        lean: 0.45, hp: -0.35, lZ: [1.35, 1.2], kn: [-2.25, -2.15], ft: [0, 0], lX: [0.2, 0.2], aZ: [0.9, 0.7], aX: [0.15, 0.15], el: [0.6, 0.6], earBack: 0.35,
      });
      rate = 18;
    } else if (!s.onGround) {
      plant = 0;
      if (s.vy > 1) {
        const up = clamp(s.vy / 17, 0, 1);
        Object.assign(T, {
          lean: 0.08, aZ: [1.2 + up * 1.4, -0.7], aX: [0.4, 0.5], el: [0.4, 0.8], lZ: [1.0, -0.35], kn: [-1.5, -0.7], ft: [0.3, 0.6],
          hp: -0.12, earBack: 0.45, lX: [0.06, 0.06],
        });
        if (facing < 0) { const a = T.aZ; T.aZ = [a[1], a[0]]; const e = T.el; T.el = [e[1], e[0]]; }
      } else {
        const fall = clamp(-s.vy / 16, 0, 1);
        Object.assign(T, {
          lean: 0.0, aZ: [0.9 + fall * 0.9, 0.9 + fall * 0.7], aX: [0.9, 0.9], el: [0.3, 0.3], lZ: [0.45, -0.1], kn: [-0.8, -0.35], ft: [0.2, 0.3],
          hp: 0.12 * fall, earBack: -0.3 * fall, lX: [0.12, 0.12], eyeWide: 1 + 0.06 * fall, browUp: 0.4 * fall,
        });
      }
      rate = 10;
    } else if (s.skid) {
      const sv = Math.sign(s.vx) || facing;
      yawT = sv > 0 ? -YAW - 0.15 : -PI + YAW + 0.15;
      // marco local respecto a la dirección del deslizamiento
      Object.assign(T, {
        lean: -0.42, hipDrop: 0.0, aZ: [-1.1, -0.6], aX: [0.9, 0.8], el: [0.6, 0.4], lZ: [0.95, -0.25], kn: [-0.1, -1.1], ft: [-0.35, 0.5],
        hp: -0.3, earBack: 0.9, browUp: 0.6, eyeWide: 1.08, mouthO: 0.5, lX: [0.15, 0.15],
      });
      rate = 16;
    } else if (speed > 0.4) {
      // caminar / correr
      const armA = A * (0.9 + 0.3 * runK);
      Object.assign(T, {
        lean: 0.06 + 0.3 * runK + 0.06 * walkK, hp: -0.08 - 0.2 * runK, earBack: 0.15 + 0.5 * runK,
        aX: [0.25 + 0.15 * runK, 0.25 + 0.15 * runK],
      });
      // las oscilaciones se suman tras el suavizado
      rate = 12;
    } else {
      // reposo
      Object.assign(T, { hy: st.lookTarget.y, hp: st.lookTarget.p });
    }
    // lanzamiento
    if (st.throwT < 0.4 && !s.dying) {
      const k = st.throwT;
      const near = facing > 0 ? 0 : 1;
      const z = k < 0.07 ? lerp(0.3, -1.3, k / 0.07) : k < 0.17 ? lerp(-1.3, 1.9, (k - 0.07) / 0.1) : lerp(1.9, 0.6, Math.min(1, (k - 0.17) / 0.23));
      T.aZ = T.aZ.slice(); T.aZ[near] = z; T.el = T.el.slice(); T.el[near] = k < 0.17 ? 1.2 : 0.15; T.aX = T.aX.slice(); T.aX[near] = 0.35;
      T.twist = k < 0.07 ? 0.3 : -0.35; rate = Math.max(rate, 30);
      setPose({ aZ: T.aZ }, 60, dt);
    }
    // aterrizaje: flexión
    st.sq.step(0, 220, 16, dt);
    const land = Math.max(0, -st.sq.x);
    st.yaw = damp(st.yaw, yawT, s.dying ? 10 : 13, dt);
    P.plant = damp(P.plant, plant, 12, dt);
    setPose(T, rate, dt);

    // ---------------- aplicar
    yaw.rotation.y = st.yaw;
    off.position.x = P.bodyX;
    // ciclo
    const moving = s.onGround && !s.skid && !s.crouch && !s.climbing && !s.dying && speed > 0.4 ? Math.min(1, speed / 1.2) : 0;
    const breathe = Math.sin(t * 2.4);
    const lZ = [P.lZ[0] + moving * sn * A, P.lZ[1] - moving * sn * A];
    const kn = [P.kn[0] - moving * (Math.max(0, cs) * (0.9 + 0.7 * runK) + 0.15) - land * 2.2, P.kn[1] - moving * (Math.max(0, -cs) * (0.9 + 0.7 * runK) + 0.15) - land * 2.2];
    lZ[0] += land * 1.1; lZ[1] += land * 1.1;
    const armSw = A * (1.0 + 0.4 * runK) * moving;
    const aZ = [P.aZ[0] - sn * armSw, P.aZ[1] + sn * armSw];
    const el = [P.el[0] + moving * (0.3 + 0.9 * runK), P.el[1] + moving * (0.3 + 0.9 * runK)];
    // idle: balanceo
    const idleK = still && !s.crouch && !s.victory ? 1 : 0;
    aZ[0] += idleK * breathe * 0.05; aZ[1] -= idleK * breathe * 0.05;

    const thighL = THIGH * legF, shinL = SHIN * legF;
    for (let i = 0; i < 2; i++) {
      const L = legs[i];
      L.hip.rotation.set(-L.side * P.lX[i] * 0.5, 0, lZ[i]);
      L.thigh.scale.set(1, legF, 1);
      L.knee.position.y = -thighL;
      L.knee.rotation.z = kn[i];
      L.shin.scale.set(1, legF, 1);
      L.ankle.position.y = -shinL;
      const plantFoot = -(lZ[i] + kn[i]);
      L.ankle.rotation.z = lerp(P.ft[i], plantFoot, P.plant * 0.9) + (moving ? (i ? -cs : cs) * 0.12 : 0);
    }
    // altura de cadera: la pierna más extendida toca el suelo
    const legH = (i) => thighL * Math.cos(lZ[i]) + shinL * Math.cos(lZ[i] + kn[i]);
    const standH = thighL + shinL + BOOT_H;
    const plantedH = Math.max(legH(0), legH(1)) + BOOT_H * (0.9 + 0.1 * P.plant);
    const runBob = moving * (Math.abs(sn) * 0.02 * runK);
    hips.position.y = lerp(standH, plantedH, P.plant) + runBob - P.hipDrop + (idleK ? breathe * 0.002 : 0);
    hips.rotation.z = -P.lean * 0.35;
    hips.rotation.y = moving * sn * 0.12 * A;
    torso.rotation.set(moving * cs * 0.04, P.twist - moving * sn * 0.16 * A, -P.lean * 0.65 + moving * Math.abs(cs) * 0.03);
    const tsy = torsoF * (1 + idleK * breathe * 0.014);
    torsoMesh.scale.set(1 + 0.04 * b, tsy, 1 + 0.04 * b); gear.scale.set(1, tsy, 1);
    neck.position.y = (TORSO_H - 0.01) * tsy;
    // brazos
    for (let i = 0; i < 2; i++) {
      const Ar = arms[i];
      Ar.sh.position.y = 0.205 * tsy;
      Ar.sh.rotation.set(-Ar.side * P.aX[i], 0, aZ[i]);
      Ar.up.scale.set(1, armF, 1);
      Ar.elbow.position.y = -0.058 * armF;
      Ar.elbow.rotation.z = el[i];
    }
    // cabeza
    st.look.y = damp(st.look.y, P.hy, 5, dt); st.look.p = damp(st.look.p, P.hp, 6, dt);
    head.scale.setScalar(headF);
    head.rotation.set(P.hr + moving * Math.sin(ph * 2) * 0.03, st.look.y * (idleK || s.dying ? 1 : 0.4) + (s.dying ? 0 : 0), P.lean * 0.5 + st.look.p + moving * Math.cos(ph * 2) * 0.03 * (1 + runK));
    // ojos
    const open = P.eyeOpen * blinkK;
    for (const E of eyes) {
      E.sock.scale.set(1, Math.max(0.08, open) * P.eyeWide, P.eyeWide);
      E.ball.rotation.set(0, st.look.y * 0.5 + 0.05, -st.look.p * 0.4);
      E.brow.position.y = 0.118 + P.browUp * 0.03 - (1 - open) * 0.02;
      E.brow.rotation.x = E.side * (0.15 - P.browUp * 0.25);
    }
    mouth.visible = P.mouthO < 0.4; mouthO.visible = !mouth.visible;
    mouthO.scale.set(1, 0.6 + 0.5 * P.mouthO, 0.8 + 0.3 * P.mouthO);
    // orejas (muelle)
    st.earTw -= dt;
    let tw = 0;
    if (st.earTw < 0) { st.earTw = 2 + Math.random() * 4; st.ear[Math.random() < 0.5 ? 0 : 1].v += 9; }
    for (let i = 0; i < 2; i++) {
      const sp = st.ear[i];
      sp.v += (-accY * 0.0025 + accX * 0.002) ; // inercia
      const e = sp.step(P.earBack, 160, 9, dt);
      ears[i].e.rotation.set(ears[i].side * (0.32 + 0.1 * moving * Math.abs(sn)), 0, 0.12 + e);
    }
    void tw;

    // ---------------- cola (física secundaria)
    {
      const baseT = 0.95 + 0.45 * walkK * (s.onGround ? 1 : 0.4) + 0.2 * runK - (s.onGround ? 0 : clamp(-s.vy / 20, -0.6, 0.8) * 0.6) - (s.crouch ? 0.25 : 0) + (s.skid ? -0.4 : 0) + (s.dying ? 0.6 : 0);
      st.tailBase.v += (accX * 0.004 + accY * 0.004) * dt * 60 * 0.08;
      tailRoot.rotation.z = st.tailBase.step(baseT, 70, 7, dt);
      tailRoot.rotation.x = Math.sin(t * 1.7) * 0.12 * (1 - walkK) + moving * Math.sin(ph) * 0.18;
      const curlIdle = [-0.1, -0.28, -0.32, -0.22];
      for (let i = 0; i < 4; i++) {
        const curl = lerp(curlIdle[i], 0.04, Math.max(walkK * 0.7, runK));
        const sway = Math.sin(t * 2.1 - i * 0.7) * 0.1 * (1 - walkK) + moving * Math.sin(ph - i * 0.8) * 0.12;
        const zs = st.tailZ[i], xs = st.tailX[i];
        zs.v += (accX * 0.0016 + accY * 0.0011) * (i + 1);
        tail.bones[i].rotation.z = zs.step(curl + (s.onGround ? 0 : -0.1 * clamp(-s.vy / 16, 0, 1)), 110 - i * 15, 8, dt);
        tail.bones[i].rotation.x = xs.step(sway, 90, 6, dt);
      }
      tail.mesh.scale.setScalar(1 + 0.06 * b);
    }
    // ---------------- bufanda (física secundaria)
    {
      const flow = Math.max(walkK * 0.7, runK) * (s.onGround ? 1 : 0.6);
      const fallK = s.onGround ? 0 : clamp(-s.vy / 18, -0.5, 1);
      const baseT = -0.75 - 0.6 * flow - 1.6 * Math.max(0, fallK) + 0.3 * Math.max(0, -fallK) + (s.skid ? 0.6 : 0) + (s.dying ? -1.2 : 0);
      st.scBase.v += (accX * 0.03 + accY * 0.025);
      scarfRoot.rotation.z = st.scBase.step(baseT, 80, 7, dt);
      const amp = 0.06 + 0.28 * flow + 0.25 * Math.max(0, fallK);
      for (let i = 0; i < 4; i++) {
        const zs = st.scZ[i], xs = st.scX[i];
        zs.v += (accX * 0.002 + accY * 0.0015) * (i + 1);
        const wave = Math.sin(t * (6 + 9 * flow) - i * 1.25) * amp;
        sTail.bones[i].rotation.z = zs.step(wave + 0.08 * (1 - flow), 140, 9, dt);
        sTail.bones[i].rotation.x = xs.step(Math.sin(t * 4.3 - i * 0.9) * (0.05 + 0.15 * flow), 100, 7, dt);
      }
    }

    // ---------------- escala general y squash & stretch
    st.stretch = damp(st.stretch, !s.onGround && s.vy > 4 && !s.climbing && !s.dying ? clamp(s.vy / 17, 0, 1) * 0.1 : 0, 12, dt);
    const sy = 1 + st.sq.x + st.stretch, sxz = 1 - st.sq.x * 0.55 - st.stretch * 0.45;
    body.scale.set(S * sxz, S * sy, S * sxz);
    // parpadeo de invulnerabilidad (no toca root.visible, que gestiona main.js)
    body.visible = !(s.invuln && !s.dying && Math.floor(t * 18) % 2);

    st.lastOnGround = s.onGround; st.lastVy = s.vy; st.lastVx = s.vx;
  }

  let lastO = null;
  function M_set(O) {
    if (lastO === O) return; lastO = O;
    M.scarf.color.set(O.scarf); M.scarf.sheenColor.set(O.scarfSheen);
    M.cloth.color.set(O.cloth); M.cloth.sheenColor.set(O.clothSheen);
    M.scarf.emissive.set(O === OUTFIT.fire ? 0x3a1a04 : 0x000000);
    U.uRimColor.value.set(O.rim); U.uRimK.value = O.rimK;
  }

  // pose inicial correcta
  update(1 / 60, { vx: 0, vy: 0, onGround: true, facing: 1, speed: 0, power: 0, time: 0, growT: -1, runMax: 10 });
  return { root, update };
}

function ss(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

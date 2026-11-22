// Objetos: Moneda estelar, Fruta Solar, Flor Ígnea, Estrella de cristal, Trébol de vida y bolas de fuego.
import {
  THREE, TAU, cached, mat, tex, merge, vcolor, tube, lathe, starShape, facetedStar,
  mesh, group, makeEye, blink, segs, glowSprite, glowMat, sparkleTex, isHigh, isLow,
} from './common.js';

// =====================================================================================
// MONEDA ESTELAR
// =====================================================================================
function coinRes() {
  return cached('res:coin', () => {
    const n = segs(36, 28, 20);
    const body = lathe([[0, 0.026], [0.2, 0.026], [0.218, 0.032], [0.232, 0.046], [0.27, 0.048], [0.292, 0.036], [0.304, 0.012], [0.304, -0.012], [0.292, -0.036], [0.27, -0.048], [0.232, -0.046], [0.218, -0.032], [0.2, -0.026], [0, -0.026]], n);
    body.rotateX(Math.PI / 2);
    const sopt = { depth: 0.008, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2, curveSegments: 2 };
    const sf = new THREE.ExtrudeGeometry(starShape(0.142, 0.062), sopt); sf.translate(0, 0, 0.026);
    const sb = sf.clone().rotateY(Math.PI);
    // muescas del canto (relieve)
    const notches = [];
    const NN = 24;
    for (let i = 0; i < NN; i++) { const a = i / NN * TAU; const b = new THREE.BoxGeometry(0.012, 0.03, 0.05); b.translate(0, 0.302, 0); b.rotateZ(a); notches.push(b); }
    const g = merge([body, sf, sb, ...notches]);
    g.computeBoundingSphere();
    g.userData.shared = true;
    return {
      geo: g,
      mat: mat('gold', { physical: true, color: 0xffc23a, metalness: 1, roughness: 0.2, env: 1.35, emissive: 0xff8a10, emissiveIntensity: 0.07, clearcoat: 0.4, clearcoatRoughness: 0.1, rim: [0xfff0b0, 0.5, 2.5] }),
    };
  });
}

/** Moneda estelar. s = { time, popping(bool) } */
export function createCoinModel() {
  const R = coinRes();
  const root = new THREE.Group();
  const spin = group(); spin.position.y = 0.45; root.add(spin);
  spin.add(mesh(R.geo, R.mat));
  let glint = null;
  if (isHigh()) { glint = glowSprite('coinGlint', 0xfff2c0, 0.4, 1, sparkleTex()); glint.position.set(0.12, 0.62, 0.12); root.add(glint); }
  const off = Math.random() * 10;
  return {
    root,
    update(dt, s) {
      const t = s.time;
      spin.rotation.y = t * 3.4;
      spin.position.y = 0.45 + Math.sin(t * 2.6) * 0.035;
      const sc = s.popping ? 1.12 : 1; spin.scale.setScalar(sc);
      if (glint) {
        const g = (t + off) % 2.6, k = g < 0.35 ? Math.sin(g / 0.35 * Math.PI) : 0;
        glint.scale.setScalar(0.001 + k * 0.42); glint.visible = k > 0.01;
        glint.material.rotation = 0;
      }
    },
  };
}

// =====================================================================================
// FRUTA SOLAR (crecer)
// =====================================================================================
function fruitRes() {
  return cached('res:fruit', () => {
    const body = new THREE.SphereGeometry(0.29, segs(32, 24, 16), segs(24, 18, 12));
    { // pliegue vertical de melocotón + achatado
      const p = body.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const a = Math.atan2(x, z); const crease = Math.exp(-((a - 0.0) ** 2) / 0.03) * 0.06 + Math.exp(-((Math.abs(a) - Math.PI) ** 2) / 0.03) * 0.04;
        const top = y > 0.22 ? (y - 0.22) * 0.6 : 0;
        const k = 1 - crease * Math.max(0, 1 - Math.abs(y) / 0.3) * 0 - top;
        p.setXYZ(i, x * (1 - crease * 0.6) * 1.04, y * 0.93 * k, z * (1 - crease * 0.25) * 1.04);
      }
      body.computeVertexNormals();
    }
    vcolor(body, (x, y, z, c) => {
      const k = THREE.MathUtils.clamp((y + 0.27) / 0.54, 0, 1);
      const cr = new THREE.Color(0xff3d12).lerp(new THREE.Color(0xff8a1a), Math.min(1, k * 1.6)).lerp(new THREE.Color(0xffe04a), Math.max(0, k - 0.45) / 0.55);
      c.copy(cr);
    });
    body.translate(0, 0.28, 0);
    // corona de rayos solares
    const rays = [];
    const NR = 10;
    for (let i = 0; i < NR; i++) {
      const g = new THREE.ConeGeometry(0.04, 0.16 + (i % 2) * 0.05, 4); g.scale(1, 1, 0.45);
      g.translate(0, 0.1, 0); g.rotateZ(-1.05); g.translate(0.07, 0, 0); g.rotateY(i / NR * TAU); g.translate(0, 0.5, 0);
      rays.push(g);
    }
    const crown = merge(rays);
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.05, 0.06, 0.17, 0.07, 0.24, 0.0); leafShape.bezierCurveTo(0.16, -0.05, 0.05, -0.05, 0, 0);
    const lf = new THREE.ShapeGeometry(leafShape, 8);
    { const p = lf.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -x * x * 1.6); } }
    const leaves = merge([
      lf.clone().rotateX(-Math.PI / 2 + 0.6).rotateY(0.4).translate(0.0, 0.55, 0.0),
      lf.clone().rotateX(-Math.PI / 2 + 0.6).rotateY(Math.PI + 0.6).translate(0.0, 0.55, 0.0),
      tube([[0, 0.5, 0], [0.0, 0.58, 0], [0.03, 0.63, 0]], 0.022, 6, 5),
    ]);
    const smile = new THREE.TorusGeometry(0.035, 0.011, 6, 12, Math.PI); smile.rotateZ(Math.PI);
    [body, crown, leaves, smile].forEach((g) => (g.userData.shared = true));
    return {
      body, crown, leaves, smile,
      bodyMat: mat('fruitBody', { physical: true, vertexColors: true, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 1, sheenColor: new THREE.Color(0xffd0a0), sheenRoughness: 0.5, emissive: 0xff6010, emissiveIntensity: 0.22, rim: [0xfff0b0, 0.55, 2.4] }),
      crownMat: mat('fruitCrown', { color: 0xffd23a, emissive: 0xffa010, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.3 }),
      leafMat: mat('fruitLeaf', { color: 0x3ec43a, roughness: 0.45, side: THREE.DoubleSide, rim: [0xe0ffb0, 0.3, 2.5] }),
      mouthMat: mat('mouthDark', { color: 0x2a0c06, roughness: 0.5 }),
    };
  });
}

/** Fruta Solar (crecer). s = { time, emerge } */
export function createFruitModel() {
  const R = fruitRes();
  const root = new THREE.Group();
  const bob = group(); root.add(bob);
  bob.add(mesh(R.body, R.bodyMat));
  const crown = mesh(R.crown, R.crownMat, false); bob.add(crown);
  bob.add(mesh(R.leaves, R.leafMat, false));
  const eyes = [-1, 1].map((sx) => { const e = makeEye(0.062, 'brown', 0.9, 1.25, 0.7); e.position.set(sx * 0.09, 0.34, 0.255); e.rotation.y = sx * 0.3; bob.add(e); return e; });
  const smile = mesh(R.smile, R.mouthMat, false); smile.position.set(0, 0.255, 0.285); smile.rotation.x = -0.3; bob.add(smile);
  const glow = glowSprite('fruitGlow', 0xffa030, 1.15, 0.45); glow.position.y = 0.32; glow.renderOrder = -1; root.add(glow);
  return {
    root,
    update(dt, s) {
      const t = s.time;
      const b = Math.abs(Math.sin(t * 5));
      bob.position.y = b * 0.03;
      bob.scale.set(1 + (1 - b) * 0.035, 1 - (1 - b) * 0.05, 1 + (1 - b) * 0.035);
      bob.rotation.y = Math.sin(t * 1.4) * 0.35;
      crown.rotation.y = t * 0.8;
      glow.scale.setScalar(1.05 + Math.sin(t * 4) * 0.1);
      const bl = blink(t, 0.7); eyes.forEach((e) => (e.scale.y = 0.062 * 1.25 * bl));
    },
  };
}

// =====================================================================================
// FLOR ÍGNEA
// =====================================================================================
function flameShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.9, h * 0.15, w * 1.05, h * 0.55, w * 0.35, h * 0.78);
  s.quadraticCurveTo(w * 0.25, h * 0.92, 0.0, h);
  s.quadraticCurveTo(-w * 0.15, h * 0.85, -w * 0.4, h * 0.72);
  s.bezierCurveTo(-w * 1.05, h * 0.5, -w * 0.9, h * 0.15, 0, 0);
  return s;
}
function petalRing(n, w, h, r0, cup, c0, c1, rot = 0) {
  const base = new THREE.ShapeGeometry(flameShape(w, h), 8);
  { const p = base.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, y * y * cup - x * x * 0.8); } }
  const A = new THREE.Color(c0), B = new THREE.Color(c1);
  vcolor(base, (x, y, z, c) => c.copy(A).lerp(B, Math.pow(y / h, 0.9)));
  const list = [];
  for (let i = 0; i < n; i++) { const g = base.clone(); g.translate(0, r0, 0); g.rotateZ(rot + i / n * TAU); list.push(g); }
  return merge(list, true);
}
function flowerRes() {
  return cached('res:flower', () => {
    const outer = petalRing(7, 0.15, 0.3, 0.06, 0.9, 0xff8a10, 0xd8100c);
    const mid = petalRing(7, 0.12, 0.22, 0.05, 1.1, 0xffc020, 0xff4a0a, Math.PI / 7);
    const inner = petalRing(6, 0.08, 0.15, 0.04, 1.3, 0xfff2a0, 0xffa010);
    const core = new THREE.SphereGeometry(0.11, 20, 14); core.scale(1, 1, 0.6);
    const stem = tube([[0, 0, 0], [0.04, 0.18, 0], [-0.03, 0.34, 0], [0, 0.5, 0]], 0.04, 12, 7, (t) => 1 - t * 0.3);
    const lf = new THREE.Shape();
    lf.moveTo(0, 0); lf.bezierCurveTo(0.06, 0.09, 0.22, 0.1, 0.32, 0.02); lf.bezierCurveTo(0.2, -0.07, 0.07, -0.07, 0, 0);
    const leaf = new THREE.ShapeGeometry(lf, 8);
    { const p = leaf.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -x * x * 0.9 + Math.abs(y) * 0.5); } }
    const leaves = merge([leaf.clone().rotateZ(0.5).translate(0.02, 0.12, 0), leaf.clone().rotateZ(0.5).rotateY(Math.PI).translate(-0.02, 0.2, 0)]);
    [outer, mid, inner, core, stem, leaves].forEach((g) => (g.userData.shared = true));
    const petalOpts = (k) => ({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.4, emissive: 0xff5a10, emissiveIntensity: k, rim: [0xffe0a0, 0.35, 2] });
    return {
      outer, mid, inner, core, stem, leaves,
      outerMat: mat('flowerOuter', petalOpts(0.35)), midMat: mat('flowerMid', petalOpts(0.55)), innerMat: mat('flowerInner', petalOpts(0.8)),
      coreMat: mat('flowerCore', { color: 0xfff4c0, emissive: 0xffc040, emissiveIntensity: 0.7, roughness: 0.3 }),
      stemMat: mat('flowerStem', { color: 0x3aa83a, roughness: 0.5, rim: [0xd8ffb0, 0.3, 2.5] }),
      leafMat: mat('fruitLeaf', { color: 0x3ec43a, roughness: 0.45, side: THREE.DoubleSide, rim: [0xe0ffb0, 0.3, 2.5] }),
    };
  });
}

/** Flor Ígnea (fuego). s = { time, emerge } */
export function createFlowerModel() {
  const R = flowerRes();
  const root = new THREE.Group();
  const sway = group(); root.add(sway);
  sway.add(mesh(R.stem, R.stemMat, false), mesh(R.leaves, R.leafMat, false));
  const head = group(); head.position.set(0, 0.58, 0.02); sway.add(head);
  const outer = mesh(R.outer, R.outerMat); const mid = mesh(R.mid, R.midMat, false); const inner = mesh(R.inner, R.innerMat, false);
  mid.position.z = 0.03; inner.position.z = 0.06;
  const core = mesh(R.core, R.coreMat, false); core.position.z = 0.08;
  head.add(outer, mid, inner, core);
  const eyes = [-1, 1].map((sx) => { const e = makeEye(0.034, 'brown', 0.8, 1.4, 0.6); e.position.set(sx * 0.04, 0.012, 0.135); head.add(e); return e; });
  const glow = glowSprite('flowerGlow', 0xff6a1a, 1.2, 0.55); glow.position.set(0, 0.58, -0.05); root.add(glow);
  return {
    root,
    update(dt, s) {
      const t = s.time;
      sway.rotation.z = Math.sin(t * 2.2) * 0.06;
      head.rotation.y = Math.sin(t * 1.3) * 0.25;
      outer.rotation.z = Math.sin(t * 3) * 0.08; outer.scale.setScalar(1 + Math.sin(t * 9) * 0.03);
      mid.rotation.z = -Math.sin(t * 3.4) * 0.12; mid.scale.setScalar(1 + Math.sin(t * 11 + 1) * 0.05);
      inner.rotation.z = t * 0.9; inner.scale.setScalar(1 + Math.sin(t * 13 + 2) * 0.07);
      glow.scale.setScalar(1.1 + Math.sin(t * 7) * 0.1 + Math.sin(t * 17) * 0.05);
      const bl = blink(t, 2.1); eyes.forEach((e) => (e.scale.y = 0.034 * 1.4 * bl));
    },
  };
}

// =====================================================================================
// ESTRELLA DE CRISTAL (invencibilidad)
// =====================================================================================
function starRes() {
  return cached('res:star', () => {
    const outerG = facetedStar(0.42, 0.19, 0.17);
    // arcoíris por faceta
    { const p = outerG.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
      for (let i = 0; i < p.count; i += 3) {
        const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
        const front = p.getZ(i) > 0 ? 0 : 0.08;
        col.setHSL(((Math.atan2(cy, cx) / TAU + 1) % 1 + front) % 1, 0.9, 0.55);
        col.lerp(new THREE.Color(0xffe060), 0.2);
        for (let k = 0; k < 3; k++) c.set([col.r, col.g, col.b], (i + k) * 3);
      }
      outerG.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const innerG = facetedStar(0.24, 0.11, 0.1);
    const haloTex = tex('starHalo', 256, 256, (g, w) => {
      const c = w / 2; g.clearRect(0, 0, w, w);
      const cg = g.createConicGradient ? g.createConicGradient(0, c, c) : null;
      if (cg) { ['#ff5a5a', '#ffb34a', '#fff35a', '#6aff8a', '#5ad8ff', '#8a6aff', '#ff6ad8', '#ff5a5a'].forEach((col, i, a) => cg.addColorStop(i / (a.length - 1), col)); g.fillStyle = cg; }
      else g.fillStyle = '#fff6a0';
      g.beginPath(); g.arc(c, c, c * 0.95, 0, TAU); g.arc(c, c, c * 0.55, 0, TAU, true); g.fill();
      g.globalCompositeOperation = 'destination-in';
      const rg = g.createRadialGradient(c, c, c * 0.5, c, c, c * 0.95);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.35, 'rgba(0,0,0,0.9)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, w);
    }, { repeat: false });
    [outerG, innerG].forEach((g) => (g.userData.shared = true));
    return {
      outerG, innerG,
      outerMat: mat('starOuter', { physical: true, vertexColors: true, flatShading: true, metalness: 0.05, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.05, iridescence: 0.35, iridescenceIOR: 1.4, emissive: 0xffe680, emissiveIntensity: 0.15, env: 0.45 }),
      innerMat: cached('mat:starInner', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.3, 0.8), toneMapped: true })),
      haloMat: cached('mat:starHalo', () => new THREE.SpriteMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6, toneMapped: false })),
    };
  });
}

/** Estrella de cristal (invencible). s = { time, emerge } */
export function createStarModel() {
  const R = starRes();
  const root = new THREE.Group();
  const spin = group(); spin.position.y = 0.42; root.add(spin);
  const outer = mesh(R.outerG, R.outerMat); outer.renderOrder = 2;
  spin.add(outer);
  const halo = new THREE.Sprite(R.haloMat); halo.scale.setScalar(1.25); halo.position.y = 0.42; halo.renderOrder = 0; root.add(halo);
  const glow = glowSprite('starGlow', 0xffe070, 1.0, 0.35); glow.position.y = 0.42; root.add(glow);
  const sparks = [];
  for (let i = 0; i < (isLow() ? 1 : 3); i++) { const sp = glowSprite('starSpark', 0xffffff, 0.2, 1, sparkleTex()); root.add(sp); sparks.push(sp); }
  const col = new THREE.Color();
  return {
    root,
    update(dt, s) {
      const t = s.time;
      spin.rotation.y = t * 3.2;
      spin.rotation.z = Math.sin(t * 2) * 0.12;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      R.outerMat.emissive.copy(col.setHSL((t * 0.35) % 1, 0.9, 0.6));
      R.outerMat.emissiveIntensity = 0.08 + pulse * 0.12;
      R.haloMat.rotation = t * 0.8;
      halo.scale.setScalar(1.15 + pulse * 0.15);
      glow.scale.setScalar(0.95 + pulse * 0.2);
      sparks.forEach((sp, i) => {
        const a = t * 2.4 + i * TAU / sparks.length;
        sp.position.set(Math.cos(a) * 0.5, 0.42 + Math.sin(a * 1.3) * 0.3, Math.sin(a) * 0.3);
        sp.scale.setScalar(0.12 + 0.12 * Math.abs(Math.sin(t * 5 + i * 2)));
      });
    },
  };
}

// =====================================================================================
// TRÉBOL DE VIDA (1UP)
// =====================================================================================
function cloverRes() {
  return cached('res:clover', () => {
    const heart = new THREE.Shape();
    heart.moveTo(0, 0);
    heart.bezierCurveTo(-0.06, 0.05, -0.17, 0.1, -0.16, 0.21);
    heart.bezierCurveTo(-0.15, 0.29, -0.05, 0.3, 0, 0.23);
    heart.bezierCurveTo(0.05, 0.3, 0.15, 0.29, 0.16, 0.21);
    heart.bezierCurveTo(0.17, 0.1, 0.06, 0.05, 0, 0);
    const hg = new THREE.ExtrudeGeometry(heart, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 3, curveSegments: 10 });
    hg.translate(0, 0.025, -0.01);
    // abombado suave
    { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) - (x * x + (y - 0.15) ** 2) * 0.6); } hg.computeVertexNormals(); }
    vcolor(hg, (x, y, z, c) => {
      const r = Math.hypot(x, y) / 0.32;
      const vein = Math.abs(x) < 0.012 && y > 0.04 && y < 0.2 ? 0.25 : 0;
      c.setRGB(0.04 + 0.14 * r + vein * 0.6, 0.32 + 0.38 * r + vein, 0.05 + 0.04 * r + vein * 0.3);
    });
    const leaves = merge([0, 1, 2, 3].map((i) => hg.clone().rotateZ(Math.PI / 4 + i * Math.PI / 2)), true);
    leaves.translate(0, 0.45, 0);
    const stem = tube([[0, 0.45, -0.02], [0.02, 0.3, -0.02], [0.08, 0.14, -0.01], [0.04, 0.02, 0]], 0.03, 12, 6, (t) => 1 - t * 0.3);
    const gem = new THREE.IcosahedronGeometry(0.075, 0); gem.scale(1, 1, 0.8); gem.translate(0, 0.45, 0.06);
    [leaves, stem, gem].forEach((g) => (g.userData.shared = true));
    return {
      leaves, stem, gem,
      leafMat: mat('cloverLeaf', { physical: true, vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.15, sheenColor: new THREE.Color(0xc0ffb0), emissive: 0x20a030, emissiveIntensity: 0.08, rim: [0xe0ffc0, 0.25, 2.6] }),
      stemMat: mat('flowerStem', { color: 0x3aa83a, roughness: 0.5, rim: [0xd8ffb0, 0.3, 2.5] }),
      gemMat: mat('cloverGem', { physical: true, color: 0xffd040, metalness: 0.9, roughness: 0.15, flatShading: true, emissive: 0xffa020, emissiveIntensity: 0.5, env: 1.3 }),
    };
  });
}

/** Trébol de vida (1UP). s = { time, emerge } */
export function createOneUpModel() {
  const R = cloverRes();
  const root = new THREE.Group();
  const bob = group(); root.add(bob);
  bob.add(mesh(R.leaves, R.leafMat), mesh(R.stem, R.stemMat, false), mesh(R.gem, R.gemMat, false));
  const eyes = [-1, 1].map((sx) => { const e = makeEye(0.04, 'green', 0.85, 1.3, 0.6); e.position.set(sx * 0.1, 0.56, 0.06); bob.add(e); return e; });
  const glow = glowSprite('cloverGlow', 0x60ff70, 1.0, 0.25); glow.position.y = 0.42; root.add(glow);
  const spark = glowSprite('cloverSpark', 0xfff6c0, 0.3, 1, sparkleTex()); root.add(spark);
  return {
    root,
    update(dt, s) {
      const t = s.time;
      bob.rotation.y = Math.sin(t * 1.6) * 0.5;
      bob.position.y = Math.abs(Math.sin(t * 4.5)) * 0.03;
      bob.rotation.z = Math.sin(t * 2.3) * 0.06;
      glow.scale.setScalar(1.0 + Math.sin(t * 3.5) * 0.12);
      const g = t % 1.9, k = g < 0.4 ? Math.sin(g / 0.4 * Math.PI) : 0;
      spark.position.set(0.16, 0.66, 0.12); spark.scale.setScalar(0.001 + k * 0.35); spark.visible = k > 0.01;
      const bl = blink(t, 1.7); eyes.forEach((e) => (e.scale.y = 0.04 * 1.3 * bl));
    },
  };
}

// =====================================================================================
// BOLA DE FUEGO
// =====================================================================================
function fireRes() {
  return cached('res:fire', () => {
    const swirl = tex('fireSwirl', 128, 128, (g, w) => {
      const c = w / 2; g.clearRect(0, 0, w, w);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        g.save(); g.translate(c, c); g.rotate(k * TAU / 3);
        const gr = g.createLinearGradient(0, -c * 0.9, 0, 0);
        gr.addColorStop(0, 'rgba(255,80,0,0)'); gr.addColorStop(0.5, 'rgba(255,140,20,0.8)'); gr.addColorStop(1, 'rgba(255,230,120,1)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(c * 0.5, -c * 0.1, c * 0.55, -c * 0.6, c * 0.1, -c * 0.92);
        g.bezierCurveTo(c * 0.15, -c * 0.55, -c * 0.05, -c * 0.3, -c * 0.25, -c * 0.15);
        g.closePath(); g.fill(); g.restore();
      }
    }, { repeat: false });
    const core = new THREE.IcosahedronGeometry(0.12, 2); core.userData.shared = true;
    return {
      core,
      coreMat: cached('mat:fireCore', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 0.9) })),
      swirlMat: cached('mat:fireSwirl', () => new THREE.SpriteMaterial({ map: swirl, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    };
  });
}

/** Bola de fuego del jugador. Pivote en el centro. s = { time, vx } */
export function createFireballModel() {
  const R = fireRes();
  const root = new THREE.Group();
  const core = mesh(R.core, R.coreMat, false); root.add(core);
  const halo = glowSprite('fireHalo', 0xff7a1a, 0.85, 0.95); root.add(halo);
  const hot = glowSprite('fireHot', 0xffe090, 0.38, 1); root.add(hot);
  const swirl = new THREE.Sprite(R.swirlMat); swirl.scale.setScalar(0.62); swirl.renderOrder = 6; root.add(swirl);
  return {
    root,
    update(dt, s) {
      const t = s.time, dir = (s.vx || 1) >= 0 ? 1 : -1;
      R.swirlMat.rotation = -t * 14 * dir;
      core.rotation.z = -t * 10 * dir; core.rotation.x = t * 6;
      const f = 1 + Math.sin(t * 40) * 0.08 + Math.sin(t * 23) * 0.06;
      halo.scale.setScalar(0.85 * f); swirl.scale.setScalar(0.6 * f);
      core.scale.setScalar(1 + Math.sin(t * 31) * 0.08);
    },
  };
}

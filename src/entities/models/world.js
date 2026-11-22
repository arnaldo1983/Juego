// Mundo: plataforma móvil, meta (mástil + estandarte de tela + fortaleza) y punto de control.
import {
  THREE, TAU, cached, mat, tex, rnd, noiseFill, merge, scaleUV, tube, starShape, facetedStar,
  mesh, group, segs, glowSprite, sparkleTex, isLow, roundedBox,
} from './common.js';

// ------------------------------------------------------------------ texturas comunes
function stoneTex(bump = false) {
  return tex(bump ? 'stoneBump' : 'stone', 512, 512, (g, w, h) => {
    g.fillStyle = bump ? '#202020' : '#5e5448'; g.fillRect(0, 0, w, h);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const bh = h / rows; let x = -((r * 37) % 64);
      while (x < w) {
        const bw = 52 + rnd() * 44;
        const l = 0.82 + rnd() * 0.3, warm = rnd() * 14;
        if (bump) { const v = 150 + rnd() * 60 | 0; g.fillStyle = `rgb(${v},${v},${v})`; }
        else g.fillStyle = `rgb(${(176 + warm) * l | 0},${(164 + warm * 0.5) * l | 0},${146 * l | 0})`;
        const x0 = x + 3, y0 = r * bh + 3, ww = bw - 6, hh = bh - 6;
        g.beginPath(); g.roundRect ? g.roundRect(x0, y0, ww, hh, 6) : g.rect(x0, y0, ww, hh); g.fill();
        if (!bump) {
          const gr = g.createLinearGradient(0, y0, 0, y0 + hh); gr.addColorStop(0, 'rgba(255,245,225,0.22)'); gr.addColorStop(0.3, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(40,25,10,0.28)');
          g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x0, y0, ww, hh, 6) : g.rect(x0, y0, ww, hh); g.fill();
          if (rnd() < 0.18) { g.fillStyle = 'rgba(90,130,50,0.35)'; g.beginPath(); g.ellipse(x0 + rnd() * ww, y0 + hh, 10 + rnd() * 14, 5, 0, 0, TAU); g.fill(); }
        }
        x += bw;
      }
    }
    noiseFill(g, w, h, bump ? 30 : 16, 2);
  }, { srgb: !bump });
}
function woodTex() {
  return tex('wood', 256, 256, (g, w, h) => {
    g.fillStyle = '#a8662c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const y = rnd() * h; g.strokeStyle = `rgba(${rnd() < 0.6 ? '70,32,10' : '230,170,100'},${0.12 + rnd() * 0.2})`;
      g.lineWidth = 1 + rnd() * 2.5; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
      g.stroke();
    }
    for (let k = 0; k < 3; k++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = 'rgba(60,25,8,0.5)'; g.beginPath(); g.ellipse(x, y, 9, 4, 0, 0, TAU); g.fill(); }
    noiseFill(g, w, h, 12, 2);
  });
}
/** Proyecta UVs por normal (mapeo en caja) en coordenadas de mundo/escala. */
function boxUV(geo, s = 0.5, grainAlongZ = false) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) grainAlongZ ? uv.setXY(i, z * s, x * s) : uv.setXY(i, x * s, z * s);
    else if (ax >= az) uv.setXY(i, z * s, y * s);
    else uv.setXY(i, x * s, y * s);
  }
  return geo;
}
/** Emblema de Kiko: estrella con huella de zorro. */
function drawEmblem(g, cx, cy, R) {
  g.save(); g.translate(cx, cy);
  const star = (rr, ri) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : rr; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = R * 0.12; g.shadowOffsetY = R * 0.05;
  star(R * 1.08, R * 0.5); g.fillStyle = '#fff1c2'; g.fill(); g.shadowColor = 'transparent';
  star(R, R * 0.45);
  const sg = g.createLinearGradient(0, -R, 0, R); sg.addColorStop(0, '#ffd34a'); sg.addColorStop(0.55, '#ff9a1a'); sg.addColorStop(1, '#e8601a');
  g.fillStyle = sg; g.fill();
  // huella de zorro
  g.fillStyle = '#fff8ea';
  g.beginPath(); g.ellipse(0, R * 0.16, R * 0.2, R * 0.16, 0, 0, TAU); g.fill();
  for (const [x, y, rr] of [[-0.21, -0.1, 0.075], [-0.075, -0.21, 0.08], [0.075, -0.21, 0.08], [0.21, -0.1, 0.075]]) {
    g.beginPath(); g.ellipse(x * R, y * R, rr * R, rr * R * 1.25, x * 1.4, 0, TAU); g.fill();
  }
  g.restore();
}
function bannerTex(key, w, h, opts = {}) {
  return tex(key, w, h, (g) => {
    const { bg0 = '#1b6a9a', bg1 = '#0c3560', notch = 'left', grey = false } = opts;
    g.clearRect(0, 0, w, h);
    g.save();
    // silueta con cola de golondrina
    g.beginPath();
    if (notch === 'left') { g.moveTo(w, 0); g.lineTo(0, 0); g.lineTo(w * 0.16, h / 2); g.lineTo(0, h); g.lineTo(w, h); }
    else if (notch === 'bottom') { g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w / 2, h * 0.84); g.lineTo(0, h); }
    else { g.rect(0, 0, w, h); }
    g.closePath(); g.clip();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, bg0); gr.addColorStop(1, bg1);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // patrón de rombos sutil
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 28) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
    // ribete dorado
    g.strokeStyle = grey ? '#9aa0a8' : '#ffcf5a'; g.lineWidth = Math.max(6, w * 0.022);
    g.beginPath();
    const m = g.lineWidth * 1.4;
    if (notch === 'left') { g.moveTo(w - m * 0.3, m); g.lineTo(m * 1.2, m); g.lineTo(w * 0.16 + m, h / 2); g.lineTo(m * 1.2, h - m); g.lineTo(w - m * 0.3, h - m); }
    else if (notch === 'bottom') { g.moveTo(m, m * 0.3); g.lineTo(m, h - m * 1.6); g.lineTo(w / 2, h * 0.84 - m); g.lineTo(w - m, h - m * 1.6); g.lineTo(w - m, m * 0.3); }
    else g.rect(m, m, w - 2 * m, h - 2 * m);
    g.stroke();
    if (!grey) drawEmblem(g, notch === 'left' ? w * 0.56 : w / 2, notch === 'bottom' ? h * 0.42 : h / 2, Math.min(w, h) * 0.3);
    g.restore();
    noiseFill(g, w, h, 8, 2);
  }, { repeat: false });
}
function fabricMat(key, map) {
  return mat(key, { physical: true, map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 });
}
/** Tela animada: plano con vértices ondulando. El borde x=anchor queda fijo. */
function makeCloth(w, h, sx, sy, material, anchorRight = true) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  g.translate(anchorRight ? -w / 2 : w / 2, 0, 0);
  const base = g.attributes.position.array.slice();
  const m = mesh(g, material); m.castShadow = !isLow();
  let frame = 0;
  return {
    mesh: m,
    update(t, amp = 1, speed = 1) {
      if (isLow() && (frame++ & 1)) return;
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x0 = base[i * 3], y0 = base[i * 3 + 1];
        const u = Math.abs(x0) / w;
        const wave = Math.sin(u * 5.2 - t * 5.5 * speed + y0 * 1.6) * 0.5 + Math.sin(u * 9.5 - t * 8.3 * speed + y0 * 2.4) * 0.18;
        p.setXYZ(i, x0 * (1 - 0.035 * amp * (1 + Math.sin(t * 2.1))), y0 - u * u * 0.08 * (1.4 - amp), wave * 0.16 * amp * Math.pow(u, 1.1));
      }
      p.needsUpdate = true; g.computeVertexNormals();
    },
  };
}

// =====================================================================================
// PLATAFORMA MÓVIL
// =====================================================================================
function platformRes(w) {
  return cached('res:platform:' + w, () => {
    const planks = [];
    const n = Math.round(w * 2);
    for (let i = 0; i < n; i++) {
      const b = roundedBox(0.47, 0.16, 0.98 - rnd() * 0.04, 0.035, 2);
      b.rotateY((rnd() - 0.5) * 0.03); b.translate(-w / 2 + 0.25 + i * 0.5, -0.085 + (rnd() - 0.5) * 0.012, (rnd() - 0.5) * 0.02);
      planks.push(b);
    }
    const plankG = boxUV(merge(planks), 0.6, true);
    const metal = [];
    for (const z of [-0.43, 0.43]) {
      metal.push(roundedBox(w + 0.06, 0.1, 0.07, 0.02, 2).translate(0, -0.11, z));
      for (let x = -w / 2 + 0.12; x < w / 2; x += 0.25) metal.push(new THREE.SphereGeometry(0.022, 8, 6).translate(x, -0.11, z + Math.sign(z) * 0.04));
    }
    for (const sx of [-1, 1]) metal.push(roundedBox(0.08, 0.2, 1.04, 0.025, 2).translate(sx * (w / 2 + 0.01), -0.11, 0));
    const metalG = merge(metal);
    const ks = new THREE.Shape();
    const kt = w * 0.32, kb = w * 0.12;
    ks.moveTo(-kt, 0); ks.lineTo(kt, 0); ks.lineTo(kb, -0.32); ks.lineTo(-kb, -0.32); ks.closePath();
    const keel = new THREE.ExtrudeGeometry(ks, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    keel.translate(0, -0.17, -0.25); boxUV(keel, 0.8);
    const crystal = new THREE.OctahedronGeometry(0.13, 0); crystal.scale(1, 1.7, 1);
    const ring = new THREE.TorusGeometry(0.26, 0.014, 6, 32);
    // runas del anillo (pequeños rombos)
    const runes = merge(Array.from({ length: 6 }, (_, i) => { const r = new THREE.OctahedronGeometry(0.03, 0); r.translate(0.26, 0, 0); r.rotateZ(i / 6 * TAU); return r; }));
    [plankG, metalG, keel, crystal, ring, runes].forEach((g) => (g.userData.shared = true));
    return {
      plankG, metalG, keel, crystal, ring, runes,
      woodMat: mat('wood', { map: woodTex(), bumpMap: woodTex(), bumpScale: 1.2, roughness: 0.7, rim: [0xffe0b0, 0.15, 3] }),
      brassMat: mat('brass', { color: 0xc89a48, metalness: 0.9, roughness: 0.32, env: 1.1 }),
      stoneMat: mat('stone', { map: stoneTex(), bumpMap: stoneTex(true), bumpScale: 2.5, roughness: 0.9 }),
      crystalMat: mat('magicCrystal', { physical: true, color: 0x8ff6ff, emissive: 0x30d8ff, emissiveIntensity: 1.6, roughness: 0.1, flatShading: true, clearcoat: 1 }),
      runeMat: cached('mat:rune', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6) })),
    };
  });
}

/** Plataforma móvil de anchura w casillas. Pivote = centro de la cara superior. s = { time } */
export function createPlatformModel(w = 3) {
  const R = platformRes(w);
  const root = new THREE.Group();
  root.add(mesh(R.plankG, R.woodMat, true, true), mesh(R.metalG, R.brassMat, false), mesh(R.keel, R.stoneMat));
  const motor = group(); motor.position.y = -0.66; root.add(motor);
  const crystal = mesh(R.crystal, R.crystalMat, false); motor.add(crystal);
  const ringG = group(mesh(R.ring, R.runeMat, false), mesh(R.runes, R.runeMat, false)); ringG.rotation.x = Math.PI / 2 - 0.3; motor.add(ringG);
  const glow = glowSprite('platGlow', 0x40d8ff, 1.0, 0.7); motor.add(glow);
  return {
    root,
    update(dt, s) {
      const t = s.time;
      crystal.rotation.y = t * 1.8; crystal.position.y = Math.sin(t * 2.4) * 0.04;
      ringG.rotation.z = -t * 1.2;
      glow.scale.setScalar(0.85 + Math.sin(t * 3.1) * 0.12);
      root.rotation.z = Math.sin(t * 1.3) * 0.008;
    },
  };
}

// =====================================================================================
// META: mástil + estandarte + fortaleza
// =====================================================================================
function goalRes() {
  return cached('res:goal', () => {
    const n = segs(16, 12, 8);
    const pole = new THREE.CylinderGeometry(0.06, 0.07, 9.6, n); pole.translate(0, 0.35 + 4.8, 0);
    const rings = [];
    for (let y = 0.6; y < 9.8; y += 1.5) rings.push(new THREE.TorusGeometry(0.075, 0.022, 6, n).rotateX(Math.PI / 2).translate(0, y, 0));
    rings.push(new THREE.CylinderGeometry(0.11, 0.13, 0.18, n).translate(0, 9.92, 0));
    rings.push(new THREE.SphereGeometry(0.1, n, 8).translate(0, 10.05, 0));
    const pedestal = merge([
      new THREE.CylinderGeometry(0.34, 0.4, 0.12, n).translate(0, 0.06, 0),
      new THREE.CylinderGeometry(0.24, 0.3, 0.2, n).translate(0, 0.22, 0),
    ]);
    const gold = merge(rings.concat([new THREE.TorusGeometry(0.27, 0.025, 6, n).rotateX(Math.PI / 2).translate(0, 0.32, 0)]));
    const finial = facetedStar(0.3, 0.13, 0.11);
    const ringClip = new THREE.TorusGeometry(0.09, 0.02, 6, 12).rotateX(Math.PI / 2);

    // ---------------- fortaleza (centrada en x=7 relativa al mástil)
    const CX = 7, FZ = -0.6;
    const stone = [];
    const hall = new THREE.BoxGeometry(4.8, 3.0, 2.3).translate(CX, 1.5, FZ - 1.15); stone.push(boxUV(hall, 0.5));
    // almenas frontales y laterales
    for (let x = CX - 2.25; x <= CX + 2.26; x += 0.6) stone.push(boxUV(roundedBox(0.36, 0.45, 0.32, 0.03, 1).translate(x, 3.2, FZ - 0.16), 0.5));
    // zócalo
    stone.push(boxUV(roundedBox(5.2, 0.35, 2.6, 0.05, 1).translate(CX, 0.17, FZ - 1.15), 0.5));
    // torre del homenaje
    const keep = new THREE.CylinderGeometry(1.12, 1.18, 2.6, segs(24, 18, 12), 1).translate(CX, 3.0 + 1.3, -1.9); scaleUV(keep, 3.5, 1.3); stone.push(keep);
    const keepTop = new THREE.CylinderGeometry(1.3, 1.16, 0.35, segs(24, 18, 12), 1).translate(CX, 5.45, -1.9); scaleUV(keepTop, 4, 0.2); stone.push(keepTop);
    // torres laterales
    for (const tx of [CX - 2.45, CX + 2.45]) {
      const tw = new THREE.CylinderGeometry(0.7, 0.76, 4.5, segs(20, 16, 10), 1).translate(tx, 2.25, -1.35); scaleUV(tw, 2.2, 2.2); stone.push(tw);
      const top = new THREE.CylinderGeometry(0.86, 0.72, 0.32, segs(20, 16, 10), 1).translate(tx, 4.62, -1.35); scaleUV(top, 2.6, 0.2); stone.push(top);
    }
    // arco de la puerta (anillo extruido)
    const arch = new THREE.Shape();
    arch.moveTo(-0.95, 0); arch.lineTo(-0.95, 1.55); arch.absarc(0, 1.55, 0.95, Math.PI, 0, true); arch.lineTo(0.95, 0); arch.lineTo(-0.95, 0);
    const hole = new THREE.Path(); hole.moveTo(-0.62, 0); hole.lineTo(-0.62, 1.48); hole.absarc(0, 1.48, 0.62, Math.PI, 0, true); hole.lineTo(0.62, 0); hole.lineTo(-0.62, 0);
    arch.holes.push(hole);
    const archG = new THREE.ExtrudeGeometry(arch, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16 });
    archG.translate(CX, 0, FZ - 0.08); boxUV(archG, 0.9); stone.push(archG);
    const stoneG = merge(stone);

    // interior de la puerta (resplandor cálido)
    const door = new THREE.Shape();
    door.moveTo(-0.62, 0); door.lineTo(-0.62, 1.48); door.absarc(0, 1.48, 0.62, Math.PI, 0, true); door.lineTo(0.62, 0); door.closePath();
    const doorIn = new THREE.ShapeGeometry(door, 12); doorIn.translate(CX, 0, FZ + 0.012);
    { const p = doorIn.attributes.position, uv = doorIn.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - CX + 0.62) / 1.24, p.getY(i) / 2.1); }
    // hojas de la puerta abiertas
    const leafW = merge([-1, 1].map((sx) => {
      const b = roundedBox(0.6, 1.9, 0.08, 0.02, 1); b.translate(sx * 0.3, 0.95, 0); b.rotateY(sx * -1.1); b.translate(CX + sx * 0.62, 0, FZ - 0.02);
      return b;
    }));
    boxUV(leafW, 1.2);
    // ventanas (arcos emisivos) + marcos
    const win = [], frames = [];
    const addWin = (x, y, z, ww, hh, ry = 0) => {
      const s = new THREE.Shape(); s.moveTo(-ww / 2, 0); s.lineTo(-ww / 2, hh - ww / 2); s.absarc(0, hh - ww / 2, ww / 2, Math.PI, 0, true); s.lineTo(ww / 2, 0); s.closePath();
      const g = new THREE.ShapeGeometry(s, 8); { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + ww / 2) / ww, uv.getY(i) / hh); } g.translate(0, 0, 0.03); g.rotateY(ry); g.translate(x, y, z); win.push(g);
      const f = new THREE.Shape(); const W = ww + 0.14, H = hh + 0.08; f.moveTo(-W / 2, -0.06); f.lineTo(-W / 2, H - W / 2); f.absarc(0, H - W / 2, W / 2, Math.PI, 0, true); f.lineTo(W / 2, -0.06); f.closePath();
      const fg = new THREE.ExtrudeGeometry(f, { depth: 0.04, bevelEnabled: false, curveSegments: 8 }); fg.translate(0, 0, -0.035); fg.rotateY(ry); fg.translate(x, y, z); frames.push(fg);
      // alféizar
      const sill = roundedBox(ww + 0.24, 0.07, 0.14, 0.02, 1); sill.rotateY(ry); sill.translate(x, y - 0.06, z + 0.03); frames.push(sill);
    };
    addWin(CX - 0.38, 3.95, -1.9 + 1.13, 0.34, 0.72); addWin(CX + 0.38, 3.95, -1.9 + 1.13, 0.34, 0.72);
    for (const tx of [CX - 2.45, CX + 2.45]) { addWin(tx, 2.7, -1.35 + 0.735, 0.3, 0.6); addWin(tx, 1.2, -1.35 + 0.745, 0.26, 0.5); }
    addWin(CX - 1.4, 1.85, FZ + 0.005, 0.32, 0.62); addWin(CX + 1.4, 1.85, FZ + 0.005, 0.32, 0.62);
    const winG = merge(win), frameG = merge(frames);
    // tejados cónicos
    const roofs = [];
    const keepRoof = new THREE.ConeGeometry(1.48, 2.3, segs(24, 18, 12), 3, true).translate(CX, 5.62 + 1.15, -1.9); scaleUV(keepRoof, 6, 2.4); roofs.push(keepRoof);
    for (const tx of [CX - 2.45, CX + 2.45]) { const r = new THREE.ConeGeometry(0.98, 1.8, segs(20, 16, 10), 3, true).translate(tx, 4.78 + 0.9, -1.35); scaleUV(r, 4, 1.8); roofs.push(r); }
    const roofG = merge(roofs);
    // remates dorados + mástiles de banderitas
    const gl = [];
    const tops = [[CX, 7.92, -1.9, 0.6], [CX - 2.45, 6.58, -1.35, 0.45], [CX + 2.45, 6.58, -1.35, 0.45]];
    for (const [x, y, z, hgt] of tops) {
      gl.push(new THREE.SphereGeometry(0.08, 10, 8).translate(x, y, z));
      gl.push(new THREE.CylinderGeometry(0.025, 0.025, hgt, 6).translate(x, y + hgt / 2, z));
      gl.push(new THREE.ConeGeometry(0.05, 0.12, 8).translate(x, y + hgt + 0.06, z));
    }
    // aros de los tejados
    gl.push(new THREE.TorusGeometry(1.46, 0.04, 6, segs(32, 24, 16)).rotateX(Math.PI / 2).translate(CX, 5.64, -1.9));
    for (const tx of [CX - 2.45, CX + 2.45]) gl.push(new THREE.TorusGeometry(0.96, 0.035, 6, segs(28, 20, 14)).rotateX(Math.PI / 2).translate(tx, 4.8, -1.35));
    // apliques de antorchas
    for (const sx of [-1, 1]) gl.push(roundedBox(0.1, 0.32, 0.12, 0.02, 1).translate(CX + sx * 1.15, 1.6, FZ + 0.06), new THREE.CylinderGeometry(0.09, 0.05, 0.12, 8).translate(CX + sx * 1.15, 1.82, FZ + 0.12));
    const goldG = merge(gl);
    // estandartes verticales colgando a los lados de la puerta
    const vb = new THREE.PlaneGeometry(0.62, 1.25, 1, 1);
    const vbanners = merge([vb.clone().translate(CX - 2.45 + 0, 3.45, -1.35 + 0.79), vb.clone().translate(CX + 2.45, 3.45, -1.35 + 0.79)]);
    [pole, gold, pedestal, finial, ringClip, stoneG, doorIn, leafW, winG, frameG, roofG, goldG, vbanners].forEach((g) => (g.userData.shared = true));

    const roofTex = tex('roof', 256, 256, (g, w, h) => {
      g.fillStyle = '#7a1420'; g.fillRect(0, 0, w, h);
      const rows = 10, cols = 12;
      for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) {
        const sw = w / cols, sh = h / rows, x = c * sw + (r % 2) * sw / 2, y = r * sh;
        const l = 0.85 + rnd() * 0.3;
        const gr = g.createLinearGradient(0, y, 0, y + sh * 1.2);
        gr.addColorStop(0, `rgb(${120 * l | 0},${22 * l | 0},${30 * l | 0})`); gr.addColorStop(0.6, `rgb(${214 * l | 0},${58 * l | 0},${52 * l | 0})`); gr.addColorStop(1, `rgb(${236 * l | 0},${96 * l | 0},${70 * l | 0})`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - sw / 2, y); g.lineTo(x - sw / 2, y + sh * 0.6); g.quadraticCurveTo(x, y + sh * 1.25, x + sw / 2, y + sh * 0.6); g.lineTo(x + sw / 2, y); g.fill();
        g.strokeStyle = 'rgba(50,5,10,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - sw / 2, y + sh * 0.6); g.quadraticCurveTo(x, y + sh * 1.25, x + sw / 2, y + sh * 0.6); g.stroke();
      }
      noiseFill(g, w, h, 12, 1);
    });
    const doorTex = tex('doorGlow', 64, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ffb050'); gr.addColorStop(0.18, '#a04818'); gr.addColorStop(0.55, '#3a140a'); gr.addColorStop(1, '#140604');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { repeat: false });
    const winTex = tex('winGlow', 64, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.6, 4, w / 2, h * 0.5, h * 0.6); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.5, '#ffb84a'); gr.addColorStop(1, '#c0501a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a2410'; g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h * 0.55, w, 4);
    }, { repeat: false });
    return {
      pole, gold, pedestal, finial, ringClip, stoneG, doorIn, leafW, winG, frameG, roofG, goldG, vbanners,
      poleMat: mat('poleSilver', { physical: true, color: 0xf2f4f8, metalness: 0.85, roughness: 0.18, clearcoat: 0.5, env: 1.3 }),
      goldMat: mat('goalGold', { physical: true, color: 0xffc23a, metalness: 1, roughness: 0.22, env: 1.35, emissive: 0x6a3a00, emissiveIntensity: 0.2 }),
      stoneMat: mat('stone', { map: stoneTex(), bumpMap: stoneTex(true), bumpScale: 2.5, roughness: 0.9 }),
      trimMat: mat('stoneTrim', { color: 0x6a5e52, roughness: 0.8 }),
      finialMat: mat('finialCrystal', { physical: true, color: 0xfff0a0, emissive: 0xffc030, emissiveIntensity: 1.2, flatShading: true, metalness: 0.3, roughness: 0.08, clearcoat: 1, env: 1.2 }),
      roofMat: mat('roof', { map: roofTex, bumpMap: roofTex, bumpScale: 1.5, roughness: 0.6, side: THREE.DoubleSide }),
      doorMat: mat('doorGlow', { map: doorTex, emissive: 0xffffff, emissiveMap: doorTex, emissiveIntensity: 0.9, roughness: 1 }),
      winMat: mat('winGlow', { map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 2.0, roughness: 1 }),
      woodMat: mat('wood', { map: woodTex(), bumpMap: woodTex(), bumpScale: 1.2, roughness: 0.7, rim: [0xffe0b0, 0.15, 3] }),
      bannerMat: fabricMat('goalBanner', bannerTex('goalBanner', 512, 352, { notch: 'left' })),
      vbannerMat: fabricMat('vBanner', bannerTex('vBanner', 256, 512, { notch: 'bottom', bg0: '#c8323a', bg1: '#7a1420' })),
      pennantMat: mat('pennant', { color: 0xffb020, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x802000, emissiveIntensity: 0.25 }),
    };
  });
}

/** Meta: mástil (10 casillas de alto) + estandarte + torre/castillo a +7 casillas. s = { flagY (0..1, 1=arriba), time, raised(bool) } */
export function createGoalModel() {
  const R = goalRes();
  const root = new THREE.Group();
  root.add(mesh(R.pole, R.poleMat), mesh(R.gold, R.goldMat, false), mesh(R.pedestal, R.stoneMat, true, true));
  const finial = mesh(R.finial, R.finialMat, false); finial.position.y = 10.42; root.add(finial);
  const fGlow = glowSprite('finialGlow', 0xffd060, 1.6, 0.75); fGlow.position.y = 10.42; root.add(fGlow);
  const fSpark = glowSprite('finialSpark', 0xffffff, 0.9, 1, sparkleTex()); fSpark.position.set(0, 10.42, 0.1); root.add(fSpark);
  // estandarte
  const flagG = group(); root.add(flagG);
  const cloth = makeCloth(1.6, 1.1, isLow() ? 10 : 18, isLow() ? 6 : 10, R.bannerMat, true);
  cloth.mesh.position.x = -0.07; flagG.add(cloth.mesh);
  for (const y of [0.42, -0.42]) { const c = mesh(R.ringClip, R.goldMat, false); c.position.y = y; flagG.add(c); }
  // fortaleza
  const castle = group(); root.add(castle);
  castle.add(mesh(R.stoneG, R.stoneMat, true, true), mesh(R.roofG, R.roofMat, true, true), mesh(R.frameG, R.trimMat, false),
    mesh(R.winG, R.winMat, false), mesh(R.doorIn, R.doorMat, false), mesh(R.leafW, R.woodMat, false), mesh(R.goldG, R.goldMat, false), mesh(R.vbanners, R.vbannerMat, false));
  // banderitas en los remates
  const pennants = [];
  for (const [x, y, z, hgt] of [[7, 7.92, -1.9, 0.6], [4.55, 6.58, -1.35, 0.45], [9.45, 6.58, -1.35, 0.45]]) {
    const pc = makeCloth(0.7, 0.32, 8, 3, R.pennantMat, false);
    const ps = pc.mesh.geometry.attributes.position; // triangular: estrechar hacia la punta
    const b = ps.array; for (let i = 0; i < ps.count; i++) { const u = b[i * 3] / 0.7; b[i * 3 + 1] *= (1 - u * 0.92); }
    pc.mesh.position.set(x + 0.02, y + hgt - 0.14, z);
    pc.base = Float32Array.from(b);
    castle.add(pc.mesh); pennants.push(pc);
  }
  // re-basar las banderitas triangulares (makeCloth guardó la forma rectangular)
  pennants.forEach((pc) => { const g = pc.mesh.geometry; const p = g.attributes.position; const base = pc.base; pc.update = (t) => { for (let i = 0; i < p.count; i++) { const x0 = base[i * 3], y0 = base[i * 3 + 1]; const u = x0 / 0.7; p.setXYZ(i, x0, y0 - u * 0.03, Math.sin(u * 6 - t * 7 + y0) * 0.07 * u); } p.needsUpdate = true; g.computeVertexNormals(); }; });
  const torches = [-1, 1].map((sx) => { const s = glowSprite('torch', 0xff9a30, 0.7, 0.9); s.position.set(7 + sx * 1.15, 1.98, -0.42); castle.add(s); return s; });
  const doorGlow = glowSprite('doorGlowS', 0xffa040, 2.2, 0.35); doorGlow.position.set(7, 0.9, -0.5); castle.add(doorGlow);
  return {
    root,
    update(dt, s) {
      const t = s.time;
      flagG.position.y = 1.15 + s.flagY * 8.15;
      cloth.update(t, s.raised ? 1 : 0.75, 1);
      finial.rotation.y = t * 1.2;
      fGlow.scale.setScalar(1.5 + Math.sin(t * 3) * 0.15);
      const g = t % 2.4, k = g < 0.4 ? Math.sin(g / 0.4 * Math.PI) : 0;
      fSpark.scale.setScalar(0.3 + k * 1.1);
      if (!isLow() || ((t * 30) | 0) % 2) pennants.forEach((p, i) => p.update(t + i * 0.7));
      torches.forEach((tc, i) => tc.scale.setScalar(0.6 + Math.sin(t * 13 + i * 3) * 0.06 + Math.sin(t * 29 + i) * 0.04));
    },
  };
}

// =====================================================================================
// PUNTO DE CONTROL
// =====================================================================================
function checkpointRes() {
  return cached('res:checkpoint', () => {
    const n = segs(12, 10, 8);
    const post = merge([
      new THREE.CylinderGeometry(0.055, 0.07, 1.62, n).translate(0, 0.95, 0),
      new THREE.CylinderGeometry(0.2, 0.26, 0.16, n).translate(0, 0.08, 0),
      new THREE.CylinderGeometry(0.13, 0.17, 0.12, n).translate(0, 0.2, 0),
    ]);
    const metal = [];
    for (const y of [0.32, 0.9, 1.5]) metal.push(new THREE.TorusGeometry(0.068, 0.018, 6, n).rotateX(Math.PI / 2).translate(0, y, 0));
    // brazo del banderín + jaula del farol
    metal.push(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6).rotateZ(Math.PI / 2).translate(0.3, 1.62, 0));
    metal.push(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 8).translate(0, 1.79, 0));
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; metal.push(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 4).translate(Math.cos(a) * 0.1, 1.94, Math.sin(a) * 0.1)); }
    metal.push(new THREE.ConeGeometry(0.15, 0.13, 8).translate(0, 2.13, 0));
    metal.push(new THREE.SphereGeometry(0.035, 8, 6).translate(0, 2.22, 0));
    const metalG = merge(metal);
    const glass = new THREE.CylinderGeometry(0.085, 0.085, 0.24, 8).translate(0, 1.94, 0);
    [post, metalG, glass].forEach((g) => (g.userData.shared = true));
    return {
      post, metalG, glass,
      woodMat: mat('wood', { map: woodTex(), bumpMap: woodTex(), bumpScale: 1.2, roughness: 0.7, rim: [0xffe0b0, 0.15, 3] }),
      metalMat: mat('brass', { color: 0xc89a48, metalness: 0.9, roughness: 0.32, env: 1.1 }),
      glassOff: mat('lanternOff', { physical: true, color: 0x8aa0b8, roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1, env: 1 }),
      glassOn: mat('lanternOn', { color: 0xfff0b0, emissive: 0xffb040, emissiveIntensity: 2.2, roughness: 0.3 }),
      flagOff: fabricMat('cpFlagOff', bannerTex('cpFlagOff', 256, 192, { notch: 'left', bg0: '#8a96a8', bg1: '#5a6478', grey: true })),
      flagOn: fabricMat('cpFlagOn', bannerTex('cpFlagOn', 256, 192, { notch: 'left', bg0: '#ff9a2a', bg1: '#d0501a' })),
    };
  });
}

/** Banderín de punto de control. s = { active(bool), time } */
export function createCheckpointModel() {
  const R = checkpointRes();
  const root = new THREE.Group();
  root.add(mesh(R.post, R.woodMat, true, true), mesh(R.metalG, R.metalMat));
  const glass = mesh(R.glass, R.glassOff, false); root.add(glass);
  const cloth = makeCloth(0.56, 0.4, 8, 5, R.flagOff, false);
  // cuelga del brazo hacia la derecha (+x); la tela se ancla en x=0 (izquierda)
  cloth.mesh.position.set(0.04, 1.4, 0);
  const flagPivot = group(cloth.mesh); root.add(flagPivot);
  const glow = glowSprite('cpGlow', 0xffb040, 1.0, 0.85); glow.position.y = 1.94; glow.visible = false; root.add(glow);
  const flame = glowSprite('cpFlame', 0xfff0c0, 0.25, 1); flame.position.y = 1.93; flame.visible = false; root.add(flame);
  const st = { on: false, t: 0 };
  return {
    root,
    update(dt, s) {
      const t = s.time;
      if (s.active && !st.on) { st.on = true; st.t = 0; glass.material = R.glassOn; cloth.mesh.material = R.flagOn; glow.visible = flame.visible = true; }
      if (!s.active && st.on) { st.on = false; glass.material = R.glassOff; cloth.mesh.material = R.flagOff; glow.visible = flame.visible = false; }
      st.t += dt;
      if (st.on) {
        const pop = st.t < 0.6 ? 1 + Math.sin(st.t / 0.6 * Math.PI) * 0.6 * (1 - st.t / 0.6) : 1;
        glow.scale.setScalar((0.95 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04) * pop * 1.1);
        flame.scale.setScalar(0.24 + Math.sin(t * 17) * 0.03);
        cloth.mesh.position.y = 1.4 + Math.min(1, st.t * 3) * 0.0;
        cloth.update(t, 1, 1);
      } else {
        cloth.update(t * 0.5, 0.35, 0.6);
      }
      // la tela cuelga del brazo (anclada arriba-izquierda girada)
      flagPivot.position.set(0, 0, 0);
    },
  };
}

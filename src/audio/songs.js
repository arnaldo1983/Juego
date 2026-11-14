// Composiciones originales. Notación por semicorcheas (16 pasos por compás):
//   nota (C5, F#4, Bb3) = ataque · '-' = prolonga · '.' = silencio · '|' = separador visual.
// Acordes: uno por compás, o varios separados por espacio (se reparten el compás).
// Patrones de bajo: R raíz · 5 quinta · 3 tercera · O octava · '-' prolonga · '.' silencio.
// Arpegio: dígitos = índice en las notas del acorde (pasa a la octava siguiente) · '.' silencio.
// Batería: x golpe · X acento · s suave · o hi-hat abierto.
// order: secciones; 'A*' = variación (2ª voz en terceras, arpegio y percusión extra).

export const SONGS = {
  // ─────────────── TÍTULO · Re mayor, épico y alegre ───────────────
  title: {
    bpm: 118, loop: true,
    inst: { lead: 'brass', pad: 'pad', bass: 'bass', arp: 'pluck' },
    arpWhen: 'always', arpPat: '0.1.2.1.3.1.2.1.',
    bassPat: 'R--RR-5-R--R5-O-',
    drums: { k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.' },
    drumsVar: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    fill: 'toms', crash: true, delay: 3,
    mix: { lead: [1, 0, 0.32, 0.12], harm: [0.55, -0.25, 0.4], pad: [0.9, 0.2, 0.55], bass: [0.95], arp: [0.6, -0.35, 0.3, 0.2], drums: [0.9, 0, 0.12] },
    sections: {
      A: {
        ch: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'Asus4 A'],
        mel: `D5 - - - A4 - - - D5 - E5 - F#5 - - - | F#5 - - - E5 - D5 - B4 - - - - - - - |
              G4 - - - B4 - D5 - G5 - - - F#5 - E5 - | E5 - - - - - - - . . C#5 - D5 - E5 - |
              F#5 - - - D5 - - - A5 - - - F#5 - A5 - | C#6 - - - A5 - - - F#5 - - - E5 - C#5 - |
              D5 - - - G5 - - - B5 - - - A5 - G5 - | A5 - - - - - - - E5 - F#5 - G5 - A5 -`,
      },
      B: {
        ch: ['G', 'A', 'F#m', 'Bm', 'Em7', 'A', 'G A', 'D'],
        mel: `B5 - - - A5 - G5 - D5 - - - G5 - A5 - | A5 - - - E5 - - - C#5 - E5 - A5 - - - |
              A5 - - - F#5 - - - C#6 - - - A5 - - - | B5 - - - - - - - D6 - C#6 - B5 - A5 - |
              G5 - - - B5 - - - E6 - - - D6 - B5 - | C#6 - - - - - - - A5 - B5 - C#6 - E6 - |
              D6 - - - B5 - G5 - C#6 - - - E6 - - - | D6 - - - - - - - - - - - . . A4 -`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },

  // ─────────────── PRADERA · Do mayor, saltarín ───────────────
  pradera: {
    gain: 1.35, bpm: 138, loop: true,
    inst: { lead: 'lead', pad: 'stab', bass: 'bass', arp: 'marimba' },
    padPat: '..x...x...x...x.', arpWhen: 'var', arpPat: '0.2.4.2.1.2.4.2.',
    bassPat: 'R..5..R.R..5.O..',
    drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.s.x.s.x.s.x.s.' },
    drumsVar: { k: 'x.....x.x.......', s: '....x.......x..s', h: 'xsxsxsxsxsxsxsxs' },
    fill: 'snare', delay: 3,
    mix: { lead: [1, 0, 0.18, 0.1], harm: [0.5, 0.3, 0.2], pad: [0.85, -0.3, 0.2], bass: [0.9], arp: [0.55, 0.35, 0.25], drums: [0.85, 0, 0.08] },
    sections: {
      A: {
        ch: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm7 G7', 'C'],
        mel: `E5 - . G5 - . C6 - - - B5 - G5 - - . | A5 - - . E5 - . C5 - - - D5 - E5 - . |
              F5 - . A5 - . C6 - - - A5 - F5 - G5 - | G5 - - - - - . . D5 - E5 - F5 - G5 - |
              E5 - . G5 - . C6 - - - D6 - E6 - - . | C6 - - . A5 - . E5 - - - G5 - A5 - . |
              F5 - A5 - D6 - C6 - B5 - G5 - F5 - D5 - | C5 - - - E5 - G5 - C6 - - - - - . .`,
      },
      B: {
        ch: ['F', 'G', 'Em', 'Am', 'Dm7', 'G7', 'Em Am', 'Dm7 G7'],
        mel: `A4 - C5 - F5 - - - E5 - F5 - A5 - - - | G5 - - - D5 - - - B4 - D5 - G5 - - - |
              G5 - E5 - B4 - E5 - G5 - - - B5 - - - | A5 - - - - - G5 - E5 - - - C5 - - - |
              D5 - F5 - A5 - - - C6 - - - A5 - F5 - | G5 - - - B5 - - - D6 - - - F5 - - - |
              E5 - G5 - B5 - G5 - A5 - C6 - E6 - C6 - | D6 - - - C6 - A5 - B5 - - - G5 - - -`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },

  // ─────────────── CUEVA · La menor, misterioso con eco ───────────────
  cueva: {
    bpm: 92, loop: true,
    inst: { lead: 'marimba', pad: 'air', bass: 'sub', arp: 'bell' },
    arpWhen: 'var', arpPat: '0..1..2..1..0...', arpOct: 72,
    bassPat: 'R-------.....5--',
    drums: { k: 'x.........x.....', r: '....x.......x...', sh: '..s...s...s...s.' },
    drumsVar: { k: 'x.........x.....', r: '....x.......x.x.', sh: 's.s.s.s.s.s.s.s.' },
    fill: null, delay: 3, delayFb: 0.5,
    mix: { lead: [1, 0.1, 0.5, 0.45], harm: [0.5, -0.4, 0.5, 0.3], pad: [1, 0, 0.7], bass: [0.9, 0, 0.1], arp: [0.4, -0.3, 0.6, 0.4], drums: [0.75, 0, 0.35, 0.15] },
    sections: {
      A: {
        ch: ['Am', 'Fmaj7', 'Dm', 'E', 'Am', 'Fmaj7', 'Bb', 'E'],
        mel: `A4 . . C5 . . E5 . . . . . D5 . C5 . | E5 - - - - - . . . . . . A4 . C5 . |
              D5 . . F5 . . A5 . . . . . G5 . F5 . | E5 - - - - - . . G#4 . B4 . . . . . |
              A5 . . E5 . . C5 . . . . . B4 . C5 . | A4 - - - - - . . . . . . C5 . E5 . |
              F5 . . D5 . . Bb4 . . . . . A4 . Bb4 . | B4 - - - - - - - G#4 - - - E4 - - -`,
      },
      B: {
        ch: ['Dm', 'Am', 'Dm', 'E', 'F', 'C', 'Bb', 'Esus4 E'],
        mel: `F5 - - - E5 - D5 - A5 - - - - - . . | E5 - - - C5 - - - A4 - - - - - . . |
              F5 - - - G5 - A5 - D6 - - - C6 - A5 - | B5 - - - - - - - G#5 - - - E5 - - - |
              A5 - - - G5 - F5 - C5 - - - - - . . | E5 - - - D5 - C5 - G4 - - - - - . . |
              D5 - - - F5 - - - Bb5 - - - A5 - F5 - | A5 - - - - - - - G#5 - - - - - - -`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },

  // ─────────────── CIELO · Fa mayor (toque lidio), etéreo ───────────────
  cielo: {
    bpm: 100, loop: true,
    inst: { lead: 'bell', pad: 'air', bass: 'sub', arp: 'harp' },
    arpWhen: 'always', arpPat: '0123432101234321',
    bassPat: 'R-------5-------',
    drums: { k: 'x.........x.....', h: '....s.......s...' },
    drumsVar: { k: 'x.........x.....', s: '............s...', h: '..s...s...s...s.' },
    fill: null, delay: 6, delayFb: 0.32,
    mix: { lead: [1, 0, 0.5, 0.3], harm: [0.5, 0.35, 0.55, 0.2], pad: [1, 0, 0.6], bass: [0.8], arp: [0.5, -0.3, 0.45, 0.1], drums: [0.6, 0, 0.25] },
    sections: {
      A: {
        ch: ['Fmaj7', 'G', 'Em7', 'Am7', 'Dm7', 'Bbmaj7', 'Gm7', 'C'],
        mel: `C6 - - - - - - - A5 - - - E5 - - - | D6 - - - - - - - B5 - - - G5 - - - |
              G5 - - - B5 - - - D6 - - - E6 - - - | C6 - - - - - - - - - - - . . . . |
              A5 - - - - - - - F5 - - - C6 - - - | D6 - - - - - - - A5 - - - F5 - - - |
              Bb5 - - - A5 - - - G5 - - - F5 - - - | E5 - - - - - - - - - - - G5 - - -`,
      },
      B: {
        ch: ['Bbmaj7', 'C', 'Am7', 'Dm7', 'Gm7', 'C', 'Fmaj7', 'C'],
        mel: `F5 - - - A5 - - - D6 - - - C6 - - - | E6 - - - - - - - G5 - - - C6 - - - |
              C6 - - - A5 - - - E5 - - - G5 - - - | F5 - - - - - - - A5 - - - D6 - - - |
              D6 - - - - - - - Bb5 - - - G5 - - - | E5 - - - G5 - - - C6 - - - E6 - - - |
              E6 - - - - - - - C6 - - - A5 - - - | G5 - - - - - - - - - - - . . . .`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },

  // ─────────────── CASTILLO · Re menor armónico, tenso ───────────────
  castillo: {
    gain: 1.15, bpm: 132, loop: true,
    inst: { lead: 'brass', pad: 'pad', bass: 'bass', arp: 'pluck' },
    arpWhen: 'var', arpPat: '0.2.1.2.0.2.1.2.', arpOct: 62,
    bassPat: 'R.R.R.R.R.R.O.5.',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    drumsVar: { k: 'x...x...x...x.x.', s: '....x.......x..s', h: 'x.x.x.x.x.x.x.x.' },
    fill: 'toms', crash: true, delay: 3,
    mix: { lead: [1, 0, 0.3, 0.08], harm: [0.5, -0.3, 0.35], pad: [0.85, 0.25, 0.5], bass: [1], arp: [0.5, 0.35, 0.3], drums: [0.9, 0, 0.15] },
    sections: {
      A: {
        ch: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm A7', 'Dm'],
        mel: `D5 - . D5 . F5 . A5 - - - G5 - F5 - . | F5 - . F5 . D5 . Bb4 - - - C5 - D5 - . |
              G5 - . G5 . Bb5 . D6 - - - C6 - Bb5 - . | A5 - - - - - . . C#5 - E5 - A5 - G5 - |
              F5 - . F5 . A5 . D6 - - - C6 - A5 - . | Bb5 - . Bb5 . A5 . F5 - - - G5 - A5 - . |
              G5 - Bb5 - D6 - Bb5 - A5 - C#6 - E6 - C#6 - | D6 - - - - - . . A5 . F5 . D5 . . .`,
      },
      B: {
        ch: ['Gm', 'Dm', 'Eb', 'A', 'Gm', 'Dm', 'Bb A7', 'A7'],
        mel: `Bb4 - - - D5 - - - G5 - - - A5 - Bb5 - | A5 - - - F5 - - - D5 - - - . . . . |
              G5 - - - Bb5 - - - Eb6 - - - D6 - Bb5 - | C#6 - - - - - - - A5 - - - E5 - - - |
              D6 - . D6 . C6 . Bb5 - - - A5 - G5 - . | F5 - . F5 . E5 . D5 - - - E5 - F5 - . |
              G5 - F5 - D5 - Bb4 - C#5 - E5 - G5 - A5 - | A5 - - - - - - - - - - - . . . .`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },

  // ─────────────── ESTRELLA · Mi mayor, rápido y eufórico ───────────────
  star: {
    gain: 1.1, bpm: 168, loop: true,
    inst: { lead: 'bright', pad: 'pad', bass: 'bass', arp: 'pluck' },
    arpWhen: 'always', arpPat: '0123012301230123', arpOct: 64,
    bassPat: 'R.O.R.O.R.O.R.O.',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..o...o...o...o.' },
    drumsVar: { k: 'x...x...x...x...', s: '....x.......x.ss', h: 'xsxsxsxsxsxsxsxs', o: '..o...o...o...o.' },
    fill: 'snare', crash: true, delay: 3,
    mix: { lead: [1, 0, 0.2, 0.1], harm: [0.5, 0.3, 0.25], pad: [0.7, -0.2, 0.4], bass: [0.95], arp: [0.4, -0.4, 0.2], drums: [0.85, 0, 0.08] },
    sections: {
      A: {
        ch: ['E', 'B', 'C#m', 'A', 'E', 'B', 'A', 'B'],
        mel: `E5 - G#5 - B5 - E6 - . . B5 - G#5 - B5 - | D#6 - - - B5 - F#5 - . . F#5 - B5 - D#6 - |
              E6 - - - C#6 - G#5 - . . G#5 - C#6 - E6 - | C#6 - - - B5 - A5 - E5 - - - F#5 - G#5 - |
              B5 - E6 - B5 - G#5 - E5 - G#5 - B5 - E6 - | F#6 - - - D#6 - B5 - F#5 - B5 - D#6 - F#6 - |
              E6 - C#6 - A5 - C#6 - E6 - - - C#6 - - - | D#6 - - - - - - - F#6 - - - - - - -`,
      },
      B: {
        ch: ['A', 'B', 'G#m', 'C#m', 'F#m', 'B7', 'A B', 'E'],
        mel: `C#6 - - - A5 - C#6 - E6 - - - A5 - - - | D#6 - - - B5 - D#6 - F#6 - - - B5 - - - |
              D#6 - - - B5 - G#5 - B5 - D#6 - G#6 - - - | E6 - - - - - - - C#6 - - - G#5 - - - |
              A5 - C#6 - F#6 - C#6 - A5 - C#6 - E6 - C#6 - | D#6 - - - B5 - F#5 - A5 - B5 - D#6 - F#6 - |
              E6 - C#6 - A5 - - - F#6 - D#6 - B5 - - - | E6 - - - - - - - B5 - G#5 - E5 - - -`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },

  // ─────────────── NIVEL SUPERADO · fanfarria corta (bVI–bVII–I) ───────────────
  clear: {
    gain: 1.1, bpm: 126, loop: false, tail: 2.5,
    inst: { lead: 'brass', pad: 'pad', bass: 'bass' },
    bassPat: 'R---------------', harmAlways: true, crash: false,
    mix: { lead: [1.1, 0, 0.35], harm: [0.6, -0.25, 0.4], pad: [0.9, 0.2, 0.5], bass: [0.9], drums: [0.9, 0, 0.2] },
    sections: {
      A: {
        ch: ['C', 'Ab Bb', 'C', 'C'],
        mel: `G4 - C5 - E5 - G5 - - - E5 - G5 - - - | Ab5 - C6 - Eb6 - - - Bb5 - D6 - F6 - - - |
              E6 - - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . .`,
        drums: [
          { k: 'x.......x.......' },
          { k: 'x...x...x...x...', s: '........ssssxxxX' },
          { k: 'X...............', c: 'x...............' },
          {},
        ],
        bassPat: ['R---------------', 'R-------R-------', 'R---------------', '................'],
      },
    },
    order: ['A'],
  },

  // ─────────────── FIN DE PARTIDA · corto y triste ───────────────
  gameover: {
    bpm: 76, loop: false, tail: 3,
    inst: { lead: 'flute', pad: 'air', bass: 'sub' },
    bassPat: 'R---------------',
    mix: { lead: [1, 0, 0.5, 0.2], pad: [1, 0, 0.6], bass: [0.8] },
    sections: {
      A: {
        ch: ['Am', 'F', 'Dm', 'E Am'],
        mel: `E5 - - - C5 - - - A4 - - - - - - - | F5 - - - E5 - - - C5 - - - - - - - |
              D5 - - - C5 - - - A4 - - - - - - - | G#4 - - - B4 - - - A4 - - - - - - -`,
        bassPat: ['R---------------', 'R---------------', 'R---------------', 'R-------R-------'],
      },
    },
    order: ['A'],
  },

  // ─────────────── VICTORIA FINAL · Sol mayor, himno ───────────────
  victory: {
    bpm: 112, loop: true,
    inst: { lead: 'brass', pad: 'pad', bass: 'bass', arp: 'harp' },
    arpWhen: 'always', arpPat: '0.1.2.1.0.1.2.1.',
    bassPat: 'R---R-5-R---5-O-',
    drums: { k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.' },
    drumsVar: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    fill: 'toms', crash: true, delay: 3,
    mix: { lead: [1, 0, 0.35, 0.1], harm: [0.55, -0.3, 0.4], pad: [0.9, 0.25, 0.55], bass: [0.95], arp: [0.55, -0.35, 0.4], drums: [0.85, 0, 0.14] },
    sections: {
      A: {
        ch: ['G', 'D/F#', 'Em', 'C', 'G', 'D7', 'C D', 'G'],
        mel: `B4 - - - D5 - G5 - - - - - F#5 - G5 - | A5 - - - F#5 - D5 - - - - - E5 - F#5 - |
              G5 - - - B5 - - - A5 - G5 - F#5 - E5 - | E5 - - - - - - - . . C5 - D5 - E5 - |
              D5 - - - G5 - - - B5 - - - A5 - G5 - | F#5 - - - A5 - - - D6 - - - C6 - A5 - |
              G5 - E5 - C6 - - - A5 - F#5 - D6 - - - | B5 - - - - - - - G5 - - - - - . .`,
      },
      B: {
        ch: ['C', 'D', 'Bm', 'Em', 'Am7', 'D', 'C D', 'G'],
        mel: `E6 - - - D6 - C6 - G5 - - - C6 - - - | D6 - - - C6 - A5 - F#5 - - - A5 - - - |
              B5 - - - D6 - - - F#6 - - - D6 - - - | E6 - - - - - - - B5 - - - G5 - - - |
              C6 - - - B5 - A5 - E5 - - - G5 - A5 - | F#5 - - - A5 - - - D6 - - - E6 - F#6 - |
              G6 - - - E6 - C6 - F#6 - - - D6 - A5 - | G6 - - - - - - - - - - - . . . .`,
      },
    },
    order: ['A', 'B', 'A*', 'B*'],
  },
};

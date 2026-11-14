// Iconos SVG inline (sin assets externos). Cada función devuelve un string SVG.
let uid = 0;
const id = (p) => `${p}${++uid}`;

/** Moneda estelar dorada con estrella en relieve. */
export function coinIcon(cls = 'ico') {
  const g = id('cg'), s = id('cs');
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">
<defs>
<radialGradient id="${g}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".35" stop-color="#ffd23f"/><stop offset=".8" stop-color="#e79a0c"/><stop offset="1" stop-color="#a85b00"/></radialGradient>
<linearGradient id="${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#ffc21a"/></linearGradient>
</defs>
<circle cx="24" cy="25.5" r="20" fill="#7a3d00" opacity=".55"/>
<circle cx="24" cy="24" r="20" fill="url(#${g})" stroke="#8a4a00" stroke-width="2.2"/>
<circle cx="24" cy="24" r="15.2" fill="none" stroke="#fff3b0" stroke-width="1.4" opacity=".7"/>
<path d="M24 12.2l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8.1L24 30.7l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.1z" fill="url(#${s})" stroke="#b86a00" stroke-width="1.6" stroke-linejoin="round"/>
<ellipse cx="17" cy="14" rx="6" ry="3" fill="#fff" opacity=".55" transform="rotate(-30 17 14)"/>
</svg>`;
}

/** Cabeza de zorro (Kiko) para vidas. */
export function foxIcon(cls = 'ico') {
  const g = id('fg');
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">
<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa64a"/><stop offset="1" stop-color="#e2560e"/></linearGradient></defs>
<path d="M6 5l13 9h10l13-9-3 19c-1 10-8 17-15 18-7-1-14-8-15-18z" fill="#6b2400" opacity=".45" transform="translate(0 1.6)"/>
<path d="M6 5l13 9h10l13-9-3 19c-1 10-8 17-15 18-7-1-14-8-15-18z" fill="url(#${g})" stroke="#7a2a00" stroke-width="2" stroke-linejoin="round"/>
<path d="M9.5 9.5l6.5 5-5.6 4.4zM38.5 9.5l-6.5 5 5.6 4.4z" fill="#3b1606" opacity=".75"/>
<path d="M10 27c4-1 8 1 10 5 1.4 3 2.6 6 4 9.6 1.4-3.6 2.6-6.6 4-9.6 2-4 6-6 10-5-2 8-7 14-14 15-7-1-12-7-14-15z" fill="#fff8ee"/>
<ellipse cx="17.5" cy="24.5" rx="2.4" ry="3.1" fill="#1a0d06"/><ellipse cx="30.5" cy="24.5" rx="2.4" ry="3.1" fill="#1a0d06"/>
<circle cx="18.3" cy="23.3" r=".9" fill="#fff"/><circle cx="31.3" cy="23.3" r=".9" fill="#fff"/>
<path d="M21.6 34.5h4.8L24 37.3z" fill="#1a0d06" stroke="#1a0d06" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M14 15.5c3-3 6-3.4 9-3" stroke="#ffd7a8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>
</svg>`;
}

/** Cronómetro. */
export function clockIcon(cls = 'ico') {
  const g = id('kg');
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">
<defs><radialGradient id="${g}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe2ff"/></radialGradient></defs>
<rect x="19.5" y="3" width="9" height="6" rx="2" fill="#5ea8ff" stroke="#123a7a" stroke-width="2"/>
<path d="M36 10.5l3.5 3.5" stroke="#123a7a" stroke-width="4" stroke-linecap="round"/>
<circle cx="24" cy="27" r="17" fill="#2f7be0" stroke="#123a7a" stroke-width="2.2"/>
<circle cx="24" cy="27" r="13" fill="url(#${g})"/>
<g stroke="#3b5c94" stroke-width="2" stroke-linecap="round"><path d="M24 16.5v2.2M24 35.3v2.2M13.5 27h2.2M32.3 27h2.2"/></g>
<path class="ico-hand" d="M24 27V19.5" stroke="#e8361f" stroke-width="2.6" stroke-linecap="round"/>
<path d="M24 27l5.5 3" stroke="#1d2f55" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="24" cy="27" r="2.2" fill="#1d2f55"/>
</svg>`;
}

/** Estrella decorativa (títulos). */
export function starIcon(cls = 'ico') {
  const g = id('sg');
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">
<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8d0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#f08a00"/></linearGradient></defs>
<path d="M24 3.5l6 12.6 13.8 1.9-10 9.7 2.4 13.8L24 34.9l-12.2 6.6 2.4-13.8-10-9.7 13.8-1.9z" fill="url(#${g})" stroke="#9a4d00" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M17 14l3-1" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
</svg>`;
}

export const pauseIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/></svg>`;
export const playIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>`;
export const soundOnIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
export const soundOffIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
export const retryIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.05-4.95" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const phoneIcon = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="15" y="5" width="18" height="38" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="37.5" r="1.8" fill="currentColor"/></svg>`;

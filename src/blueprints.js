// Original schematic line-art (not traced from any manufacturer diagram) built from
// researched reference: real disassembly order confirmed by watching a Glock 19 field
// strip video (Guncademy/Pew Pew Tactical) and the HK armorer's manual procedure for
// the MP5. Side profile, muzzle to the right, matching the 3D scene's convention.
//
// Each part is simplified geometric line art (blueprint convention) with a `step`
// matching the 3D takedown sequencing — step null means the part never separates
// (stays with the frame/receiver), consistent with the real procedure. `label` carries
// explicit {x,y} so text placement doesn't depend on guessing anchors from path data.

const GLOCK_PARTS = [
  {
    id: 'frame',
    label: 'FRAME',
    labelPos: { x: 200, y: 110 },
    step: null,
    dx: 0,
    dy: 0,
    shape: `
      <path d="M190,150 H400 V172 H300 L276,188 H236
               Q214,188 207,208 L198,262 Q196,276 208,278 H228
               Q238,278 239,266 L246,214 L268,194 H300 V172"
            fill="none" />
      <path d="M239,266 Q239,278 228,278 H208 Q196,276 198,262 L204,222
               Q232,234 239,266 Z" fill="none" opacity="0.5" />
    `,
  },
  {
    id: 'trigger',
    label: 'TRIGGER',
    labelPos: { x: 170, y: 232 },
    step: 1,
    dx: -16,
    dy: 4,
    shape: `<path d="M224,216 L230,216 L228,244 L221,244 Z" fill="none" />`,
  },
  {
    id: 'slide',
    label: 'SLIDE',
    labelPos: { x: 195, y: 95 },
    step: 3,
    dx: 40,
    dy: -95,
    shape: `
      <rect x="195" y="112" width="248" height="38" rx="3" fill="none" />
      <rect x="340" y="104" width="14" height="8" fill="none" />
      <rect x="206" y="104" width="12" height="8" fill="none" />
      <line x1="210" y1="112" x2="210" y2="150" />
      <line x1="217" y1="112" x2="217" y2="150" />
      <line x1="224" y1="112" x2="224" y2="150" />
      <line x1="231" y1="112" x2="231" y2="150" />
      <line x1="238" y1="112" x2="238" y2="150" />
    `,
  },
  {
    id: 'recoil',
    label: 'RECOIL SPRING ASSEMBLY',
    labelPos: { x: 310, y: 185 },
    step: 4,
    dx: 120,
    dy: 56,
    shape: `
      <line x1="310" y1="160" x2="400" y2="160" stroke-dasharray="4 3" />
      <circle cx="310" cy="160" r="3" fill="none" />
      <circle cx="400" cy="160" r="2" fill="none" />
    `,
  },
  {
    id: 'barrel',
    label: 'BARREL',
    labelPos: { x: 390, y: 95 },
    step: 5,
    dx: 190,
    dy: -30,
    shape: `
      <path d="M310,136 H402 Q410,136 410,144 Q410,152 402,152 H310 Z" fill="none" />
      <circle cx="406" cy="144" r="5" fill="none" />
    `,
  },
  {
    id: 'magazine',
    label: 'MAGAZINE',
    labelPos: { x: 130, y: 300 },
    step: 0,
    dx: -6,
    dy: 60,
    shape: `
      <path d="M210,262 L203,340 L225,340 L234,266 Z" fill="none" />
      <line x1="212" y1="276" x2="227" y2="276" />
      <line x1="210" y1="296" x2="224" y2="296" />
      <line x1="207" y1="316" x2="221" y2="316" />
    `,
  },
];

const MP5_PARTS = [
  {
    id: 'receiver',
    label: 'RECEIVER / BARREL (fixed)',
    labelPos: { x: 290, y: 95 },
    step: null,
    dx: 0,
    dy: 0,
    shape: `
      <rect x="230" y="118" width="230" height="34" fill="none" />
      <rect x="150" y="128" width="84" height="18" fill="none" />
      <rect x="455" y="110" width="40" height="12" fill="none" />
      <circle cx="495" cy="116" r="4" fill="none" />
      <line x1="170" y1="128" x2="170" y2="146" />
      <line x1="185" y1="128" x2="185" y2="146" />
      <line x1="200" y1="128" x2="200" y2="146" />
    `,
  },
  {
    id: 'trigger',
    label: 'TRIGGER GROUP',
    labelPos: { x: 232, y: 230 },
    step: 3,
    dx: -10,
    dy: 70,
    shape: `
      <path d="M255,152 H300 V175 Q300,190 288,192 L262,192 Q252,190 252,178 Z" fill="none" />
      <ellipse cx="276" cy="178" rx="9" ry="12" fill="none" />
    `,
  },
  {
    id: 'bolt',
    label: 'BOLT GROUP',
    labelPos: { x: 330, y: 95 },
    step: 2,
    dx: -170,
    dy: -4,
    shape: `
      <rect x="330" y="122" width="90" height="26" fill="none" />
      <rect x="320" y="128" width="14" height="10" fill="none" />
    `,
  },
  {
    id: 'stock',
    label: 'BUTTSTOCK',
    labelPos: { x: 148, y: 95 },
    step: 1,
    dx: -130,
    dy: 8,
    shape: `
      <path d="M150,130 H230 V146 H165 Q150,146 148,160 L144,190 Q143,198 150,198 H175
               Q182,198 183,190 L186,152 H150 Z" fill="none" />
    `,
  },
  {
    id: 'magazine',
    label: 'MAGAZINE',
    labelPos: { x: 215, y: 288 },
    step: 0,
    dx: 4,
    dy: 68,
    shape: `
      <path d="M268,192 L258,268 L284,268 L298,196 Z" fill="none" />
      <line x1="270" y1="206" x2="291" y2="206" />
      <line x1="267" y1="226" x2="288" y2="226" />
      <line x1="264" y1="246" x2="285" y2="246" />
    `,
  },
];

export const BLUEPRINTS = {
  glock19: {
    name: 'Glock 19',
    viewBox: '0 0 640 400',
    order: ['Magazine', 'Trigger (pressed)', 'Slide', 'Recoil Spring Assembly', 'Barrel'],
    parts: GLOCK_PARTS,
    reference: {
      image: '/reference/glock_patent_fig1-4.png',
      citation: 'US Patent 4,539,889 — Gaston Glock, "Automatic Pistol with Counteracting Spring Control Mechanism," filed 1982, granted Sep. 10, 1985. Public domain (US patent).',
    },
  },
  mp5: {
    name: 'MP5',
    viewBox: '0 0 640 360',
    order: ['Magazine', 'Buttstock', 'Bolt Group', 'Trigger Group'],
    parts: MP5_PARTS,
    reference: {
      image: '/reference/mp5_patent_breech.png',
      citation: 'US Patent 3,283,435 — Theodor Koch (Heckler & Koch GmbH), "Breech Closure," filed 1964, granted Nov. 8, 1966. Public domain (US patent). Covers the roller-delayed breech mechanism at the core of the MP5; no public-domain full-weapon exploded diagram was found, so the stock/trigger-group/magazine layout above is drawn from direct video reference of a real field strip.',
    },
  },
};

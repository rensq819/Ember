export interface StagePalette {
  glow: string;
  base: string;
  deep: string;
  label: string;
  emoji: string;
}

export const STAGE_PALETTE: Record<string, StagePalette> = {
  "fed":            { glow: '#DCC6A6', base: '#D1B894', deep: '#2A2620', label: 'Fed',            emoji: '○' },
  "early":          { glow: '#D4A48E', base: '#C89079', deep: '#2D2521', label: 'Early fast',     emoji: '◔' },
  "fat-burning":    { glow: '#C78F79', base: '#B97A63', deep: '#2E2220', label: 'Fat burning',    emoji: '◐' },
  "ketosis":        { glow: '#B090A2', base: '#9E7B8E', deep: '#27212A', label: 'Ketosis',        emoji: '◑' },
  "deep-ketosis":   { glow: '#9D93B7', base: '#8A7FA8', deep: '#22222C', label: 'Deep ketosis',   emoji: '◕' },
  "autophagy":      { glow: '#96B7A4', base: '#7FA58E', deep: '#1F2725', label: 'Autophagy',      emoji: '●' },
  "deep-autophagy": { glow: '#B8C790', base: '#A5B77A', deep: '#232721', label: 'Deep autophagy', emoji: '✦' },
};

export const STAGE_ORDER = [
  "fed", "early", "fat-burning", "ketosis", "deep-ketosis", "autophagy", "deep-autophagy",
] as const;

export const STAGE_MIN_HOURS: Record<string, number> = {
  "fed": 0, "early": 4, "fat-burning": 12, "ketosis": 18,
  "deep-ketosis": 24, "autophagy": 48, "deep-autophagy": 72,
};

export function getStageColor(key: string): StagePalette {
  return STAGE_PALETTE[key] ?? STAGE_PALETTE["fed"];
}

export function nextStage(key: string): string | null {
  const i = STAGE_ORDER.indexOf(key as typeof STAGE_ORDER[number]);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

/** helper: hex + alpha → rgba string */
export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const STAGE_COPY: Record<string, { headline: string; body: string; bullets: { tag: string; text: string }[] }> = {
  fed: {
    headline: 'Digesting. Insulin is high, nutrients absorbing.',
    body: 'The body has fuel to burn. Growth pathways are open; storage is active. Not a bad place — just not where ketosis happens.',
    bullets: [
      { tag: 'Start', text: 'Pick a protocol to light the ember.' },
      { tag: 'Tip',   text: 'Hydrate now — it makes the first hours easier.' },
    ],
  },
  early: {
    headline: 'Insulin is falling, glycogen is being drawn down.',
    body: "You're still running on stored glucose, but the switch is beginning. Liver glycogen depletes in 12–16 hours depending on activity.",
    bullets: [
      { tag: 'Why',  text: 'Insulin must fall for lipolysis to scale.' },
      { tag: 'Feel', text: 'Mild hunger waves; they pass in 20 min.' },
    ],
  },
  "fat-burning": {
    headline: 'Glycogen low. Lipolysis is accelerating.',
    body: 'Fatty acids are being mobilised from adipose tissue. The liver begins converting them into ketone bodies — β-hydroxybutyrate climbs.',
    bullets: [
      { tag: 'Rising',  text: 'β-hydroxybutyrate, fatty acid oxidation.' },
      { tag: 'Falling', text: 'Glycogen stores, insulin, blood glucose.' },
    ],
  },
  ketosis: {
    headline: 'Ketones rise above 0.5 mmol/L. The brain switches fuel.',
    body: 'Mental clarity returns after the first-day dip. Inflammation markers start to fall. GKI under 9 marks the threshold — under 6 is the sweet spot.',
    bullets: [
      { tag: 'Target', text: 'GKI 3–6 for metabolic flexibility.' },
      { tag: 'Watch',  text: 'Electrolytes — sodium especially.' },
    ],
  },
  "deep-ketosis": {
    headline: 'Strong ketone production. Mental clarity, steady energy.',
    body: 'Ketone bodies now supply up to 75% of brain energy. Autophagy is warming up in the background.',
    bullets: [
      { tag: 'GKI',   text: 'Often in the 1–3 therapeutic window.' },
      { tag: 'Clock', text: 'Autophagy becomes significant at 48h.' },
    ],
  },
  autophagy: {
    headline: 'Cellular housekeeping — damaged proteins being recycled.',
    body: 'Autophagy peaks around 48–72 hours of fasting. The cell identifies worn organelles and dismantles them.',
    bullets: [
      { tag: 'Peaks', text: '~48–72h of uninterrupted fasting.' },
      { tag: 'Break', text: 'Even small calories pause the process.' },
    ],
  },
  "deep-autophagy": {
    headline: 'Stem cell signalling. Strong autophagic response.',
    body: 'Past 72 hours, the regenerative end of fasting opens up — stem cell activity rises, immune cells refresh.',
    bullets: [
      { tag: 'Rare', text: 'Most effects scale with duration.' },
      { tag: 'Care', text: 'Refeed gently. Electrolytes first, protein next.' },
    ],
  },
};

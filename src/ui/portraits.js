import { CLASSES } from "../game/data.js";

const art = (file) => new URL(`../assets/${file}`, import.meta.url).href;

const HERO_ART = {
  warrior: art("portrait-warrior.png"),
  mage: art("portrait-mage.png"),
  cleric: art("portrait-cleric.png"),
  rogue: art("portrait-rogue.png"),
  ranger: art("portrait-ranger.png"),
  bard: art("portrait-bard.png"),
  alchemist: art("portrait-alchemist.png"),
  weaver: art("portrait-weaver.png"),
  dancer: art("portrait-dancer.png"),
};

const FOE_ART = {
  saltbandit: art("portrait-saltbandit.png"),
  glasscorpion: art("portrait-glasscorpion.png"),
  duneshade: art("portrait-duneshade.png"),
  adobe: art("portrait-adobe.png"),
  coralser: art("portrait-coralser.png"),
  cultist: art("portrait-suncult.png"),
  saltguardian: art("portrait-saltguardian.png"),
  thornmatron: art("portrait-gardenwarden.png"),
  lastlighthouse: art("portrait-eclipse.png"),
};

const SKILL_ART = {
  stab: art("icon-punalada.png"),
  veil: art("icon-velo.png"),
  heal: art("icon-heal.png"),
  sanctuary: art("icon-heal.png"),
  hymn: art("icon-heal.png"),
  bless: art("icon-heal.png"),
  cleanse: art("icon-heal.png"),
  guard: art("icon-guard.png"),
  ward: art("icon-guard.png"),
  taunt: art("icon-guard.png"),
  ember: art("icon-crystal.png"),
  meteor: art("icon-crystal.png"),
  frost: art("icon-crystal.png"),
  slash: art("icon-smash.png"),
  charge: art("icon-smash.png"),
  nudge: art("icon-smash.png"),
  smite: art("icon-smash.png"),
  venom: art("icon-poison.png"),
  arrow: art("icon-arrow.png"),
  volley: art("icon-arrow.png"),
  snare: art("icon-arrow.png"),
  mark: art("icon-arrow.png"),
  pilfer: art("icon-punalada.png"),
  chord: art("icon-velo.png"),
  crescendo: art("icon-velo.png"),
  dissonance: art("icon-velo.png"),
  vial: art("icon-poison.png"),
  tonic: art("icon-heal.png"),
  fumes: art("icon-crystal.png"),
  flask: art("icon-crystal.png"),
  tug: art("icon-velo.png"),
  bind: art("icon-arrow.png"),
  stitch: art("icon-guard.png"),
  unweave: art("icon-velo.png"),
  lash: art("icon-smash.png"),
  step: art("icon-velo.png"),
  flourish: art("icon-velo.png"),
  encore: art("icon-punalada.png"),
};

const FX_ART = {
  stab: SKILL_ART.stab,
  slash: SKILL_ART.slash,
  charge: SKILL_ART.charge,
  nudge: SKILL_ART.nudge,
  smite: SKILL_ART.smite,
  veil: SKILL_ART.veil,
  heal: SKILL_ART.heal,
  hymn: SKILL_ART.heal,
  cleanse: SKILL_ART.heal,
  bless: SKILL_ART.heal,
  guard: SKILL_ART.guard,
  ward: SKILL_ART.guard,
  taunt: SKILL_ART.taunt,
  fire: SKILL_ART.ember,
  meteor: SKILL_ART.meteor,
  frost: SKILL_ART.frost,
  poison: SKILL_ART.venom,
  arrow: SKILL_ART.arrow,
  volley: SKILL_ART.volley,
  snare: SKILL_ART.snare,
  mark: SKILL_ART.mark,
  gold: SKILL_ART.stab,
  chord: SKILL_ART.chord,
  crescendo: SKILL_ART.crescendo,
  dissonance: SKILL_ART.dissonance,
  crystal: SKILL_ART.ember,
};

const SKINS = ["#f0d2b0", "#e0b48a", "#c9956c", "#a86b45", "#8d5a3c", "#d4a07a"];

function tone(seed) {
  return SKINS[Math.abs(seed) % SKINS.length];
}

function faceBase(skin, gid) {
  return `
    <circle cx="50" cy="50" r="46" fill="url(#${gid})" opacity=".35"/>
    <ellipse cx="50" cy="56" rx="28" ry="32" fill="${skin}"/>
    <ellipse cx="50" cy="88" rx="22" ry="10" fill="${skin}"/>
  `;
}

function eyes(cx1, cx2, y, color = "#1a1814", slit = false) {
  if (slit) {
    return `
      <path d="M${cx1 - 7} ${y} Q${cx1} ${y - 3} ${cx1 + 7} ${y}" stroke="${color}" stroke-width="2" fill="none"/>
      <path d="M${cx2 - 7} ${y} Q${cx2} ${y - 3} ${cx2 + 7} ${y}" stroke="${color}" stroke-width="2" fill="none"/>
      <circle cx="${cx1}" cy="${y}" r="1.6" fill="${color}"/>
      <circle cx="${cx2}" cy="${y}" r="1.6" fill="${color}"/>
    `;
  }
  return `
    <ellipse cx="${cx1}" cy="${y}" rx="5" ry="5.5" fill="#f7f1e6"/>
    <ellipse cx="${cx2}" cy="${y}" rx="5" ry="5.5" fill="#f7f1e6"/>
    <circle cx="${cx1}" cy="${y + 0.5}" r="2.3" fill="${color}"/>
    <circle cx="${cx2}" cy="${y + 0.5}" r="2.3" fill="${color}"/>
  `;
}

const HERO_FACES = {
  warrior: (c, skin, gid) => `
    ${faceBase(skin, gid)}
    <path d="M22 48 Q50 8 78 48 L72 40 Q50 18 28 40 Z" fill="${c[0]}" stroke="${c[2]}" stroke-width="2"/>
    <rect x="28" y="40" width="44" height="10" rx="2" fill="${c[1]}"/>
    <rect x="46" y="40" width="8" height="18" fill="${c[2]}"/>
    ${eyes(40, 60, 58, "#3a2010")}
    <path d="M38 70 Q50 76 62 70" stroke="${c[2]}" stroke-width="2" fill="none"/>
    <path d="M30 82 Q50 94 70 82" fill="${c[0]}"/>
  `,
  mage: (c, skin, gid) => `
    ${faceBase(skin, gid)}
    <path d="M20 70 L50 6 L80 70 Z" fill="${c[2]}" stroke="${c[0]}" stroke-width="2"/>
    <path d="M28 68 Q50 22 72 68" fill="${c[0]}"/>
    ${eyes(40, 60, 56, c[1], true)}
    <circle cx="40" cy="56" r="2" fill="${c[1]}"/>
    <circle cx="60" cy="56" r="2" fill="${c[1]}"/>
    <path d="M44 68 Q50 72 56 68" stroke="${c[1]}" stroke-width="1.5" fill="none"/>
    <circle cx="50" cy="18" r="4" fill="${c[1]}"/>
  `,
  cleric: (c, skin, gid) => `
    ${faceBase(skin, gid)}
    <circle cx="50" cy="28" r="10" fill="${c[0]}" stroke="${c[1]}" stroke-width="2"/>
    <rect x="48" y="18" width="4" height="20" fill="${c[1]}"/>
    <rect x="40" y="26" width="20" height="4" fill="${c[1]}"/>
    ${eyes(39, 61, 54, "#5a3a12")}
    <path d="M40 68 Q50 74 60 68" stroke="#8a5a12" stroke-width="2" fill="none"/>
    <path d="M24 80 Q50 96 76 80" fill="${c[0]}"/>
    <path d="M30 78 Q50 70 70 78" fill="${c[1]}" opacity=".7"/>
  `,
  rogue: (c, skin, gid) => `
    ${faceBase(skin, gid)}
    <path d="M18 36 Q50 8 82 36 L78 78 Q50 92 22 78 Z" fill="${c[2]}"/>
    <path d="M26 40 Q50 18 74 40 L70 70 Q50 80 30 70 Z" fill="${c[0]}"/>
    <ellipse cx="38" cy="56" rx="6" ry="5" fill="#f7f1e6"/>
    <circle cx="38" cy="56" r="2.4" fill="${c[1]}"/>
    <path d="M52 52 L72 56" stroke="${c[2]}" stroke-width="6"/>
    <path d="M28 72 Q50 84 74 70" fill="${c[0]}"/>
    <path d="M34 70 Q50 78 66 70" fill="${c[1]}" opacity=".8"/>
  `,
  ranger: (c, skin, gid) => `
    ${faceBase(skin, gid)}
    <path d="M22 42 Q50 22 78 42" fill="${c[2]}"/>
    <path d="M20 46 Q50 30 80 46 L76 40 Q50 26 24 40 Z" fill="${c[0]}"/>
    <polygon points="50,20 54,36 46,36" fill="${c[1]}"/>
    ${eyes(39, 61, 56, "#21401f")}
    <path d="M36 58 L32 54" stroke="#21401f" stroke-width="1.5"/>
    <path d="M42 70 Q50 73 58 70" stroke="#21401f" stroke-width="1.6" fill="none"/>
    <path d="M26 80 Q50 92 74 80" fill="${c[0]}"/>
  `,
  bard: (c, skin, gid) => `
    ${faceBase(skin, gid)}
    <path d="M24 40 Q36 12 50 20 Q64 12 76 40" fill="${c[0]}"/>
    <circle cx="24" cy="58" r="4" fill="${c[1]}"/>
    ${eyes(40, 60, 54, c[2])}
    <path d="M40 68 Q50 76 60 68" stroke="${c[2]}" stroke-width="2" fill="none"/>
    <path d="M28 78 Q50 94 72 78" fill="${c[0]}"/>
    <path d="M36 44 Q42 38 46 44" stroke="${c[1]}" stroke-width="2" fill="none"/>
  `,
};

const FOE_FACES = {
  saltbandit: (c, gid) => `
    <circle cx="50" cy="50" r="46" fill="url(#${gid})" opacity=".3"/>
    <ellipse cx="50" cy="58" rx="26" ry="28" fill="#c9956c"/>
    <path d="M22 48 Q50 24 78 48 L70 42 Q50 30 30 42 Z" fill="${c[0]}"/>
    ${eyes(39, 61, 56, "#3a2010", true)}
    <path d="M30 70 Q50 86 70 70" fill="${c[0]}"/>
    <path d="M36 68 Q50 74 64 68" stroke="${c[2]}" stroke-width="2"/>
  `,
};

function artFor(unit) {
  return unit.enemy
    ? FOE_ART[unit.classId] || FOE_ART.saltbandit
    : HERO_ART[unit.classId] || HERO_ART.warrior;
}

export function skillIconUrl(skill) {
  if (!skill) return SKILL_ART.nudge;
  return SKILL_ART[skill.id] || FX_ART[skill.fx] || SKILL_ART.nudge;
}

export function skillIconMarkup(skill, size = 40) {
  return `<img class="skill-ico" src="${skillIconUrl(skill)}" alt="" width="${size}" height="${size}" />`;
}

export function portraitSVG(unit, size = 96) {
  const cls = CLASSES[unit.classId];
  const colors = unit.colors || cls?.colors || ["#c45c26", "#f0c27a", "#8b3a2a"];
  const seed = unit.seed || 1;
  const gid = `g-${String(unit.id || seed).replace(/[^a-z0-9-]/gi, "")}`;
  const skin = tone(seed);
  const inner = unit.enemy
    ? (FOE_FACES[unit.classId] || FOE_FACES.saltbandit)(colors, gid)
    : (HERO_FACES[unit.classId] || HERO_FACES.warrior)(colors, skin, gid);
  return `
    <svg class="portrait face-${unit.enemy ? "foe" : unit.classId}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${colors[0]}"/>
          <stop offset="1" stop-color="${colors[1]}"/>
        </linearGradient>
      </defs>
      ${inner}
    </svg>
  `;
}

export function portraitHTML(unit, size = 96) {
  const src = artFor(unit);
  const kind = unit.enemy ? "foe" : unit.classId;
  return `
    <span class="portrait-frame face-${kind}" style="--ps:${size}px;width:${size}px;height:${size}px">
      <img class="portrait-art" src="${src}" alt="" />
      <span class="portrait-ring" aria-hidden="true"></span>
      <span class="portrait-moss" aria-hidden="true"></span>
    </span>
  `;
}

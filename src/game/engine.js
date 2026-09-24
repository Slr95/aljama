import {
  CLASSES,
  SKILLS,
  BASIC_SKILL,
  ENEMY_SKILLS,
  ENEMIES,
  DUNGEONS,
  NAMES,
  ITEM_BASES,
  ITEM_PREFIXES,
  RARITIES,
  HAZARDS,
} from "./data.js";

const SAVE_KEY = "aljama-save-v1";

let state = null;
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  persist();
  for (const fn of listeners) fn(state);
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

export function chance(p) {
  return Math.random() < p;
}

export function clone(v) {
  return structuredClone(v);
}

function compactPartyIds() {
  if (!state?.partyIds || !state.roster) return;
  const seen = new Set();
  state.partyIds = state.partyIds.filter((id) => {
    if (!id || seen.has(id)) return false;
    if (!state.roster.some((h) => h.id === id)) return false;
    seen.add(id);
    return true;
  });
}

export function persist() {
  if (!state) return;
  compactPartyIds();
  const snapshot = { ...state, combat: null };
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !saved.roster) return null;
    saved.combat = null;
    saved.modal = null;
    if (Array.isArray(saved.partyIds) && Array.isArray(saved.roster)) {
      const seen = new Set();
      saved.partyIds = saved.partyIds.filter((id) => {
        if (!id || seen.has(id)) return false;
        if (!saved.roster.some((h) => h.id === id)) return false;
        seen.add(id);
        return true;
      });
    }
    if (saved.expedition) {
      saved.screen = "town";
      saved.modal = {
        kind: "info",
        title: "Expedición interrumpida",
        body: "La última incursión se cortó a medias. Los caminantes volvieron sin el botín.",
      };
      saved.expedition = null;
      saved.selectedHeroId = null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function hasSave() {
  return Boolean(localStorage.getItem(SAVE_KEY));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function generateName() {
  return `${pick(NAMES.first)} ${pick(NAMES.last)}`;
}

export function generateHero(classId, level = 1) {
  const cls = CLASSES[classId] || CLASSES[pick(Object.keys(CLASSES))];
  const stats = { ...cls.stats };
  const bonus = Math.max(0, level - 1);
  stats.str += Math.floor(bonus / 2);
  stats.vit += Math.ceil(bonus / 2);
  stats.mag += classId === "mage" || classId === "bard" || classId === "alchemist" || classId === "weaver" ? bonus : 0;
  stats.spi += classId === "cleric" || classId === "bard" || classId === "alchemist" ? bonus : 0;
  stats.agi += classId === "rogue" || classId === "ranger" || classId === "dancer" ? bonus : 0;
  const maxHp = cls.hp + (stats.vit - cls.stats.vit) * 4 + bonus * 6;
  return {
    id: uid("hero"),
    name: generateName(),
    classId: cls.id,
    level,
    xp: 0,
    xpToNext: 90 + level * 42,
    hp: maxHp,
    maxHp,
    stats,
    skills: [...cls.skills],
    skillRanks: Object.fromEntries(cls.skills.map((id) => [id, 1])),
    equipment: { weapon: null, armor: null, accessory: null },
    statuses: [],
    dead: false,
    seed: rand(1, 9999),
  };
}

export function ensureHero(hero) {
  if (!hero) return hero;
  if (!hero.skillRanks) {
    hero.skillRanks = Object.fromEntries((hero.skills || []).map((id) => [id, 1]));
  }
  if (hero.xpToNext == null || hero.xpToNext < 70) hero.xpToNext = 90 + (hero.level || 1) * 42;
  return hero;
}

function rarityFor(danger = 1) {
  const roll = Math.random() + danger * 0.08;
  if (roll > 0.97) return "relicario";
  if (roll > 0.82) return "raro";
  if (roll > 0.5) return "notable";
  return "comun";
}

export function generateItem(slot = null, danger = 1) {
  const chosenSlot = slot || pick(["weapon", "armor", "accessory"]);
  const base = pick(ITEM_BASES[chosenSlot]);
  const rarity = rarityFor(danger);
  const prefix = chance(0.7) ? pick(ITEM_PREFIXES) : null;
  const r = RARITIES[rarity];
  const stats = {};
  for (const [k, v] of Object.entries(base.stats)) {
    stats[k] = Math.max(1, Math.round(v * r.mult));
  }
  if (prefix) {
    for (const [k, v] of Object.entries(prefix.stats)) {
      stats[k] = (stats[k] || 0) + v;
    }
  }
  const name = prefix ? `${base.name} ${prefix.name}` : base.name;
  return {
    id: uid("item"),
    name,
    slot: chosenSlot,
    rarity,
    stats,
    classes: base.classes,
    value: Math.round(base.value * r.value * (1 + danger * 0.2)),
  };
}

function generateRecruits(count = 6) {
  const ids = Object.keys(CLASSES);
  const list = [];
  for (let i = 0; i < count; i++) {
    const level = chance(0.25) ? 2 : 1;
    const hero = generateHero(pick(ids), level);
    const rosterLen = state ? state.roster.length : 4;
    const cheap = i < Math.max(0, 4 - rosterLen);
    hero.cost = cheap ? 16 + rand(0, 6) : 28 + hero.level * 12 + rand(0, 12);
    list.push(hero);
  }
  return list;
}

function generateShop(danger = 1) {
  return Array.from({ length: 6 }, () => generateItem(null, danger));
}

export function createNewGame() {
  const starters = [
    generateHero("warrior"),
    generateHero("rogue"),
    generateHero("cleric"),
    generateHero("mage"),
  ];
  state = {
    screen: "title",
    gold: 130,
    day: 1,
    roster: starters,
    partyIds: starters.map((h) => h.id),
    inventory: [generateItem("weapon", 1), generateItem("armor", 1)],
    recruits: generateRecruits(),
    shop: generateShop(1),
    cleared: [],
    selectedHeroId: starters[0].id,
    expedition: null,
    combat: null,
    modal: null,
    levelQueue: [],
    log: [],
    seenIntro: false,
  };
  emit();
  return state;
}

export function continueGame() {
  const saved = loadSave();
  if (!saved) return createNewGame();
  state = saved;
  state.screen = "town";
  state.modal = null;
  compactPartyIds();
  if (!state.selectedHeroId || !state.roster.some((h) => h.id === state.selectedHeroId)) {
    state.selectedHeroId = state.roster[0]?.id || null;
  }
  if (!state.levelQueue) state.levelQueue = [];
  for (const h of state.roster || []) ensureHero(h);
  if (state.roster.length < 4 && state.gold < 90) state.gold = 90;
  if ((state.cleared || []).length >= DUNGEONS.length && !state.seenEnding) {
    state.modal = {
      kind: "ending",
      title: "Los tres umbrales están sellados",
      body: "Aljama ya no mira al desierto con el mismo miedo. Hay un cierre que merecéis leer.",
    };
  }
  emit();
  return state;
}

export function go(screen) {
  compactPartyIds();
  state.screen = screen;
  emit();
}

export function closeModal() {
  state.modal = null;
  emit();
}

export function selectHero(id) {
  state.selectedHeroId = id;
  emit();
}

function partyLocked() {
  return Boolean(state.expedition && (state.screen === "dungeon" || state.screen === "combat"));
}

export function toggleParty(id) {
  if (!id || partyLocked()) return;
  compactPartyIds();
  const idx = state.partyIds.indexOf(id);
  if (idx >= 0) {
    state.partyIds.splice(idx, 1);
  } else if (state.partyIds.length < 4 && state.roster.some((h) => h.id === id)) {
    state.partyIds.push(id);
  }
  state.selectedHeroId = id;
  emit();
}

export function joinParty(id) {
  if (!id || partyLocked()) return;
  compactPartyIds();
  if (state.partyIds.includes(id)) return;
  if (state.partyIds.length >= 4) return;
  if (!state.roster.some((h) => h.id === id)) return;
  state.partyIds.push(id);
  state.selectedHeroId = id;
  emit();
}

export function movePartySlot(from, to) {
  compactPartyIds();
  if (from < 0 || to < 0 || from >= state.partyIds.length || to >= state.partyIds.length) return;
  const ids = state.partyIds;
  const tmp = ids[from];
  ids[from] = ids[to];
  ids[to] = tmp;
  emit();
}

export function getHero(id) {
  if (state.expedition) {
    const copy = state.expedition.party.find((h) => h.id === id);
    if (copy) return ensureHero(copy);
  }
  const fromRoster = state.roster.find((h) => h.id === id);
  return fromRoster ? ensureHero(fromRoster) : null;
}

export function heroPower(hero) {
  const stats = { ...hero.stats, def: 0 };
  for (const slot of Object.values(hero.equipment)) {
    if (!slot) continue;
    for (const [k, v] of Object.entries(slot.stats)) {
      stats[k] = (stats[k] || 0) + v;
    }
  }
  for (const st of hero.statuses || []) {
    if (["def", "atk", "agi"].includes(st.type)) {
      const key = st.type === "atk" ? null : st.type;
      if (key) stats[key] = (stats[key] || 0) + st.amount;
    }
  }
  return stats;
}

export function canEquip(hero, item) {
  if (!item || !hero) return false;
  if (item.classes && !item.classes.includes(hero.classId)) return false;
  return true;
}

export function equipItem(heroId, itemId) {
  const hero = getHero(heroId);
  const bag = state.expedition ? state.expedition.loot : state.inventory;
  const idx = bag.findIndex((i) => i.id === itemId);
  if (!hero || idx < 0) return;
  const item = bag[idx];
  if (!canEquip(hero, item)) return;
  const prev = hero.equipment[item.slot];
  hero.equipment[item.slot] = item;
  bag.splice(idx, 1);
  if (prev) bag.push(prev);
  emit();
}

export function unequipItem(heroId, slot) {
  const hero = getHero(heroId);
  if (!hero || !hero.equipment[slot]) return;
  const bag = state.expedition ? state.expedition.loot : state.inventory;
  bag.push(hero.equipment[slot]);
  hero.equipment[slot] = null;
  emit();
}

export function sellItem(itemId) {
  const idx = state.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  const item = state.inventory[idx];
  state.gold += Math.max(1, Math.round(item.value * 0.55));
  state.inventory.splice(idx, 1);
  emit();
}

export function buyItem(itemId) {
  const idx = state.shop.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  const item = state.shop[idx];
  if (state.gold < item.value) return;
  state.gold -= item.value;
  state.inventory.push(item);
  state.shop.splice(idx, 1);
  emit();
}

export function recruitHero(id) {
  const idx = state.recruits.findIndex((h) => h.id === id);
  if (idx < 0) return;
  const hero = state.recruits[idx];
  if (state.gold < hero.cost) return;
  state.gold -= hero.cost;
  delete hero.cost;
  state.roster.push(hero);
  state.recruits.splice(idx, 1);
  if (state.partyIds.length < 4) state.partyIds.push(hero.id);
  state.selectedHeroId = hero.id;
  emit();
}

export function dismissHero(id) {
  if (state.roster.length <= 1) return;
  state.roster = state.roster.filter((h) => h.id !== id);
  state.partyIds = state.partyIds.filter((x) => x !== id);
  if (state.selectedHeroId === id) {
    state.selectedHeroId = state.roster[0]?.id || null;
  }
  emit();
}

function partyHeroes() {
  return state.partyIds
    .map((id) => state.roster.find((h) => h.id === id))
    .filter(Boolean);
}

export function canEnterDungeon() {
  return partyHeroes().length === 4;
}

function scaleEnemy(template, danger, isBoss, roomIndex = 0) {
  const cleared = state?.cleared?.length || 0;
  const bonus = (danger - 1) * 0.38 + (isBoss ? 0.28 : 0) + cleared * 0.1 + roomIndex * 0.07;
  const stats = {};
  for (const [k, v] of Object.entries(template.stats)) {
    stats[k] = Math.round(v * (1.12 + bonus));
  }
  const maxHp = Math.round(template.hp * (1.4 + bonus + (isBoss ? 0.25 : 0)));
  return {
    id: uid("foe"),
    name: template.name,
    classId: template.id,
    enemy: true,
    boss: Boolean(template.boss),
    level: danger,
    hp: maxHp,
    maxHp,
    stats,
    skills: [...template.skills],
    equipment: { weapon: null, armor: null, accessory: null },
    statuses: [],
    dead: false,
    seed: rand(1, 9999),
    colors: template.colors,
    xp: Math.round(template.xp * (1 + bonus)),
    gold: rand(template.gold[0], template.gold[1]) + danger * 2,
  };
}

function rollEncounter(dungeon, roomIndex, isBoss) {
  if (isBoss) {
    const boss = scaleEnemy(ENEMIES[dungeon.boss], dungeon.danger, true, roomIndex);
    const adds = [];
    if (dungeon.danger >= 2) {
      adds.push(scaleEnemy(ENEMIES[pick(dungeon.enemies)], dungeon.danger, false, roomIndex));
    }
    if (dungeon.danger >= 3) {
      adds.push(scaleEnemy(ENEMIES[pick(dungeon.enemies)], dungeon.danger, false, roomIndex));
    }
    return [boss, ...adds];
  }
  const ids = dungeon.enemies;
  const min = roomIndex === 0 ? (dungeon.danger === 1 ? 2 : 3) : 2 + dungeon.danger;
  const max = Math.min(4, min + 1);
  const count = rand(min, max);
  const chosen = [];
  for (let i = 0; i < count; i++) {
    let id = pick(ids);
    if (id === "adobe" && chosen.includes("adobe")) {
      const rest = ids.filter((x) => x !== "adobe");
      id = rest.length ? pick(rest) : id;
    }
    chosen.push(id);
  }
  return chosen.map((id) => scaleEnemy(ENEMIES[id], dungeon.danger, false, roomIndex));
}

function buildRooms(dungeon) {
  const rooms = [];
  for (let i = 0; i < dungeon.rooms; i++) {
    const last = i === dungeon.rooms - 1;
    if (last) {
      rooms.push({ type: "boss", cleared: false });
      continue;
    }
    const roll = Math.random();
    let type = "combat";
    if (i > 0 && roll < 0.08) type = "shrine";
    else if (i > 0 && roll < 0.18) type = "treasure";
    rooms.push({ type, cleared: false });
  }
  return rooms;
}

export function startExpedition(dungeonId) {
  const dungeon = DUNGEONS.find((d) => d.id === dungeonId);
  if (!dungeon || !canEnterDungeon()) return;
  if (dungeon.unlock && !state.cleared.includes(dungeon.unlock)) return;
  const party = partyHeroes().map((h, i) => {
    const copy = clone(h);
    copy.rank = i + 1;
    copy.hp = copy.maxHp;
    copy.statuses = [];
    copy.dead = false;
    return copy;
  });
  state.expedition = {
    dungeonId,
    room: 0,
    rooms: buildRooms(dungeon),
    party,
    loot: [],
    gold: 0,
    log: [`La compañía desciende al ${dungeon.name}.`],
  };
  state.selectedHeroId = party[0].id;
  state.screen = "dungeon";
  emit();
}

function living(units) {
  return units.filter((u) => !u.dead && u.hp > 0);
}

function rankOf(unit, side) {
  const alive = living(side);
  const idx = alive.findIndex((u) => u.id === unit.id);
  return idx + 1;
}

function compactRanks(side) {
  living(side).forEach((u, i) => {
    u.rank = i + 1;
  });
}

export function getSkill(id, enemy = false) {
  if (id === BASIC_SKILL.id) return BASIC_SKILL;
  return enemy ? ENEMY_SKILLS[id] || SKILLS[id] : SKILLS[id] || BASIC_SKILL;
}

export function skillUpgradePreview(hero, skillId) {
  const now = skillFor(hero, skillId);
  const next = skillFor(
    { ...hero, skillRanks: { ...(hero.skillRanks || {}), [skillId]: (hero.skillRanks?.[skillId] || 1) + 1 } },
    skillId,
  );
  const lines = [];
  if ((now.power || 0) !== (next.power || 0)) lines.push(`Poder ${now.power || 0} → ${next.power || 0}`);
  if ((now.crit || 0) !== (next.crit || 0)) {
    lines.push(`Crítico ${Math.round((now.crit || 0) * 100)}% → ${Math.round((next.crit || 0) * 100)}%`);
  }
  const a = now.effects?.[0];
  const b = next.effects?.[0];
  if (a && b && a.amount !== b.amount) {
    lines.push(`Efecto (${a.type}) ${a.amount} → ${b.amount}`);
  }
  if (!lines.length) lines.push("El arte se vuelve más estable y un poco más fuerte.");
  return { now, next, lines };
}

export function skillFor(unit, skillId) {
  const base = getSkill(skillId, Boolean(unit?.enemy));
  if (!base || unit?.enemy) return base;
  const rank = unit.skillRanks?.[skillId] || 1;
  if (rank <= 1) return { ...base, rank: 1 };
  const scale = 1 + (rank - 1) * 0.22;
  return {
    ...base,
    rank,
    name: `${base.name} ${"I".repeat(Math.min(rank, 4))}`,
    power: Math.round((base.power || 0) * scale),
    crit: (base.crit || 0) + (rank - 1) * 0.03,
    effects: (base.effects || []).map((e) => ({
      ...e,
      amount: typeof e.amount === "number" ? Math.round(e.amount * (1 + (rank - 1) * 0.18)) : e.amount,
    })),
  };
}

function unitRank(unit, side) {
  if (unit?.rank) return unit.rank;
  return rankOf(unit, side);
}

export function swapExpedition(from, to) {
  const ex = state.expedition;
  if (!ex || state.combat) return;
  const a = ex.party[from];
  const b = ex.party[to];
  if (!a || !b) return;
  ex.party[from] = b;
  ex.party[to] = a;
  ex.party.forEach((h, i) => {
    h.rank = i + 1;
  });
  emit();
}

export function skillUsable(unit, skill, side) {
  if (!skill) return false;
  return skill.launch.includes(unitRank(unit, side));
}

export function validTargets(skill, userSide, otherSide) {
  const type = skill.target?.type;
  if (type === "self") return [];
  if (type === "allAllies" || type === "allEnemies") return [];
  const pool = type === "ally" ? living(userSide) : living(otherSide);
  const ranks = skill.target?.ranks || [1, 2, 3, 4];
  return pool.filter((u) => ranks.includes(unitRank(u, type === "ally" ? userSide : otherSide)));
}

function addStatus(unit, effect) {
  if (!effect || effect.type === "gold" || effect.type === "cleanse") return;
  const copy = { ...effect };
  if (
    state.combat?.hazard?.id === "hush" &&
    ["def", "atk", "dodge", "shield"].includes(copy.type) &&
    copy.turns > 1
  ) {
    copy.turns -= 1;
  }
  unit.statuses = (unit.statuses || []).filter((s) => s.type !== effect.type);
  unit.statuses.push(copy);
}

function addCrust(target) {
  const prev = (target.statuses || []).find((s) => s.type === "crust");
  const n = Math.min(3, (prev?.amount || 0) + 1);
  addStatus(target, { type: "crust", amount: n, turns: 99 });
  return n;
}

function shoveBack(unit, side) {
  const idx = side.findIndex((u) => u.id === unit.id);
  if (idx < 0 || idx >= side.length - 1) return false;
  const tmp = side[idx];
  side[idx] = side[idx + 1];
  side[idx + 1] = tmp;
  compactRanks(side);
  return true;
}

function pullForward(unit, side) {
  const idx = side.findIndex((u) => u.id === unit.id);
  if (idx <= 0) return false;
  const tmp = side[idx];
  side[idx] = side[idx - 1];
  side[idx - 1] = tmp;
  compactRanks(side);
  return true;
}

function tickStatuses(unit) {
  const notes = [];
  const next = [];
  for (const st of unit.statuses || []) {
    if (st.type === "dot" && !unit.dead) {
      unit.hp = Math.max(0, unit.hp - st.amount);
      notes.push(`${unit.name} sufre ${st.amount} de veneno.`);
      if (unit.hp <= 0) {
        unit.dead = true;
        notes.push(`${unit.name} cae.`);
      }
    }
    st.turns -= 1;
    if (st.turns > 0) next.push(st);
  }
  unit.statuses = next;
  return notes;
}

function applyHeal(target, amount) {
  let next = amount * 0.82;
  if (state.combat?.hazard?.id === "glare") next *= 0.55;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.round(next));
  return target.hp - before;
}

function damageOf(user, skill, target) {
  const us = heroPower(user);
  const ts = heroPower(target);
  const scale = skill.scaling ? us[skill.scaling] || 0 : 0;
  const atkBonus = (user.statuses || []).reduce((a, s) => a + (s.type === "atk" ? s.amount : 0), 0);
  const scaleFactor = user.enemy ? 0.55 : 1.15;
  let raw = (skill.power || 0) + scale * scaleFactor + atkBonus;
  raw *= user.enemy ? 0.8 + Math.random() * 0.16 : 0.88 + Math.random() * 0.24;
  if (user.enemy) raw *= user.classId === "adobe" ? 0.72 : 0.9;
  if (skill.aoeScale) raw *= skill.aoeScale;
  else if (skill.target?.type === "allEnemies" && user.enemy) raw *= user.boss ? 0.38 : 0.32;
  const hz = state.combat?.hazard?.id;
  if (hz === "eclipse") {
    if (skill.kind === "magic") raw *= 1.25;
    if (skill.kind === "phys") raw *= 0.8;
  }
  const marked = (target.statuses || []).find((s) => s.type === "marked");
  if (marked) raw += marked.amount;
  const isCrit = chance(skill.crit || 0.06);
  if (isCrit) raw *= user.enemy ? 1.22 : 1.5;
  if (skill.kind === "phys") raw -= (ts.def || 0) * 0.7;
  if (skill.kind === "magic") raw -= (ts.spi || 0) * 0.25;
  if (user.enemy && target?.maxHp) {
    const cap = Math.max(user.boss ? 10 : 6, Math.round(target.maxHp * (user.boss ? 0.34 : 0.24)));
    raw = Math.min(raw, cap);
  }
  return { dmg: Math.max(1, Math.round(raw)), crit: isCrit };
}

function applyDamage(target, dmg) {
  const shield = (target.statuses || []).find((s) => s.type === "shield");
  let leftover = dmg;
  if (shield) {
    const absorb = Math.min(shield.amount, leftover);
    shield.amount -= absorb;
    leftover -= absorb;
    if (shield.amount <= 0) {
      target.statuses = target.statuses.filter((s) => s.type !== "shield");
    }
  }
  const dodge = (target.statuses || []).find((s) => s.type === "dodge");
  if (dodge && chance(dodge.amount / 100)) {
    return { dealt: 0, dodged: true };
  }
  target.hp = Math.max(0, target.hp - leftover);
  if (!target.enemy && !target.wounded && target.hp > 0 && target.hp <= target.maxHp * 0.3) {
    target.wounded = true;
    target.maxHp = Math.max(14, target.maxHp - 6);
    if (target.hp > target.maxHp) target.hp = target.maxHp;
    target.statuses = target.statuses || [];
    if (!target.statuses.some((s) => s.type === "wound")) {
      target.statuses.push({ type: "wound", amount: 6, turns: 99 });
    }
  }
  if (target.hp <= 0) target.dead = true;
  return { dealt: leftover, dodged: false };
}

function resolveSkill(user, skill, target, allies, foes) {
  const logs = [];
  const hits = [];
  let targets = [];
  if (skill.target.type === "self") targets = [user];
  else if (skill.target.type === "allAllies") targets = living(allies);
  else if (skill.target.type === "allEnemies") {
    targets = living(foes);
    if (skill.maxHits) {
      targets = [...targets].sort(() => Math.random() - 0.5).slice(0, skill.maxHits);
    }
  } else if (target) targets = [target];

  for (const t of targets) {
    if (skill.kind === "heal") {
      const us = heroPower(user);
      const amount = Math.round((skill.power || 0) + (us[skill.scaling] || 0) * 1.1);
      const healed = applyHeal(t, amount);
      logs.push(`${user.name} restablece ${healed} de vitalidad a ${t.name}.`);
      hits.push({ id: t.id, kind: "heal", n: healed, fx: skill.fx || "heal" });
    } else if (skill.kind === "buff") {
      logs.push(`${user.name} usa ${skill.name} sobre ${t.name}.`);
      hits.push({ id: t.id, kind: "buff", n: 0, fx: skill.fx || "guard" });
    } else {
      const { dmg, crit } = damageOf(user, skill, t);
      const res = applyDamage(t, dmg);
      if (res.dodged) {
        logs.push(`${t.name} se desvanece y evita el golpe.`);
        hits.push({ id: t.id, kind: "dodge", n: 0, fx: "veil" });
      } else {
        logs.push(
          `${user.name} usa ${skill.name} contra ${t.name} (${res.dealt}${crit ? " crítico" : ""}).`,
        );
        hits.push({ id: t.id, kind: crit ? "crit" : "hit", n: res.dealt, fx: skill.fx || skill.id });
        if (t.dead) logs.push(`${t.name} cae al polvo.`);
        if (res.dealt > 0 && !t.dead) {
          if (state.combat?.hazard?.id === "thorns" && !user.enemy && t.rank === 1) {
            applyDamage(user, 4);
            logs.push("Los cristales vivos muerden a quien golpea el frente.");
          }
          const stacks = addCrust(t);
          logs.push(`${t.name} acumula costra de sal (${stacks}/3).`);
          if (stacks >= 3) {
            const extra = Math.max(3, Math.round(res.dealt * 0.45));
            applyDamage(t, extra);
            t.statuses = (t.statuses || []).filter((s) => s.type !== "crust");
            logs.push(`La costra de ${t.name} estalla (+${extra}).`);
            if (t.enemy) {
              for (const o of living(foes)) {
                if (o.id !== t.id && !o.dead) applyDamage(o, Math.max(1, Math.round(extra * 0.4)));
              }
            } else if (shoveBack(t, allies)) {
              logs.push(`${t.name} es empujado a un puesto peor.`);
            }
          }
        }
      }
    }
    for (const fx of skill.effects || []) {
      if (fx.type === "cleanse") {
        t.statuses = (t.statuses || []).filter(
          (s) => !(s.type === "dot" || (s.type === "atk" && s.amount < 0) || (s.type === "agi" && s.amount < 0)),
        );
        logs.push(`${t.name} queda limpio de males.`);
      } else if (fx.type === "shove") {
        const side = allies.some((u) => u.id === t.id) ? allies : foes;
        if (shoveBack(t, side)) logs.push(`${t.name} pierde el puesto.`);
      } else if (fx.type === "pull") {
        const side = foes.some((u) => u.id === t.id) ? foes : allies;
        if (pullForward(t, side)) logs.push(`${t.name} es arrastrado hacia el frente.`);
      } else if (fx.type === "strip") {
        const before = (t.statuses || []).length;
        t.statuses = (t.statuses || []).filter(
          (s) => !((s.type === "def" || s.type === "atk" || s.type === "shield" || s.type === "dodge") && s.amount > 0),
        );
        if (t.statuses.length < before) logs.push(`${t.name} pierde sus refuerzos.`);
      } else if (fx.type === "swap") {
        const i = allies.findIndex((u) => u.id === user.id);
        const j = allies.findIndex((u) => u.id === t.id);
        if (i >= 0 && j >= 0 && i !== j) {
          const tmp = allies[i];
          allies[i] = allies[j];
          allies[j] = tmp;
          compactRanks(allies);
          logs.push(`${user.name} cambia el puesto con ${t.name}.`);
        }
      } else if (fx.type === "gold") {
        if (state.expedition) {
          const gain = fx.amount + rand(0, 6);
          state.expedition.gold += gain;
          logs.push(`Se extraen ${gain} solis.`);
        }
      } else {
        const dest = fx.on === "self" ? user : t;
        addStatus(dest, fx);
        if (fx.type === "taunt" && dest === user) {
          logs.push(`${user.name} obliga a la sala a mirarlo.`);
        }
      }
    }
  }
  if ((skill.effects || []).some((fx) => fx.on === "self") && !hits.some((h) => h.id === user.id)) {
    hits.push({ id: user.id, kind: "buff", n: 0, fx: skill.fx || "taunt" });
  }
  return { logs, hits };
}

function buildTurnOrder(party, foes) {
  const units = [...living(party), ...living(foes)].map((u) => {
    const stats = heroPower(u);
    const agiMod = (u.statuses || []).reduce((a, s) => a + (s.type === "agi" ? s.amount : 0), 0);
    return { id: u.id, enemy: Boolean(u.enemy), init: stats.agi + agiMod + Math.random() * 2 };
  });
  units.sort((a, b) => b.init - a.init);
  return units;
}

export function beginRoom() {
  const ex = state.expedition;
  if (!ex) return;
  const dungeon = DUNGEONS.find((d) => d.id === ex.dungeonId);
  const room = ex.rooms[ex.room];
  if (room.type === "shrine") {
    for (const h of living(ex.party)) {
      applyHeal(h, Math.round(h.maxHp * 0.32));
    }
    state.screen = "dungeon";
    state.modal = {
      kind: "loot",
      title: "Santuario de teja",
      body: "El agua residual del oasis cierra heridas. La compañía recupera aliento.",
    };
    room.cleared = true;
    emit();
    return;
  }
  if (room.type === "treasure") {
    const loot = [generateItem(null, dungeon.danger + 1), generateItem(null, dungeon.danger)];
    loot.forEach((item) => {
      item.fresh = true;
    });
    ex.loot.push(...loot);
    ex.gold += rand(8, 16) * dungeon.danger;
    state.screen = "dungeon";
    state.modal = {
      kind: "loot",
      title: "Cámara de ofrendas",
      body: `Halláis ${loot.map((i) => i.name).join(" y ")}. Equípalos ahora si quieres, antes de la siguiente sala.`,
    };
    room.cleared = true;
    emit();
    return;
  }
  startCombat(room.type === "boss");
}

function startCombat(isBoss) {
  const ex = state.expedition;
  const dungeon = DUNGEONS.find((d) => d.id === ex.dungeonId);
  const foes = rollEncounter(dungeon, ex.room, isBoss);
  foes.forEach((f, i) => {
    f.rank = i + 1;
  });
  compactRanks(ex.party);
  const order = buildTurnOrder(ex.party, foes);
  const hazard = HAZARDS[pick(Object.keys(HAZARDS))];
  state.combat = {
    foes,
    order,
    turn: 0,
    phase: "select",
    actorId: order[0].id,
    selectedSkill: null,
    floaters: [],
    hazard,
    round: 1,
    log: [
      isBoss ? `${foes[0].name} se alza al fondo de la sala.` : "La sala se cierra. Hay movimiento en la sal.",
      `La sala impone: ${hazard.name}. ${hazard.desc}`,
    ],
    isBoss,
  };
  state.screen = "combat";
  emit();
  if (currentActor()?.enemy) {
    setTimeout(() => enemyAct(), 550);
  }
}

export function currentActor() {
  const c = state.combat;
  if (!c) return null;
  const id = c.order[c.turn]?.id;
  return (
    state.expedition.party.find((h) => h.id === id) ||
    c.foes.find((f) => f.id === id) ||
    null
  );
}

function pushLog(text) {
  state.combat.log.push(text);
  if (state.combat.log.length > 10) state.combat.log.shift();
}

function battleOver() {
  const ex = state.expedition;
  const c = state.combat;
  if (living(ex.party).length === 0) {
    endWipe();
    return true;
  }
  if (living(c.foes).length === 0) {
    endCombatVictory();
    return true;
  }
  return false;
}

function skipToLiving(from) {
  const c = state.combat;
  let i = from;
  while (i < c.order.length) {
    const id = c.order[i]?.id;
    const unit =
      state.expedition.party.find((h) => h.id === id) ||
      c.foes.find((f) => f.id === id);
    if (unit && !unit.dead && unit.hp > 0) return i;
    i += 1;
  }
  return -1;
}

function nextTurn() {
  const c = state.combat;
  const ex = state.expedition;
  compactRanks(ex.party);
  compactRanks(c.foes);
  if (battleOver()) return;

  let next = skipToLiving(c.turn + 1);
  if (next < 0) {
    const notes = [];
    for (const u of [...ex.party, ...c.foes]) {
      if (!u.dead) notes.push(...tickStatuses(u));
    }
    notes.forEach(pushLog);
    c.round = (c.round || 1) + 1;
    if (c.hazard?.id === "heat") {
      for (const u of [...ex.party, ...c.foes]) {
        if (u.dead) continue;
        applyDamage(u, 3);
        pushLog(`${u.name} se cuece en el horno (3).`);
      }
    }
    if (c.hazard?.id === "quake") {
      const alive = living(ex.party);
      if (alive.length >= 2) {
        const a = rand(0, alive.length - 1);
        const b = (a + rand(1, alive.length - 1)) % alive.length;
        const ia = ex.party.findIndex((x) => x.id === alive[a].id);
        const ib = ex.party.findIndex((x) => x.id === alive[b].id);
        const tmp = ex.party[ia];
        ex.party[ia] = ex.party[ib];
        ex.party[ib] = tmp;
        compactRanks(ex.party);
        pushLog("El temblor cambia los puestos de la compañía.");
      }
    }
    compactRanks(ex.party);
    compactRanks(c.foes);
    if (battleOver()) return;
    c.order = buildTurnOrder(ex.party, c.foes);
    next = skipToLiving(0);
    if (next < 0) {
      if (battleOver()) return;
      next = 0;
    }
  }

  c.turn = next;
  c.phase = "select";
  c.selectedSkill = null;
  c.floaters = [];
  c.flash = null;
  emit();
  if (currentActor()?.enemy) {
    setTimeout(() => enemyAct(), 600);
  }
}

export function cancelSkill() {
  if (!state.combat) return;
  state.combat.selectedSkill = null;
  state.combat.phase = "select";
  emit();
}

export function chooseSkill(skillId) {
  const actor = currentActor();
  if (!actor || actor.enemy || actor.dead) return;
  const skill = skillFor(actor, skillId);
  if (!skillUsable(actor, skill, state.expedition.party)) return;
  if (skill.target.type === "self" || skill.target.type === "allAllies" || skill.target.type === "allEnemies") {
    commitAction(skill, null);
    return;
  }
  state.combat.selectedSkill = skillId;
  state.combat.phase = "target";
  emit();
}

export function chooseTarget(targetId) {
  const actor = currentActor();
  const skill = actor ? skillFor(actor, state.combat.selectedSkill) : getSkill(state.combat.selectedSkill);
  if (!skill || !actor) return;
  const allies = state.expedition.party;
  const foes = state.combat.foes;
  const pool = skill.target.type === "ally" ? allies : foes;
  const target = pool.find((u) => u.id === targetId);
  if (!target || target.dead) return;
  const valid = validTargets(skill, allies, foes);
  if (!valid.some((v) => v.id === target.id)) return;
  commitAction(skill, target);
}

function commitAction(skill, target) {
  const actor = currentActor();
  const allies = actor.enemy ? state.combat.foes : state.expedition.party;
  const foes = actor.enemy ? state.expedition.party : state.combat.foes;
  const result = resolveSkill(actor, skill, target, allies, foes);
  result.logs.forEach(pushLog);
  state.combat.floaters = result.hits;
  state.combat.flash = { name: skill.name, fx: skill.fx || skill.id };
  state.combat.phase = "resolve";
  state.combat.selectedSkill = null;
  actor.lastSkill = skill.id;
  maybeBossPhase();
  emit();
  setTimeout(() => nextTurn(), 1100);
}

function maybeBossPhase() {
  const c = state.combat;
  const ex = state.expedition;
  if (!c || !ex) return;
  for (const f of c.foes) {
    if (!f.boss || f.phased || f.dead) continue;
    if (f.hp > f.maxHp * 0.5) continue;
    f.phased = true;
    addStatus(f, { type: "atk", amount: 5, turns: 5 });
    addStatus(f, { type: "def", amount: 4, turns: 5 });
    const dungeon = DUNGEONS.find((d) => d.id === ex.dungeonId);
    if (dungeon) {
      const add = scaleEnemy(ENEMIES[pick(dungeon.enemies)], dungeon.danger, false, ex.room);
      c.foes.push(add);
      compactRanks(c.foes);
      pushLog(`${f.name} quiebra el umbral. Algo más se alza.`);
    }
    pushLog(`${f.name} entra en su segunda forma.`);
  }
}

function canReach(skill, allies, foes, unit) {
  if (!unit || unit.dead) return false;
  if (skill.target.type === "allEnemies") return true;
  if (skill.target.type === "self") return true;
  if (skill.target.type === "enemy") {
    return validTargets(skill, allies, foes).some((v) => v.id === unit.id);
  }
  return false;
}

function enemyAct() {
  if (!state.combat || state.screen !== "combat") return;
  const actor = currentActor();
  if (!actor || !actor.enemy || actor.dead) return;
  const allies = state.combat.foes;
  const foes = state.expedition.party;
  const options = actor.skills
    .map((id) => getSkill(id, true))
    .filter((sk) => skillUsable(actor, sk, allies));
  if (!options.length) {
    nextTurn();
    return;
  }

  const taunter = living(foes).find((v) => (v.statuses || []).some((s) => s.type === "taunt"));
  const wounded = living(allies)
    .filter((a) => a.hp < a.maxHp * 0.45)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const heal = options.find((s) => s.kind === "heal");
  const guard = options.find(
    (s) => s.kind === "buff" && (s.effects || []).some((e) => e.type === "def" || e.type === "shield" || e.type === "dodge"),
  );

  let skill = null;
  let target = null;

  if (heal && (actor.hp < actor.maxHp * 0.35 || wounded[0])) {
    skill = heal;
    target = actor.hp < actor.maxHp * 0.35 && heal.target.type === "self" ? actor : wounded[0] || actor;
    if (heal.target.type === "self") target = actor;
    if (heal.target.type === "ally") target = wounded[0] || pick(living(allies));
  } else if (guard && actor.hp < actor.maxHp * 0.4 && actor.lastSkill !== guard.id) {
    skill = guard;
    target = actor;
  } else {
    let pool = options.filter((s) => s.kind !== "heal");
    if (taunter) {
      const hitting = pool.filter((sk) => canReach(sk, allies, foes, taunter));
      if (hitting.length) pool = hitting;
    }
    const fresh = pool.filter((s) => s.id !== actor.lastSkill);
    skill = pick(fresh.length ? fresh : pool);
    if (skill?.target?.type === "allEnemies" && chance(0.6)) {
      const single = (fresh.length ? fresh : pool).filter((s) => s.target.type === "enemy");
      if (single.length) skill = pick(single);
    }
    if (skill.target.type === "self") target = actor;
    else if (skill.target.type === "ally") target = wounded[0] || pick(living(allies));
    else if (skill.target.type === "enemy") {
      const valid = validTargets(skill, allies, foes);
      if (taunter && valid.some((v) => v.id === taunter.id)) {
        target = taunter;
      } else {
        const front = valid.filter((v) => (v.rank || 9) <= 2);
        const pool = front.length ? front : valid;
        const tank = pool.find((v) => v.classId === "warrior");
        target = tank && chance(0.7) ? tank : pick(pool);
      }
    }
  }

  if (!skill) {
    nextTurn();
    return;
  }
  commitAction(skill, target);
}

function endCombatVictory() {
  const ex = state.expedition;
  const c = state.combat;
  const dungeon = DUNGEONS.find((d) => d.id === ex.dungeonId);
  let gold = 0;
  let xp = 0;
  for (const f of c.foes) {
    gold += f.gold;
    xp += f.xp;
  }
  ex.gold += gold;
  const lootCount = c.isBoss ? 2 : chance(0.7) ? 1 : 0;
  const found = [];
  for (let i = 0; i < lootCount; i++) {
    const item = generateItem(null, dungeon.danger + (c.isBoss ? 1 : 0));
    item.fresh = true;
    ex.loot.push(item);
    found.push(item);
  }
  const share = Math.max(6, Math.round(xp * 0.28));
  for (const h of living(ex.party)) {
    grantXp(h, share);
  }
  const room = ex.rooms[ex.room];
  room.cleared = true;
  state.combat = null;
  state.screen = "dungeon";
  state.modal = {
    kind: "loot",
    title: c.isBoss ? "El umbral cede" : "Sala en calma",
    body:
      `+${gold} solis` +
      (found.length ? `. Hallazgo: ${found.map((i) => i.name).join(", ")}.` : ".") +
      " Equipa lo que quieras antes de seguir.",
  };
  emit();
}

function queueLevelUp(hero) {
  if (!state.levelQueue) state.levelQueue = [];
  state.levelQueue.push({
    heroId: hero.id,
    name: hero.name,
    level: hero.level,
    skills: [...hero.skills],
  });
}

function grantXp(hero, amount) {
  ensureHero(hero);
  hero.xp += amount;
  while (hero.xp >= hero.xpToNext) {
    hero.xp -= hero.xpToNext;
    hero.level += 1;
    hero.xpToNext = 90 + hero.level * 42;
    hero.stats.vit += 1;
    if (hero.classId === "mage" || hero.classId === "bard" || hero.classId === "weaver") hero.stats.mag += 1;
    else if (hero.classId === "cleric" || hero.classId === "alchemist") hero.stats.spi += 1;
    else if (hero.classId === "rogue" || hero.classId === "ranger" || hero.classId === "dancer") hero.stats.agi += 1;
    else hero.stats.str += 1;
    hero.maxHp += 6 + Math.floor(hero.stats.vit / 2);
    hero.hp = Math.min(hero.maxHp, hero.hp + 8);
    queueLevelUp(hero);
  }
}

export function pickUpgrade(skillId) {
  const q = (state.levelQueue || []).shift();
  if (!q) return;
  const hero = getHero(q.heroId) || state.roster.find((h) => h.id === q.heroId);
  if (hero && hero.skills.includes(skillId)) {
    ensureHero(hero);
    hero.skillRanks[skillId] = (hero.skillRanks[skillId] || 1) + 1;
  }
  emit();
}

export function advanceRoom() {
  const ex = state.expedition;
  if (!ex) {
    closeModal();
    return;
  }
  for (const item of ex.loot || []) item.fresh = false;
  if (ex.room >= ex.rooms.length - 1 && ex.rooms[ex.room].cleared) {
    finishExpedition(true);
    return;
  }
  if (ex.rooms[ex.room].cleared) ex.room += 1;
  state.modal = null;
  beginRoom();
}

export function retreatExpedition() {
  if (!state.expedition) return;
  state.modal = {
    kind: "confirm",
    title: "¿Huir del velo?",
    body: "Los caminantes vuelven con vida, pero todo el botín de esta incursión se pierde en la sal.",
    confirm: "retreat",
  };
  emit();
}

export function confirmRetreat() {
  state.expedition = null;
  state.combat = null;
  state.modal = {
    kind: "info",
    title: "Huida",
    body: "Regresáis a Aljama con las manos vacías. Al menos la compañía respira.",
  };
  state.screen = "town";
  state.day += 1;
  state.recruits = generateRecruits();
  emit();
}

function endWipe() {
  const fallen = state.expedition.party.map((h) => h.name);
  const ids = new Set(state.expedition.party.map((h) => h.id));
  state.roster = state.roster.filter((h) => !ids.has(h.id));
  state.partyIds = state.partyIds.filter((id) => !ids.has(id));
  state.expedition = null;
  state.combat = null;
  state.selectedHeroId = state.roster[0]?.id || null;
  state.day += 1;
  state.gold += 40;
  state.recruits = generateRecruits();
  state.screen = "defeat";
  state.modal = null;
  state.log = fallen;
  emit();
}

function finishExpedition(success) {
  const ex = state.expedition;
  if (!success || !ex) return;
  const dungeon = DUNGEONS.find((d) => d.id === ex.dungeonId);
  for (const copy of ex.party) {
    const live = state.roster.find((h) => h.id === copy.id);
    if (!live) continue;
    if (copy.dead) {
      for (const it of Object.values(copy.equipment || {})) {
        if (it) state.inventory.push(it);
      }
      for (const it of Object.values(live.equipment || {})) {
        if (it && !Object.values(copy.equipment || {}).some((x) => x && x.id === it.id)) {
          state.inventory.push(it);
        }
      }
      state.roster = state.roster.filter((h) => h.id !== copy.id);
      state.partyIds = state.partyIds.filter((id) => id !== copy.id);
      continue;
    }
    live.level = copy.level;
    live.xp = copy.xp;
    live.xpToNext = copy.xpToNext;
    live.stats = copy.stats;
    live.maxHp = copy.maxHp;
    live.hp = copy.maxHp;
    live.skillRanks = copy.skillRanks || live.skillRanks;
    live.equipment = {
      weapon: copy.equipment?.weapon || live.equipment?.weapon || null,
      armor: copy.equipment?.armor || live.equipment?.armor || null,
      accessory: copy.equipment?.accessory || live.equipment?.accessory || null,
    };
  }
  state.inventory.push(...ex.loot);
  state.gold += ex.gold;
  if (!state.cleared.includes(ex.dungeonId)) state.cleared.push(ex.dungeonId);
  state.log = {
    dungeon: dungeon.name,
    gold: ex.gold,
    loot: ex.loot,
    survivors: ex.party.filter((h) => !h.dead).map((h) => `${h.name} (nvl ${h.level})`),
  };
  state.expedition = null;
  state.combat = null;
  state.modal = null;
  state.day += 1;
  state.recruits = generateRecruits();
  state.shop = generateShop(1 + state.cleared.length);
  const wonAll = state.cleared.length >= DUNGEONS.length;
  if (wonAll) {
    state.seenEnding = true;
    state.screen = "ending";
  } else {
    state.screen = "victory";
  }
  emit();
}

export function openEnding() {
  state.seenEnding = true;
  state.modal = null;
  state.screen = "ending";
  emit();
}

export function backToTown() {
  state.screen = "town";
  state.modal = null;
  emit();
}

export function dismissIntro() {
  state.seenIntro = true;
  emit();
}

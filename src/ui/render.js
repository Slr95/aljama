import { CLASSES, DUNGEONS, SKILLS, BASIC_SKILL, RARITIES, STAT_LABELS, EFFECT_LABELS } from "../game/data.js";
import {
  getState,
  go,
  createNewGame,
  continueGame,
  hasSave,
  selectHero,
  toggleParty,
  joinParty,
  movePartySlot,
  recruitHero,
  dismissHero,
  sellItem,
  buyItem,
  equipItem,
  unequipItem,
  startExpedition,
  beginRoom,
  advanceRoom,
  retreatExpedition,
  confirmRetreat,
  closeModal,
  chooseSkill,
  cancelSkill,
  chooseTarget,
  backToTown,
  currentActor,
  skillUsable,
  validTargets,
  getSkill,
  skillFor,
  pickUpgrade,
  skillUpgradePreview,
  openEnding,
  heroPower,
  canEquip,
  canEnterDungeon,
  swapExpedition,
} from "../game/engine.js";
import { portraitHTML, skillIconMarkup } from "./portraits.js";
import { sfx } from "./audio.js";

const app = document.getElementById("app");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function hpBar(unit, foe = false) {
  const pct = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  return `<div class="hp ${foe ? "foe" : ""}"><i style="width:${pct}%"></i></div>`;
}

function topbar(s, extra = "") {
  return `
    <div class="topbar">
      <div class="brand"><b>Aljama</b><span>Caminantes del Velo</span></div>
      <div class="meta">
        <span>Día ${s.day}</span>
        <span class="coin">${s.gold} solis</span>
        <span>${s.roster.length} caminantes</span>
        ${extra}
      </div>
    </div>
  `;
}

const TITLE_CITY = new URL("../assets/title-city.png", import.meta.url).href;

function cityArt() {
  return `<figure class="cityscape"><img src="${TITLE_CITY}" alt="Aljama, ciudad-caravana de teja y faroles" /></figure>`;
}

function titleView(s) {
  return `
    <section class="title-screen">
      <div class="title-plate">
        <div class="sun"></div>
        <h1>Aljama</h1>
        <div class="sub">Caminantes del Velo</div>
        ${cityArt()}
        <p class="lead">
          En el borde del desierto de cristal-arena se alza una ciudad-caravana de teja,
          turquesa y faroles. Cuatro caminantes bajan a los templos que el último eclipse
          hundió. Si caen, se quedan. Si vuelven, Aljama crece.
        </p>
        <div class="center">
          <button class="btn" data-act="new">Nueva compañía</button>
          ${hasSave() ? `<button class="btn ghost" data-act="continue">Continuar</button>` : ""}
        </div>
      </div>
    </section>
  `;
}

function className(id) {
  return CLASSES[id]?.name || id;
}

function heroChip(h, s) {
  const cls = CLASSES[h.classId];
  const inParty = s.partyIds.includes(h.id);
  const sel = s.selectedHeroId === h.id;
  return `
    <button class="hero-chip ${sel ? "sel" : ""} ${inParty ? "in" : ""}" data-act="select" data-id="${h.id}">
      ${portraitHTML(h, 44)}
      <div class="who">
        <b>${esc(h.name)}</b>
        <small>${cls.name} · nvl ${h.level}${inParty ? " · en compañía" : ""}</small>
        ${hpBar(h)}
      </div>
    </button>
  `;
}

function posRange(ranks) {
  return (ranks || []).join("·") || "—";
}

function skillAim(sk) {
  const from = `Puesto ${posRange(sk.launch)}`;
  const t = sk.target?.type;
  if (t === "self") return `${from} → tú`;
  if (t === "allEnemies") return `${from} → todos los enemigos`;
  if (t === "allAllies") return `${from} → toda la compañía`;
  if (t === "ally") return `${from} → aliado ${posRange(sk.target.ranks)}`;
  return `${from} → enemigo ${posRange(sk.target.ranks)}`;
}

function rankPips(ranks, kind, here = 0, all = false) {
  const set = new Set(all ? [1, 2, 3, 4] : ranks || []);
  return [1, 2, 3, 4]
    .map(
      (n) =>
        `<i class="pip ${kind} ${set.has(n) ? "on" : ""} ${here === n ? "here" : ""}" title="Puesto ${n}">${n}</i>`,
    )
    .join("");
}

function skillAimVisual(sk, actorRank = 0) {
  const t = sk.target?.type;
  let targetLabel = "Enemigo";
  let targetPips = rankPips(sk.target?.ranks, "foe");
  if (t === "self") {
    targetLabel = "Tú";
    targetPips = `<i class="pip self on">tú</i>`;
  } else if (t === "allEnemies") {
    targetLabel = "Todos";
    targetPips = rankPips([1, 2, 3, 4], "foe", 0, true);
  } else if (t === "allAllies") {
    targetLabel = "Compañía";
    targetPips = rankPips([1, 2, 3, 4], "ally", 0, true);
  } else if (t === "ally") {
    targetLabel = "Aliado";
    targetPips = rankPips(sk.target.ranks, "ally");
  }
  return `<div class="aim-map" aria-hidden="true">
    <div class="aim-col"><span>Lanzas desde</span><div class="pips">${rankPips(sk.launch, "ally", actorRank)}</div></div>
    <b>→</b>
    <div class="aim-col"><span>Pega a ${targetLabel.toLowerCase()}</span><div class="pips">${targetPips}</div></div>
  </div>`;
}

function turnLine(s) {
  const c = s.combat;
  if (!c?.order?.length) return "";
  const units = [...(s.expedition?.party || []), ...(c.foes || [])];
  const cells = c.order.map((slot, i) => {
    const u = units.find((x) => x.id === slot.id);
    if (!u) return `<div class="turn-pip empty"></div>`;
    return `<div class="turn-pip ${i === c.turn ? "now" : ""} ${i < c.turn ? "done" : ""} ${
      u.enemy ? "foe" : "ally"
    } ${u.dead ? "dead" : ""}" title="${esc(u.name)}">
      ${portraitHTML(u, 28)}
      <em>${esc((u.name || "").split(" ")[0])}</em>
    </div>`;
  });
  while (cells.length < 8) cells.push(`<div class="turn-pip empty"></div>`);
  return `<div class="turn-line" aria-label="Orden de turno">
    <span class="turn-label">Turno · ronda ${c.round || 1}</span>
    <div class="turn-track">${cells.slice(0, 8).join("")}</div>
  </div>`;
}

function itemStats(item) {
  return Object.entries(item.stats)
    .map(([k, v]) => `${STAT_LABELS[k] || k} ${v > 0 ? "+" : ""}${v}`)
    .join(" · ");
}

function itemLine(item, actions = "") {
  const r = RARITIES[item.rarity];
  return `
    <div class="item ${item.fresh ? "fresh" : ""}">
      <div>
        <b class="r-${item.rarity}">${esc(item.name)}${item.fresh ? " · nuevo" : ""}</b>
        <div class="muted">${r.name} · ${item.slot} · ${itemStats(item)}</div>
      </div>
      <div>${actions}</div>
    </div>
  `;
}

function heroSheet(h) {
  if (!h) return `<div class="panel muted">Elige un caminante.</div>`;
  const cls = CLASSES[h.classId];
  const p = heroPower(h);
  const skills = h.skills.map((id) => skillFor(h, id)).filter(Boolean);
  const xpPct = Math.max(0, Math.min(100, Math.round(((h.xp || 0) / (h.xpToNext || 1)) * 100)));
  return `
    <div class="panel sheet">
      <div>
        ${portraitHTML(h, 120)}
        <div class="chips">
          <span class="chip">${cls.role}</span>
          <span class="chip">nvl ${h.level}</span>
        </div>
      </div>
      <div>
        <h3>${esc(h.name)}</h3>
        <p class="muted">${cls.name}. ${cls.blurb}</p>
        <div class="stat" style="margin-top:8px"><span>Experiencia</span><b>${h.xp || 0}/${h.xpToNext || 0}</b>${hpBar({ hp: xpPct, maxHp: 100 })}</div>
        <div class="stats" style="margin-top:10px">
          ${Object.entries({ str: p.str, mag: p.mag, vit: p.vit, agi: p.agi, spi: p.spi })
            .map(([k, v]) => `<div class="stat"><span>${STAT_LABELS[k]}</span><b>${v}</b></div>`)
            .join("")}
          <div class="stat"><span>Vitalidad</span><b>${h.hp}/${h.maxHp}</b></div>
        </div>
        <div class="slots">
          ${["weapon", "armor", "accessory"]
            .map((slot) => {
              const it = h.equipment[slot];
              return `<div class="slot"><span>${slot}</span><span>${
                it
                  ? `<b class="r-${it.rarity}">${esc(it.name)}</b>
                     <button class="btn ghost" data-act="unequip" data-slot="${slot}">Quitar</button>`
                  : "vacío"
              }</span></div>`;
            })
            .join("")}
        </div>
        <div class="chips" style="margin-top:10px">
          ${skills.map((sk) => `<span class="chip skill-chip" title="${esc(skillAim(sk) + " · " + sk.desc)}">${skillIconMarkup(sk, 22)}<span>${esc(sk.name)}</span>${skillAimVisual(sk)}</span>`).join("")}
        </div>
        <p class="muted" style="margin-top:8px;font-size:12px">Las artes indican puesto de lanzamiento y de objetivo. El 1 es la vanguardia.</p>
      </div>
    </div>
  `;
}

function townView(s) {
  const selected = s.roster.find((h) => h.id === s.selectedHeroId);
  return `
    <div class="shell">
      ${topbar(s, `<button class="btn ghost" data-act="title">Menú</button>`)}
      <div class="pad grid town-grid">
        <div class="grid">
          <div class="card">
            <div class="tag">La plaza</div>
            <h3>Aljama despierta</h3>
            <p>Recluta, arma la compañía de cuatro y elige un umbral. Si la incursión se pierde, los cuatro se quedan bajo la sal y el botín no vuelve.</p>
            ${s.levelQueue?.length ? `<p class="tag" style="margin-top:8px">${s.levelQueue.length} caminante(s) pueden mejorar un arte.</p>` : ""}
          </div>
          <div class="cards">
            <button class="card" data-act="go" data-screen="recruits">
              <div class="tag">Recinto</div>
              <h3>Reclutar</h3>
              <p>${s.recruits.length} caminantes esperan contrato.</p>
            </button>
            <button class="card" data-act="go" data-screen="roster">
              <div class="tag">Compañía</div>
              <h3>Formar los cuatro</h3>
              <p>${s.partyIds.filter((id) => s.roster.some((h) => h.id === id)).length}/4 listos para bajar.</p>
            </button>
            <button class="card" data-act="go" data-screen="inventory">
              <div class="tag">Almacén</div>
              <h3>Inventario</h3>
              <p>${s.inventory.length} piezas rescatadas. Equipa a quien elijas.</p>
            </button>
            <button class="card" data-act="go" data-screen="shop">
              <div class="tag">Bazar</div>
              <h3>Comprar y vender</h3>
              <p>${s.shop.length} puestos abiertos hoy.</p>
            </button>
            <button class="card" data-act="go" data-screen="map">
              <div class="tag">Umbrales</div>
              <h3>Elegir mazmorra</h3>
              <p>${s.cleared.length} templos sellados.</p>
            </button>
          </div>
        </div>
        <div class="grid">
          <div class="panel">
            <div class="row"><b>Caminantes en Aljama</b><span class="muted">toca para ver</span></div>
            <div class="hero-row" style="margin-top:10px">${s.roster.map((h) => heroChip(h, s)).join("")}</div>
          </div>
          ${heroSheet(selected)}
        </div>
      </div>
    </div>
  `;
}

function rosterView(s) {
  const selected = s.roster.find((h) => h.id === s.selectedHeroId);
  return `
    <div class="shell">
      ${topbar(s, `<button class="btn ghost" data-act="go" data-screen="town">Plaza</button>`)}
      <div class="pad grid">
        <div class="card">
          <div class="tag">Compañía</div>
          <h3>Cuatro nombres en el umbral</h3>
          <p>La posición importa. El 1 es la vanguardia; el 4, la retaguardia. Muchas artes solo se lanzan desde ciertos puestos.</p>
          <div class="party-slots" style="margin-top:12px">
            ${[0, 1, 2, 3]
              .map((i) => {
                const h = s.roster.find((x) => x.id === s.partyIds[i]);
                const canJoin = selected && !s.partyIds.includes(selected.id) && s.partyIds.filter((id) => s.roster.some((x) => x.id === id)).length < 4;
                return h
                  ? `<div class="pslot">${portraitHTML(h, 48)}<div><b>${esc(h.name)}</b><div class="muted">puesto ${i + 1} · ${className(h.classId)}</div>
                       <div class="center">
                         ${i > 0 ? `<button class="btn ghost" data-act="moveslot" data-from="${i}" data-to="${i - 1}">◀</button>` : ""}
                         <button class="btn ghost" data-act="toggle" data-id="${h.id}">Quitar</button>
                         ${i < s.partyIds.length - 1 ? `<button class="btn ghost" data-act="moveslot" data-from="${i}" data-to="${i + 1}">▶</button>` : ""}
                       </div></div></div>`
                  : `<button class="pslot empty" data-act="join" data-id="${selected?.id || ""}" ${canJoin ? "" : "disabled"}>
                       Puesto ${i + 1}<div class="muted">${canJoin ? `Meter a ${esc(selected.name)}` : "vacío"}</div>
                     </button>`;
              })
              .join("")}
          </div>
        </div>
        <div class="hero-row">${s.roster.map((h) => heroChip(h, s)).join("")}</div>
        <div class="row">
          <button class="btn ${s.partyIds.includes(s.selectedHeroId) ? "ghost" : ""}" data-act="${s.partyIds.includes(s.selectedHeroId) ? "toggle" : "join"}" data-id="${s.selectedHeroId || ""}" ${s.selectedHeroId ? "" : "disabled"}>
            ${s.partyIds.includes(s.selectedHeroId) ? "Sacar de la compañía" : "Meter en la compañía"}
          </button>
          ${s.roster.length > 1 ? `<button class="btn danger" data-act="dismiss" data-id="${s.selectedHeroId || ""}">Despedir</button>` : ""}
        </div>
        ${heroSheet(selected)}
      </div>
    </div>
  `;
}

function recruitsView(s) {
  return `
    <div class="shell">
      ${topbar(s, `<button class="btn ghost" data-act="go" data-screen="town">Plaza</button>`)}
      <div class="pad grid">
        <div class="card">
          <div class="tag">Recinto de contratos</div>
          <h3>Quién quiere bajar</h3>
          <p>Los rostros cambian cada vez que una compañía vuelve — o no vuelve.</p>
        </div>
        <div class="list">
          ${s.recruits
            .map((h) => {
              const cls = CLASSES[h.classId];
              return `
                <div class="item">
                  <div style="display:flex;gap:12px;align-items:center">
                    ${portraitHTML(h, 56)}
                    <div>
                      <b>${esc(h.name)}</b>
                      <div class="muted">${cls.name} · nvl ${h.level} · ${h.maxHp} vitalidad</div>
                    </div>
                  </div>
                  <button class="btn" data-act="recruit" data-id="${h.id}" ${s.gold < h.cost ? "disabled" : ""}>${h.cost} solis</button>
                </div>`;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function inventoryView(s) {
  const selected = s.roster.find((h) => h.id === s.selectedHeroId) || s.roster[0];
  return `
    <div class="shell">
      ${topbar(s, `<button class="btn ghost" data-act="go" data-screen="town">Plaza</button>`)}
      <div class="pad grid town-grid">
        <div class="grid">
          <div class="card">
            <div class="tag">Almacén de la caravana</div>
            <h3>Lo que volvió del velo</h3>
            <p>Elige un caminante a la derecha y equipa o quita piezas. El botín de las mazmorras se guarda aquí.</p>
          </div>
          <div class="list">
            ${
              s.inventory.length
                ? s.inventory
                    .map((it) =>
                      itemLine(
                        it,
                        `<button class="btn" data-act="equip" data-id="${it.id}" ${
                          selected && canEquip(selected, it) ? "" : "disabled"
                        }>Equipar a ${esc(selected?.name || "")}</button>`,
                      ),
                    )
                    .join("")
                : `<p class="muted">No hay piezas en el almacén. Baja a un umbral o compra en el bazar.</p>`
            }
          </div>
        </div>
        <div class="grid">
          <div class="hero-row">${s.roster.map((h) => heroChip(h, s)).join("")}</div>
          ${heroSheet(selected)}
        </div>
      </div>
    </div>
  `;
}

function shopView(s) {
  const selected = s.roster.find((h) => h.id === s.selectedHeroId) || s.roster[0];
  return `
    <div class="shell">
      ${topbar(s, `<button class="btn ghost" data-act="go" data-screen="town">Plaza</button>`)}
      <div class="pad grid town-grid">
        <div class="grid">
          <div class="card"><div class="tag">Bazar de teja</div><h3>Lo que brilla, se vende</h3>
            <p>Equipa al caminante elegido o vende el peso muerto. El bazar se renueva tras cada expedición.</p></div>
          <h3 class="serif">Almacén</h3>
          <div class="list">
            ${
              s.inventory.length
                ? s.inventory
                    .map((it) =>
                      itemLine(
                        it,
                        `<button class="btn ghost" data-act="equip" data-id="${it.id}" ${
                          selected && canEquip(selected, it) ? "" : "disabled"
                        }>Equipar</button>
                         <button class="btn ghost" data-act="sell" data-id="${it.id}">Vender ${Math.round(it.value * 0.55)}</button>`,
                      ),
                    )
                    .join("")
                : `<p class="muted">El almacén está vacío.</p>`
            }
          </div>
        </div>
        <div class="grid">
          <div class="hero-row">${s.roster.map((h) => heroChip(h, s)).join("")}</div>
          ${heroSheet(selected)}
          <h3 class="serif">Puestos del bazar</h3>
          <div class="list">
            ${s.shop
              .map(
                (it) =>
                  itemLine(
                    it,
                    `<button class="btn" data-act="buy" data-id="${it.id}" ${s.gold < it.value ? "disabled" : ""}>${it.value}</button>`,
                  ),
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function mapView(s) {
  return `
    <div class="shell">
      ${topbar(s, `<button class="btn ghost" data-act="go" data-screen="town">Plaza</button>`)}
      <div class="pad grid">
        <div class="card">
          <div class="tag">Mapa de umbrales</div>
          <h3>Tres templos bajo el velo</h3>
          <p>Necesitas exactamente cuatro caminantes. Si todos caen, mueren de verdad y el botín se pierde.</p>
        </div>
        ${
          s.cleared.length >= DUNGEONS.length
            ? `<div class="card">
                <div class="tag">Cierre</div>
                <h3>El velo se queda quieto</h3>
                <p>Has sellado los tres umbrales. Aljama ya no le debe una deuda al eclipse.</p>
                <div style="margin-top:12px"><button class="btn ok" data-act="ending">Leer el cierre</button></div>
              </div>`
            : ""
        }
        <div class="cards">
          ${DUNGEONS.map((d) => {
            const locked = d.unlock && !s.cleared.includes(d.unlock);
            const done = s.cleared.includes(d.id);
            return `
              <div class="card dungeon-card ${locked ? "locked" : ""}">
                <div class="tag">${d.tag}${done ? " · sellado" : ""}</div>
                <h3>${esc(d.name)}</h3>
                <p>${esc(d.blurb)}</p>
                <div class="chips">
                  <span class="chip">${d.rooms} salas</span>
                  <span class="chip">peligro ${d.danger}</span>
                </div>
                <div style="margin-top:12px">
                  <button class="btn" data-act="enter" data-id="${d.id}" ${
                    locked || !canEnterDungeon() ? "disabled" : ""
                  }>${locked ? "Aún cerrado" : "Adentrarse"}</button>
                </div>
              </div>`;
          }).join("")}
        </div>
        ${!canEnterDungeon() ? `<p class="muted">Forma una compañía de 4 en la plaza antes de bajar.</p>` : ""}
      </div>
    </div>
  `;
}

function dungeonView(s) {
  const ex = s.expedition;
  const d = DUNGEONS.find((x) => x.id === ex.dungeonId);
  const room = ex.rooms[ex.room];
  return `
    <div class="shell">
      ${topbar(s, `<span class="coin">Botín ${ex.gold} solis</span>`)}
      <div class="pad grid">
        <div class="card">
          <div class="tag">${esc(d.name)}</div>
          <h3>${room.cleared ? "Sala en calma" : "Ante la siguiente sala"}</h3>
          <p>${room.cleared
            ? "Revisa el saco, cambia equipo y puestos. Solo cuando estés listo, sigue adelante."
            : d.blurb}</p>
          <div class="rooms" style="margin-top:14px">
            ${ex.rooms
              .map((r, i) => {
                const cls = i === ex.room ? "now" : r.cleared ? "done" : "";
                const mark = r.type === "boss" ? "B" : r.type === "treasure" ? "○" : r.type === "shrine" ? "+" : String(i + 1);
                return `<div class="room-pip ${cls}">${mark}</div>`;
              })
              .join("")}
          </div>
        </div>
        <div class="hero-row">
          ${ex.party
            .map(
              (h, i) => `
            <div class="hero-chip ${s.selectedHeroId === h.id ? "sel" : ""} ${h.dead ? "dead" : ""}">
              <button class="hero-chip" data-act="select" data-id="${h.id}" style="border:none;background:transparent;padding:0;min-width:0">
                ${portraitHTML(h, 44)}
                <div class="who"><b>${esc(h.name)}</b><small>puesto ${i + 1} · ${className(h.classId)}</small>${hpBar(h)}</div>
              </button>
              <div class="center">
                ${i > 0 ? `<button class="btn ghost" data-act="swapex" data-from="${i}" data-to="${i - 1}">◀</button>` : ""}
                ${i < ex.party.length - 1 ? `<button class="btn ghost" data-act="swapex" data-from="${i}" data-to="${i + 1}">▶</button>` : ""}
              </div>
            </div>`,
            )
            .join("")}
        </div>
        ${heroSheet(ex.party.find((h) => h.id === s.selectedHeroId))}
        ${
          ex.loot.length
            ? `<div class="panel"><b>Saco de la incursión</b><div class="list" style="margin-top:8px">${ex.loot
                .map((it) =>
                  itemLine(it, `<button class="btn ghost" data-act="equip" data-id="${it.id}">Equipar</button>`),
                )
                .join("")}</div></div>`
            : ""
        }
        <div class="row">
          <button class="btn" data-act="${room.cleared ? "advance" : "begin"}">
            ${room.cleared ? (ex.room >= ex.rooms.length - 1 ? "Volver a Aljama" : "Sala siguiente") : "Entrar"}
          </button>
          <button class="btn danger" data-act="retreat">Huir (se pierde el botín)</button>
        </div>
      </div>
    </div>
  `;
}

function unitCard(unit, s, side) {
  const actor = currentActor();
  const c = s.combat;
  const skill = c.selectedSkill ? skillFor(actor || { enemy: false, skillRanks: {} }, c.selectedSkill) : null;
  let targetable = false;
  if (skill && c.phase === "target" && actor && !actor.enemy) {
    const allies = s.expedition.party;
    const foes = c.foes;
    const valid = validTargets(skill, allies, foes);
    targetable = valid.some((v) => v.id === unit.id);
  }
  const floater = (c.floaters || []).find((f) => f.id === unit.id);
  const statuses = (unit.statuses || [])
    .map((st) => {
      const label = EFFECT_LABELS[st.type] || st.type;
      return st.type === "crust" ? `${label} ${st.amount}/3` : label;
    })
    .join(" · ");
  const fxName = floater?.fx || floater?.kind || "hit";
  return `
    <button class="unit ${actor?.id === unit.id ? "actor" : ""} ${unit.dead ? "dead" : ""} ${
      targetable ? "targetable" : ""
    } ${(unit.statuses || []).some((st) => st.type === "taunt") ? "taunting" : ""}" data-act="${targetable ? "target" : "noop"}" data-id="${unit.id}" data-side="${side}">
      ${actor?.id === unit.id ? `<span class="circuit" aria-hidden="true"></span>` : ""}
      ${targetable ? `<span class="reticule" aria-hidden="true"><b></b><b></b><b></b><b></b><em></em></span>` : ""}
      <div class="rank">Puesto ${unit.rank || "—"} · ${(unit.rank || 9) <= 2 ? "frente" : "retaguardia"}</div>
      ${portraitHTML(unit, 92)}
      <b>${esc(unit.name)}</b>
      <small>${unit.enemy ? (unit.boss ? "Umbral" : "Bestia") : className(unit.classId)}</small>
      ${hpBar(unit, unit.enemy)}
      ${statuses ? `<div class="status-dot">${esc(statuses)}</div>` : ""}
      ${
        floater
          ? `<div class="vfx vfx-${fxName}" aria-hidden="true">
               <i></i><i></i><i></i><i></i><i></i><i></i>
               <span class="spark"></span><span class="spark"></span><span class="spark"></span>
               <span class="dust"></span>
             </div>
             <div class="floater ${floater.kind}">${
               floater.kind === "heal" ? "+" : floater.kind === "dodge" ? "falla" : floater.kind === "buff" ? "✦" : "-"
             }${floater.n || ""}</div>`
          : ""
      }
    </button>
  `;
}

function combatView(s) {
  const actor = currentActor();
  const party = s.expedition.party;
  const foes = s.combat.foes;
  const selected = s.combat.selectedSkill && actor ? skillFor(actor, s.combat.selectedSkill) : null;
  const skills =
    actor && !actor.enemy
      ? [...actor.skills.map((id) => skillFor(actor, id)), skillFor(actor, BASIC_SKILL.id)]
      : [];
  return `
    <div class="combat">
      ${topbar(s, `<span>${s.combat.isBoss ? "Jefe del umbral" : "Emboscada"}</span>`)}
      ${
        s.combat.hazard
          ? `<div class="hazard"><b>${esc(s.combat.hazard.name)}</b> — ${esc(s.combat.hazard.desc)} · Ronda ${s.combat.round || 1}. Acumula 3 costras en un enemigo para hacerlas estallar.</div>`
          : ""
      }
      ${s.combat.flash ? `<div class="fx-flash fx-${s.combat.flash.fx}">${esc(s.combat.flash.name)}</div>` : ""}
      ${turnLine(s)}
      <div class="field ${s.combat.phase === "target" ? "aiming" : ""} ${s.combat.flash ? `casting fx-${s.combat.flash.fx}` : ""}">
        <div class="aim-lattice" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="cast-stream" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="side party">${[...party].reverse().map((u) => unitCard(u, s, "party")).join("")}</div>
        <div class="midveil"></div>
        <div class="side foes">${foes.map((u) => unitCard(u, s, "foes")).join("")}</div>
      </div>
      <div class="log">${s.combat.log.map((l) => `<div>${esc(l)}</div>`).join("")}</div>
      <div class="skills">
        ${
          s.combat.phase === "target"
            ? `<p class="muted" style="padding:8px 0">Elige un objetivo iluminado (${esc(skillAim(selected || BASIC_SKILL))})</p>`
            : ""
        }
        ${
          actor && !actor.enemy && s.combat.phase === "select"
            ? skills
                .map((sk) => {
                  const ok = skillUsable(actor, sk, party);
                  return `<button class="skill ${s.combat.selectedSkill === sk.id ? "picked" : ""}" data-act="skill" data-id="${sk.id}" ${ok ? "" : "disabled"}>
                    ${skillIconMarkup(sk)}
                    <span class="skill-copy">
                      <b>${esc(sk.name)}</b>
                      ${skillAimVisual(sk, actor.rank)}
                      <span class="aim-text">${esc(skillAim(sk))}</span>
                      <span>${esc(sk.desc)}${ok ? "" : " · puesto inválido"}</span>
                    </span>
                  </button>`;
                })
                .join("")
            : s.combat.phase === "target"
              ? `${selected ? `<button class="skill picked" disabled>
                    ${skillIconMarkup(selected)}
                    <span class="skill-copy">
                      <b>${esc(selected.name)}</b>
                      ${skillAimVisual(selected, actor?.rank)}
                      <span class="aim-text">${esc(skillAim(selected))}</span>
                      <span>${esc(selected.desc)}</span>
                    </span>
                  </button>` : ""}
                  <button class="btn ghost" data-act="cancelskill">Cambiar arte</button>`
              : `<p class="muted" style="padding:8px 0">${
                  actor?.enemy ? `${esc(actor.name)} actúa...` : "La sal espera."
                }</p>`
        }
      </div>
    </div>
  `;
}

function victoryView(s) {
  const r = s.log || {};
  return `
    <section class="title-screen">
      <div>
        <div class="sun"></div>
        <h1>Regreso</h1>
        <p class="lead">El ${esc(r.dungeon || "umbral")} queda atrás. Aljama enciende faroles para los que volvieron.</p>
        <div class="panel" style="text-align:left;max-width:520px;margin:0 auto 18px">
          <p><b>+${r.gold || 0} solis</b></p>
          <p>${(r.survivors || []).map(esc).join("<br>")}</p>
          <div class="list" style="margin-top:8px">${(r.loot || []).map((i) => itemLine(i)).join("") || "<span class='muted'>Sin piezas nuevas.</span>"}</div>
        </div>
        <button class="btn ok" data-act="town">Volver a la plaza</button>
      </div>
    </section>
  `;
}

function endingView() {
  return `
    <section class="title-screen">
      <div>
        <div class="sun"></div>
        <h1>El velo se queda quieto</h1>
        <p class="lead">
          Los tres umbrales están sellados. El Templo de la Arena, los Jardines y el Núcleo
          ya no le deben una deuda al último eclipse. En Aljama encienden faroles de más:
          no por esperanza barata, sino porque alguien volvió con los nombres intactos.
        </p>
        <p class="lead">
          El desierto de cristal-arena sigue ahí. Mañana habrá otros contratos, otros cuatro
          y otra sala que se cierra. Pero hoy la ciudad puede decir que ganó.
        </p>
        <div class="center">
          <button class="btn ok" data-act="town">Volver a la plaza</button>
        </div>
      </div>
    </section>
  `;
}

function defeatView(s) {
  const names = Array.isArray(s.log) ? s.log : [];
  return `
    <section class="title-screen">
      <div>
        <h1>El velo se los queda</h1>
        <p class="lead">Los cuatro no vuelven. El botín se hunde con ellos. En Aljama hay que firmar nuevos contratos.</p>
        <p>${names.map(esc).join(" · ")}</p>
        <div class="center" style="margin-top:18px">
          <button class="btn" data-act="town">Volver a la plaza</button>
        </div>
      </div>
    </section>
  `;
}

function upgradeModal(q) {
  const hero = getState().roster.find((h) => h.id === q.heroId) || getState().expedition?.party.find((h) => h.id === q.heroId);
  const skills = (q.skills || []).map((id) => SKILLS[id]).filter(Boolean);
  return `<div class="modal-back"><div class="modal">
    <h2>${esc(q.name)} sube a nivel ${q.level}</h2>
    <p>Gana temple, vitalidad y su estadística principal. Elige un arte: verás exactamente qué cambia.</p>
    <div class="list">${skills
      .map((sk) => {
        const prev = hero ? skillUpgradePreview(hero, sk.id) : { lines: [] };
        return `<button class="item" data-act="upgrade" data-id="${sk.id}">
          <div style="display:flex;gap:10px;align-items:center">
            ${skillIconMarkup(sk, 36)}
            <div>
              <b>${esc(sk.name)}</b>
              ${skillAimVisual(sk)}
              <div class="muted">${esc(skillAim(sk))}</div>
              <div class="muted">${esc(prev.lines.join(" · ") || sk.desc)}</div>
            </div>
          </div>
        </button>`;
      })
      .join("")}</div>
  </div></div>`;
}

function modalView(s) {
  if (!s.modal && s.levelQueue?.length && s.screen !== "combat") {
    return upgradeModal(s.levelQueue[0]);
  }
  if (!s.modal) return "";
  const m = s.modal;
  const actions =
    m.kind === "confirm"
      ? `<div class="center"><button class="btn danger" data-act="confirm-retreat">Abandonar botín</button><button class="btn ghost" data-act="closemodal">Seguir dentro</button></div>`
      : m.kind === "ending"
        ? `<div class="center"><button class="btn ok" data-act="ending">Leer el cierre</button></div>`
      : m.kind === "loot"
        ? `<div class="center"><button class="btn" data-act="closemodal">Revisar botín y equipo</button></div>`
        : m.kind === "room"
        ? `<div class="center"><button class="btn" data-act="advance">${
            s.expedition && s.expedition.room >= s.expedition.rooms.length - 1 && s.expedition.rooms[s.expedition.room].cleared
              ? "Salir con el botín"
              : "Continuar"
          }</button></div>`
        : `<div class="center"><button class="btn" data-act="closemodal">Cerrar</button></div>`;
  return `<div class="modal-back"><div class="modal"><h2>${esc(m.title)}</h2><p>${esc(m.body)}</p>${actions}</div></div>`;
}

let lastFlash = null;
export function render() {
  const s = getState();
  if (!s) {
    app.className = "scene-title";
    app.innerHTML = titleView({ day: 1, gold: 0, roster: [] });
    return;
  }
  const views = {
    title: titleView,
    town: townView,
    roster: rosterView,
    recruits: recruitsView,
    shop: shopView,
    inventory: inventoryView,
    map: mapView,
    dungeon: dungeonView,
    combat: combatView,
    victory: victoryView,
    defeat: defeatView,
    ending: endingView,
  };
  const view = views[s.screen] || townView;
  app.className = `scene-${s.screen || "title"}`;
  app.innerHTML = view(s) + modalView(s);
  if (s.combat?.flash && s.combat.flash !== lastFlash) {
    lastFlash = s.combat.flash;
    sfx.fx(s.combat.flash.fx);
  }
}

let bound = false;
export function bind() {
  if (bound) return;
  bound = true;
  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    sfx.click();
    if (act === "new") createNewGame().screen && go("town");
    if (act === "continue") continueGame();
    if (act === "title") go("title");
    if (act === "go") go(el.dataset.screen);
    if (act === "select") selectHero(id);
    if (act === "toggle") toggleParty(id);
    if (act === "join") joinParty(id);
    if (act === "moveslot") movePartySlot(Number(el.dataset.from), Number(el.dataset.to));
    if (act === "swapex") swapExpedition(Number(el.dataset.from), Number(el.dataset.to));
    if (act === "recruit") recruitHero(id);
    if (act === "dismiss") dismissHero(id);
    if (act === "sell") sellItem(id);
    if (act === "buy") buyItem(id);
    if (act === "equip") {
      const s = getState();
      if (s.selectedHeroId) equipItem(s.selectedHeroId, id);
    }
    if (act === "unequip") unequipItem(getState().selectedHeroId, el.dataset.slot);
    if (act === "enter") startExpedition(id);
    if (act === "begin") beginRoom();
    if (act === "advance") advanceRoom();
    if (act === "retreat") retreatExpedition();
    if (act === "confirm-retreat") confirmRetreat();
    if (act === "closemodal") closeModal();
    if (act === "upgrade") pickUpgrade(id);
    if (act === "ending") openEnding();
    if (act === "skill") chooseSkill(id);
    if (act === "cancelskill") cancelSkill();
    if (act === "target") chooseTarget(id);
    if (act === "town") {
      if (getState().screen === "victory") sfx.win();
      if (getState().screen === "defeat") sfx.lose();
      backToTown();
    }
  });
}

"use strict";

const ML_PER_L = 1000;
const DEFAULT_DENSITY = 1.4;
const UNIT_LABEL = { L: "л", ml: "мл", kg: "кг", g: "г" };
const rowKey = (r) => `${r[0]}|${r[1]}|${r[4]}|${r[5]}`;

const state = {
  core: null,
  colorantById: null,
  formulasByProduct: {},
  currentFormulas: [],
  visibleColors: [],
};

const $ = (id) => document.getElementById(id);

function init() {
  const d = window.SPIVER_DATA;
  state.core = d;
  state.colorantById = Object.fromEntries(d.colorants.map((c) => [c.id, c]));
  $("dropVol").textContent = d.drop_ml.toFixed(4);
  $("verLabel").textContent = d.version;

  let totalFormulas = 0;
  let totalSubprods = 0;
  for (const p of d.products) {
    totalSubprods += p.subproducts.length;
    totalFormulas += p.subproducts.reduce((a, sp) => a + sp.n, 0);
  }
  $("totalFormulas").textContent = totalFormulas.toLocaleString("ru-RU");
  $("totalSubprods").textContent = totalSubprods;
  $("totalProducts").textContent = d.products.length;

  fillSelect($("product"), d.products, (p) => ({ value: p.id, textContent: `${p.code} — ${p.descr}` }));

  $("product").addEventListener("change", onProductChange);
  $("subproduct").addEventListener("change", onSubproductChange);
  $("subproductSearch").addEventListener("input", refreshSubproductList);
  $("series").addEventListener("change", refreshColorList);
  $("search").addEventListener("input", refreshColorList);
  $("color").addEventListener("change", onColorChange);
  $("calc").addEventListener("click", calculate);

  onProductChange();
}

function fillSelect(sel, items, toOption) {
  sel.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const o = document.createElement("option");
    Object.assign(o, toOption(it));
    frag.append(o);
  }
  sel.append(frag);
}

function swatchEl(hex) {
  const s = document.createElement("span");
  s.className = "swatch";
  s.style.background = hex;
  return s;
}

function currentProduct() {
  return state.core.products.find((p) => p.id === $("product").value);
}

function currentSubproduct() {
  const p = currentProduct();
  return p?.subproducts.find((sp) => sp.id === $("subproduct").value);
}

function onProductChange() {
  const p = currentProduct();
  $("subproductSearch").value = "";
  refreshSubproductList();
  ensureProductLoaded(p.id).then(onSubproductChange);
}

function refreshSubproductList() {
  const p = currentProduct();
  const q = $("subproductSearch").value.trim().toLowerCase();
  const prev = $("subproduct").value;
  const matches = p.subproducts.filter((sp) =>
    !q || sp.code.toLowerCase().includes(q) || sp.descr.toLowerCase().includes(q)
  );
  fillSelect($("subproduct"), matches, (sp) => ({
    value: sp.id,
    textContent: `${sp.code} — ${sp.descr} (${sp.n})`,
  }));
  const stillSelectable = matches.find((sp) => sp.id === prev);
  $("subproduct").value = stillSelectable ? prev : (matches[0]?.id ?? "");
  if (!stillSelectable && matches.length) onSubproductChange();
}

async function ensureProductLoaded(prd_id) {
  if (state.formulasByProduct[prd_id]) return;
  $("loadStatus").textContent = `Загрузка формул…`;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `formulas/p${prd_id}.js?v=${encodeURIComponent(state.core.version)}`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
  state.formulasByProduct[prd_id] = window[`SPIVER_FORMULAS_P${prd_id}`];
  $("loadStatus").textContent = "";
}

function onSubproductChange() {
  const p = currentProduct();
  const sp = currentSubproduct();
  if (!p || !sp) return;
  const rows = state.formulasByProduct[p.id] || [];
  // row = [sp_id, key1, key2, key3, base_id, can_id, formula, rgb]
  state.currentFormulas = rows.filter((r) => r[0] === sp.id);
  const series = [...new Set(state.currentFormulas.map((r) => r[3]).filter(Boolean))].sort();
  fillSelect($("series"), [{ v: "", t: "— все коллекции —" }, ...series.map((s) => ({ v: s, t: s }))], (o) => ({
    value: o.v,
    textContent: o.t,
  }));

  const baseInfo = lookupBase(p.id, sp.id, state.currentFormulas[0]?.[4]);
  if (baseInfo?.density) $("density").value = baseInfo.density.toFixed(2);
  refreshColorList();
}

function refreshColorList() {
  const q = $("search").value.trim().toLowerCase();
  const series = $("series").value;
  const matches = state.currentFormulas.filter((r) => {
    if (series && r[3] !== series) return false;
    if (q && !r[1].toLowerCase().includes(q) && !(r[2] || "").toLowerCase().includes(q)) return false;
    return true;
  });
  state.visibleColors = matches.slice(0, 2000);
  fillSelect($("color"), state.visibleColors, (r) => {
    const name = r[2] ? `${r[1]} · ${r[2]}` : r[1];
    return { value: rowKey(r), textContent: name + (r[3] ? ` — ${r[3]}` : "") };
  });
}

function toMl(amount, unit, density) {
  switch (unit) {
    case "L": return amount * ML_PER_L;
    case "ml": return amount;
    case "kg": return (amount * ML_PER_L) / density;
    case "g": return amount / density;
    default: return 0;
  }
}

function rgbToHex(rgb) {
  return rgb ? "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("") : null;
}

function selectedRow() {
  const key = $("color").value;
  return state.visibleColors.find((r) => rowKey(r) === key);
}

function onColorChange() {
  const row = selectedRow();
  const hex = rgbToHex(row?.[7]);
  document.body.style.setProperty("--selected-color", hex || "transparent");
  document.body.classList.toggle("has-color", !!hex);
}

function lookupBase(prd_id, sp_id, base_id) {
  if (!base_id) return null;
  const bases = state.core.bases;
  return bases[`${prd_id}:${sp_id}:${base_id}`]
      || bases[`${prd_id}::${base_id}`]
      || bases[`::${base_id}`]
      || null;
}

function parseFormula(str) {
  return str.split(";").map((part) => {
    const [cid, amt] = part.split(":");
    return { cid, amount: parseFloat(amt) };
  });
}

function calculate() {
  const row = selectedRow();
  if (!row) return;
  const [, key1, key2, key3, base_id, can_id, fstr, rgb] = row;

  const amount = parseFloat($("amount").value);
  if (!(amount > 0)) return;
  const unit = $("unit").value;
  const density = parseFloat($("density").value) || DEFAULT_DENSITY;

  const can = state.core.cans[can_id];
  if (!can) return;
  const targetMl = toMl(amount, unit, density);
  const targetG = targetMl * density;
  const factor = can.kind === "mass" ? targetG / can.amount : targetMl / can.amount;
  const items = parseFormula(fstr);

  const tbody = $("result").querySelector("tbody");
  tbody.innerHTML = "";
  const totals = { drops: 0, ml: 0, g: 0 };

  for (const it of items) {
    const c = state.colorantById[it.cid];
    const drops = it.amount * factor;
    const ml = drops * state.core.drop_ml;
    const g = ml * (c?.density ?? DEFAULT_DENSITY);
    totals.drops += drops;
    totals.ml += ml;
    totals.g += g;
    tbody.append(renderRow(c?.code ?? it.cid, c?.descr ?? "—", c?.hex ?? "#ccc", drops, ml, g));
  }

  $("totDrops").textContent = totals.drops.toFixed(1);
  $("totMl").textContent = totals.ml.toFixed(2);
  $("totG").textContent = totals.g.toFixed(2);

  const hex = rgbToHex(rgb) ?? "#bbb";
  const nameParts = [key1, key2].filter(Boolean).join(" · ");
  const nameCell = $("resColorName");
  nameCell.innerHTML = "";
  nameCell.append(swatchEl(hex), document.createTextNode(nameParts + (key3 ? ` — ${key3}` : "")));

  $("resLabel").textContent = `${amount} ${UNIT_LABEL[unit]}`;
  const sp = currentSubproduct();
  const prd = currentProduct();
  $("resProduct").textContent = `${prd.code} / ${sp.code} — ${sp.descr}`;
  const base = lookupBase(prd.id, sp.id, base_id);
  $("baseName").textContent = base ? `${base.code} — ${base.descr}` : `#${base_id}`;
  $("canName").textContent = can.descr;
  $("colorSwatch").style.background = hex;

  const card = $("resultCard");
  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRow(code, name, hex, drops, ml, g) {
  const tr = document.createElement("tr");
  const tdCode = document.createElement("td");
  tdCode.append(swatchEl(hex), document.createTextNode(code));
  const tdName = document.createElement("td");
  tdName.textContent = name;
  const cells = [drops.toFixed(1), ml.toFixed(2), g.toFixed(2)].map((v) => {
    const td = document.createElement("td");
    td.className = "num";
    td.textContent = v;
    return td;
  });
  tr.append(tdCode, tdName, ...cells);
  return tr;
}

init();

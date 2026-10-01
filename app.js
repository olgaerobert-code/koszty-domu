(() => {
/* Baza: ten sam projekt Supabase co aplikacja treningowa. Klucz publikowalny jest jawny
   z założenia; tabele są zamknięte, a funkcje wymagają kodu domu (supabase.sql).
   Kod jest wspólny i wpisany tutaj, więc każde urządzenie działa od razu.
   Świadomy wybór Roberta: kto zajrzy w źródło, może czytać i pisać. */
const SB_URL = "https://jvbdodnoxzowviqwhzfr.supabase.co";
const SB_KEY = "sb_publishable_RYMFMP8_vAaRy6vfgUFhjQ_qqhkOdr8";
const KOD_DOMU = "DOM-QEBE-TX5R-NX2H";
const PUSTE = { wersja: 2, ustawienia: { pomieszczenia: [{ id: "caly-dom", nazwa: "Cały dom" }], kategorie: [{ id: "inne", nazwa: "Inne" }] }, pozycje: [], platnosci: [] };

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const f0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zl = (gr) => f0.format(Math.round((gr || 0) / 100)) + " zł";
const zl2 = (gr) => f2.format((gr || 0) / 100) + " zł";
const pad = (n) => String(n).padStart(2, "0");
const dzis = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const MIES = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MIES_K = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
const noweId = (lista, nazwa) => { let b = slug(nazwa), id = b, i = 2; while (lista.some((x) => x.id === id)) id = b + "-" + i++; return id; };
const losoweId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const klon = (o) => JSON.parse(JSON.stringify(o));
const dataPL = (d) => d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}` : "—";

function parseKwota(s) {
  s = String(s ?? "").replace(/zł|pln/gi, "").replace(/[\s  ']/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/* ---------- Supabase jako baza ---------- */
const b64enc = (bytes) => { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = (s) => Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0));

async function rpc(fn, body) {
  let r;
  try {
    r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_key: KOD_DOMU, ...body }) });
  } catch { throw { code: "siec" }; }
  if (r.status === 404) throw { code: "brak-bazy", status: 404 };
  if (!r.ok) throw { code: "inny", status: r.status };
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
function normalizuj(d) {
  d.ustawienia ??= klon(PUSTE.ustawienia);
  d.ustawienia.pomieszczenia ??= []; d.ustawienia.kategorie ??= []; d.ustawienia.pakiety ??= [];
  d.pozycje ??= []; d.platnosci ??= [];
  return d;
}
async function pobierz() {
  const rows = await rpc("koszty_pull", {});
  if (!rows?.length) return { wersja: 0, dane: klon(PUSTE) };
  return { wersja: Number(rows[0].wersja), dane: normalizuj(rows[0].dane) };
}
let kolejka = Promise.resolve();
function wKolejce(fn) { const p = kolejka.then(fn); kolejka = p.catch(() => {}); return p; }
let zajete = 0;
/* zmien(opis, fn): fn zmienia kopię danych; baza przyjmuje zapis tylko na aktualnej wersji,
   a przy konflikcie dane są pobierane ponownie i zmiana nakładana jeszcze raz */
function zmien(opis, fn) {
  return wKolejce(async () => {
    zajete++; sync("saving", "Zapisywanie…");
    try {
      for (let proba = 0; proba < 4; proba++) {
        const draft = klon(S.dane);
        fn(draft);
        const w = Number(await rpc("koszty_push", { p_dane: draft, p_wersja: S.wersja, p_opis: opis }));
        if (w > 0) { S.wersja = w; ustawDane(draft); sync("ok", "Zapisano"); return; }
        const p = await pobierz(); S.wersja = p.wersja; ustawDane(p.dane);
      }
      throw { code: "konflikt" };
    } finally { zajete--; }
  });
}
function wgrajPlik(id, bytes, typ) {
  return wKolejce(() => rpc("koszty_plik_push", { p_id: id, p_typ: typ, p_dane: b64enc(bytes) }));
}
function usunPlik(id) {
  return wKolejce(() => rpc("koszty_plik_usun", { p_id: id })).catch(() => {});
}
const bloby = new Map();
function blobUrl(id) {
  if (!bloby.has(id)) bloby.set(id, rpc("koszty_plik_pull", { p_id: id }).then((rows) => {
    if (!rows?.length) throw 0;
    return URL.createObjectURL(new Blob([b64dec(rows[0].dane)], { type: rows[0].typ }));
  }).catch((e) => { bloby.delete(id); throw e; }));
  return bloby.get(id);
}

/* ---------- stan ---------- */
const S = {
  dane: null, wersja: 0, gotowe: false, blad: "", calc: null,
  view: "podsumowanie",
  fp: { q: "", pom: "", kat: "", stan: "", pak: "" },
  fl: { q: "", pom: "", gdzie: "" },
  sheet: null, usuwanie: null,
};
const WIDOKI = ["podsumowanie", "pozycje", "platnosci", "ustawienia"];
function ustawDane(d) { S.dane = d; S.gotowe = true; S.calc = null; render(); }
const pom = () => S.dane?.ustawienia.pomieszczenia || [];
const kat = () => S.dane?.ustawienia.kategorie || [];
const pak = () => S.dane?.ustawienia.pakiety || [];
const nazwaPak = (id) => pak().find((p) => p.id === id)?.nazwa || "";
/* słowniki: pomieszczenia, kategorie i pakiety; pole = nazwa pola w pozycji */
const SLOWNIK = { pom: { klucz: "pomieszczenia", pole: "pom", nazwa: "pomieszczenie" }, kat: { klucz: "kategorie", pole: "kat", nazwa: "kategorię" }, pak: { klucz: "pakiety", pole: "pakiet", nazwa: "pakiet" } };
const slownik = (typ) => S.dane?.ustawienia[SLOWNIK[typ].klucz] || [];
const pozycje = () => S.dane?.pozycje || [];
const platnosci = () => S.dane?.platnosci || [];
const nazwaPom = (id) => pom().find((p) => p.id === id)?.nazwa || "Bez pomieszczenia";
const nazwaKat = (id) => kat().find((k) => k.id === id)?.nazwa || "Bez kategorii";
const poz = (id) => pozycje().find((p) => p.id === id);

/* Plan obejmuje to, co już zapłacone: pozycja ma do zapłaty plan minus zapłacone (zakończona: nic) */
function licz() {
  if (S.calc) return S.calc;
  const m = new Map();
  for (const p of pozycje()) m.set(p.id, { p, zapl: 0, n: 0 });
  for (const pl of platnosci()) { const x = m.get(pl.pozycja); if (x) { x.zapl += pl.kwotaGr || 0; x.n++; } }
  for (const x of m.values()) {
    x.plan = x.p.planGr || 0;
    x.zostalo = x.p.zakonczona ? 0 : Math.max(x.plan - x.zapl, 0);
    x.ponad = x.plan > 0 && x.zapl > x.plan;
    x.bezPlanu = !x.plan;
  }
  /* Pakiet (np. Kazik: robocizna + materiały) liczy budżet wspólnie: zostało = suma planów − suma wpłat
     (nie więcej niż suma tego, co zostało w pozycjach). Kwota jest rozkładana na pozycje proporcjonalnie,
     żeby sumy pomieszczeń i kategorii się zgadzały. Pojedyncza pozycja w pakiecie nie jest „ponad planem”. */
  S.pakiety = new Map();
  for (const pk of pak()) {
    const xs = [...m.values()].filter((x) => x.p.pakiet === pk.id);
    if (!xs.length) continue;
    const plan = xs.reduce((a, x) => a + x.plan, 0), zapl = xs.reduce((a, x) => a + x.zapl, 0), ind = xs.reduce((a, x) => a + x.zostalo, 0);
    const zostalo = Math.min(Math.max(plan - zapl, 0), ind);
    let reszta = zostalo;
    const otwarte = xs.filter((x) => x.zostalo > 0).sort((a, b) => b.zostalo - a.zostalo);
    otwarte.forEach((x, i) => { const v = i === otwarte.length - 1 ? reszta : Math.round((x.zostalo * zostalo) / ind); x.zostalo = v; reszta -= v; });
    for (const x of xs) { x.ponad = false; x.bezPlanu = false; x.wPakiecie = pk; }
    S.pakiety.set(pk.id, { pk, xs, plan, zapl, zostalo, ponad: zapl > plan });
  }
  S.calc = m;
  return m;
}
function suma(lista) {
  const s = { plan: 0, zapl: 0, zostalo: 0, n: 0 };
  for (const x of lista) { s.plan += x.plan; s.zapl += x.zapl; s.zostalo += x.zostalo; s.n++; }
  return s;
}
const wykonczenie = () => [...licz().values()].filter((x) => !x.p.zakup);
const zakup = () => [...licz().values()].filter((x) => x.p.zakup);

/* ---------- komunikaty ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200); }
function sync(s, txt) { const e = $("#sync"); e.dataset.s = s; e.textContent = txt; }
function bladZapisu(e) {
  const c = e?.code;
  if (c === "siec") { sync("err", "Brak internetu"); toast("Brak połączenia z internetem. Nic nie zostało zapisane."); return; }
  if (c === "brak-bazy") { sync("err", "Baza nieprzygotowana"); toast("Baza nie jest przygotowana. Trzeba uruchomić supabase.sql w Supabase."); return; }
  if (c === "konflikt") { sync("err", "Nie zapisano"); toast("Ktoś zapisywał w tym samym czasie. Spróbuj jeszcze raz."); return; }
  sync("err", "Nie zapisano"); toast("Nie udało się zapisać. Spróbuj ponownie.");
}

/* ---------- elementy wspólne ---------- */
function tasma(zapl, zostalo, plan, skala) {
  const max = Math.max(plan || 0, zapl + zostalo, skala || 0, 1);
  const pw = (zapl / max) * 100, ph = (zostalo / max) * 100;
  let h = `<div class="tape" role="img" aria-label="Zapłacone ${zl(zapl)}, zostało ${zl(zostalo)}${plan ? ", plan " + zl(plan) : ""}">`;
  if (zapl) h += `<span class="p" style="width:${pw}%"></span>`;
  if (zostalo) h += `<span class="h" style="left:calc(${pw}% + ${zapl ? 2 : 0}px);width:max(0px,calc(${ph}% - ${zapl ? 2 : 0}px))"></span>`;
  if (plan && zapl + zostalo > plan) h += `<span class="lim" style="left:calc(${(plan / max) * 100}% - 1px)"></span>`;
  return h + "</div>";
}
function pigulka(x) {
  if (x.wPakiecie) return `<span class="pill mut">pakiet: ${esc(x.wPakiecie.nazwa)}</span>`;
  if (x.p.zakonczona) return `<span class="pill ok">zakończone</span>`;
  if (x.ponad) return `<span class="pill bad">ponad plan o ${zl(x.zapl - x.plan)}</span>`;
  if (x.bezPlanu) return `<span class="pill mut">z budżetu ogólnego</span>`;
  if (!x.zapl) return `<span class="pill mut">nic nie zapłacono</span>`;
  return "";
}
const legenda = `<div class="overall-legend"><span class="key"><i></i>zapłacone</span><span class="key"><i class="h"></i>zostało do zapłaty</span><span class="key"><i class="l"></i>plan (gdy przekroczony)</span></div>`;
function opcje(lista, wybrane, pusta, bez) {
  return (pusta ? `<option value="">${pusta}</option>` : "") + lista.map((x) => `<option value="${esc(x.id)}" ${x.id === wybrane ? "selected" : ""}>${esc(x.nazwa)}</option>`).join("") + (bez ? `<option value="-" ${wybrane === "-" ? "selected" : ""}>${bez}</option>` : "");
}
function opcjePoz(wyb) {
  const o = (p) => `<option value="${esc(p.id)}" ${p.id === wyb ? "selected" : ""}>${esc(p.nazwa)}${p.pakiet && nazwaPak(p.pakiet) ? ` (pakiet ${esc(nazwaPak(p.pakiet))})` : ""}</option>`;
  let h = `<option value="">— wybierz pozycję —</option>`;
  for (const r of pom()) {
    const ps = pozycje().filter((p) => !p.zakup && p.pom === r.id);
    if (ps.length) h += `<optgroup label="${esc(r.nazwa)}">${ps.map(o).join("")}</optgroup>`;
  }
  const sieroty = pozycje().filter((p) => !p.zakup && !pom().some((r) => r.id === p.pom));
  if (sieroty.length) h += `<optgroup label="Bez pomieszczenia">${sieroty.map(o).join("")}</optgroup>`;
  const zk = pozycje().filter((p) => p.zakup);
  if (zk.length) h += `<optgroup label="Zakup domu">${zk.map(o).join("")}</optgroup>`;
  return h;
}
const wykonawcy = () => [...new Set(platnosci().map((p) => p.gdzie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));

/* ---------- podsumowanie ---------- */
function niceStep(max) {
  const raw = max / 3, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
const krotko = (v) => v >= 1000 ? (Math.round(v / 100) / 10).toLocaleString("pl-PL") + " tys." : f0.format(v) + " zł";
function wykresMiesieczny() {
  const zPoz = new Set(pozycje().filter((p) => !p.zakup).map((p) => p.id));
  const lista = platnosci().filter((w) => w.data && zPoz.has(w.pozycja));
  const bezDaty = platnosci().filter((w) => !w.data && zPoz.has(w.pozycja)).reduce((a, w) => a + (w.kwotaGr || 0), 0);
  const nota = bezDaty ? `<p class="hint" style="margin:10px 0 0">Bez daty (przeniesione z arkusza): ${zl(bezDaty)}, nie ma ich na wykresie.</p>` : "";
  if (!lista.length) return `<p class="hint" style="margin:0">Wykres pojawi się, gdy dodasz płatności z datą.</p>${nota}`;
  const m = {};
  for (const w of lista) { const k = w.data.slice(0, 7); m[k] = (m[k] || 0) + (w.kwotaGr || 0); }
  const keys = Object.keys(m).sort();
  let [y, mo] = keys[0].split("-").map(Number);
  const now = new Date(), endY = now.getFullYear(), endM = now.getMonth() + 1;
  const last = keys[keys.length - 1].split("-").map(Number);
  const [ly, lm] = (last[0] * 12 + last[1] > endY * 12 + endM) ? last : [endY, endM];
  const mies = [];
  while (y * 12 + mo <= ly * 12 + lm) { mies.push(`${y}-${pad(mo)}`); mo++; if (mo > 12) { mo = 1; y++; } }
  const pokaz = mies.slice(-18);
  const vals = pokaz.map((k) => (m[k] || 0) / 100);
  const vmax = Math.max(...vals, 1), step = niceStep(vmax), top = Math.ceil(vmax / step) * step;
  const imax = vals.indexOf(Math.max(...vals));
  let gl = "";
  for (let v = 0; v <= top + 0.001; v += step) gl += `<div class="gl" style="bottom:${(v / top) * 190}px"><span>${f0.format(v >= 1000 ? v / 1000 : v)}${v >= 1000 ? " tys." : ""}</span></div>`;
  const cols = pokaz.map((k, i) => {
    const [yy, mm] = k.split("-");
    const tip = `${MIES[+mm - 1]} ${yy}: ${zl(m[k] || 0)}`;
    const lab = (i === imax || i === pokaz.length - 1) && vals[i] ? `<em style="bottom:${(vals[i] / top) * 100}%">${krotko(vals[i])}</em>` : "";
    return `<div class="c" data-tip="${esc(tip)}">${lab}<b style="height:${(vals[i] / top) * 100}%"></b></div>`;
  }).join("");
  const xl = pokaz.map((k, i) => { const [yy, mm] = k.split("-"); return `<span>${MIES_K[+mm - 1]}${mm === "01" || i === 0 ? " " + yy.slice(2) : ""}</span>`; }).join("");
  return `<div class="chart-wrap"><div class="chart-inner"><div class="chart"><div class="plot">${gl}<div class="cols">${cols}</div></div><div class="xl">${xl}</div></div></div></div>${nota}`;
}
function wierszGrupy(attr, id, nazwa, s, skala) {
  const over = s.plan && s.zapl > s.plan;
  const pill = over ? `<span class="pill bad">ponad plan o ${zl(s.zapl - s.plan)}</span>` : s.zostalo ? `<span class="pill mut">zostało ${zl(s.zostalo)}</span>` : `<span class="pill ok">zapłacone</span>`;
  return `<button class="row" type="button" ${attr}="${esc(id)}"><span class="n">${esc(nazwa)}</span><span class="a num">${zl(s.zapl)} <span style="color:var(--muted)">/ ${zl(s.plan)}</span></span>
    ${tasma(s.zapl, s.zostalo, s.plan, skala)}<span class="m"><span>${s.n} poz.</span>${pill}</span></button>`;
}
function renderPodsumowanie() {
  const el = $("#v-podsumowanie");
  if (!S.gotowe) { el.innerHTML = `<div class="banner">Wczytywanie danych z GitHuba…</div>`; return; }
  const w = wykonczenie(), s = suma(w), sz = suma(zakup());
  const wBudzecie = s.plan - s.zapl, brak = s.zostalo - wBudzecie;
  let h = `<div class="kpis">
    <div class="kpi"><span class="lbl">Budżet wykończenia</span><span class="v num">${zl(s.plan)}</span><span class="d">suma planów ${s.n} pozycji</span></div>
    <div class="kpi"><span class="lbl">Zapłacone</span><span class="v num">${zl(s.zapl)}</span><span class="d">${s.plan ? Math.round((s.zapl / s.plan) * 100) + "% budżetu" : "&nbsp;"}</span></div>
    <div class="kpi"><span class="lbl">Zostało w budżecie</span><span class="v num ${wBudzecie < 0 ? "neg" : ""}">${zl(wBudzecie)}</span><span class="d">budżet minus zapłacone</span></div>
    <div class="kpi"><span class="lbl">Do zapłaty wg pozycji</span><span class="v num ${brak > 0 ? "neg" : ""}">${zl(s.zostalo)}</span><span class="d">${brak > 0 ? `o ${zl(brak)} więcej, niż zostało` : brak < 0 ? `zapas ${zl(-brak)}` : "równo z budżetem"}</span></div>
  </div>`;
  if (!s.n) {
    el.innerHTML = h + `<div class="panel empty"><h3>Brak pozycji</h3><p>Dodaj pierwszą pozycję, np. „Meble kuchnia” z planowaną kwotą, a potem podpinaj pod nią płatności.</p><button class="btn pri" type="button" data-nowa-poz>+ Nowa pozycja</button></div>`;
    return;
  }
  h += `<div class="panel overall"><div class="lbl">Wykończenie · budżet ${zl(s.plan)}${sz.n ? ` · razem z zakupem domu ${zl(s.plan + sz.zapl)}` : ""}</div>${tasma(s.zapl, Math.max(wBudzecie, 0), s.plan)}${legenda}
    ${brak > 0 ? `<p class="hint" style="margin:0">Otwarte pozycje potrzebują jeszcze ${zl(s.zostalo)}, a w budżecie zostało ${zl(wBudzecie)}. Różnicę ${zl(brak)} tworzą płatności z pozycji bez własnego planu: ${w.filter((x) => x.bezPlanu && x.zapl).map((x) => esc(x.p.nazwa)).join(", ")}. Jeśli te pieniądze były w planach innych pozycji, przepnij płatności do tamtych pozycji.</p>` : ""}</div>`;

  const grupy = (klucz, lista) => {
    const g = new Map();
    for (const x of w) { const k = lista.some((r) => r.id === x.p[klucz]) ? x.p[klucz] : ""; if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
    return [...g.entries()].map(([id, xs]) => ({ id, s: suma(xs) })).sort((a, b) => (b.s.plan || b.s.zapl) - (a.s.plan || a.s.zapl));
  };
  const gp = grupy("pom", pom()), gk = grupy("kat", kat());
  const maxP = Math.max(...gp.map((g) => Math.max(g.s.plan, g.s.zapl)), 1), maxK = Math.max(...gk.map((g) => Math.max(g.s.plan, g.s.zapl)), 1);
  h += `<div class="grid2">
    <div class="panel"><h2>Pomieszczenia</h2><div class="rows">${gp.map((g) => wierszGrupy("data-fpom", g.id || "-", g.id ? nazwaPom(g.id) : "Bez pomieszczenia", g.s, maxP)).join("")}</div></div>
    <div class="panel"><h2>Kategorie</h2><div class="rows">${gk.map((g) => wierszGrupy("data-fkat", g.id || "-", g.id ? nazwaKat(g.id) : "Bez kategorii", g.s, maxK)).join("")}</div></div>
  </div>`;

  licz();
  const pakietyL = [...S.pakiety.values()];
  if (pakietyL.length) h += `<div class="panel"><h2>Pakiety</h2><div class="rows">${pakietyL.map((g) => wierszPakietu(g)).join("")}</div><p class="hint" style="margin:8px 0 0">Pakiet liczy budżet wspólnie dla kilku pozycji, więc wpłat nie trzeba dzielić między nie.</p></div>`;
  const uwagi = w.filter((x) => x.ponad || (x.bezPlanu && x.zapl)).sort((a, b) => b.zapl - a.zapl);
  for (const g of pakietyL) if (g.ponad) uwagi.unshift({ p: { id: "", nazwa: "Pakiet: " + g.pk.nazwa, pom: "" }, zapl: g.zapl, plan: g.plan, pakiet: g });
  const wyk = new Map();
  for (const pl of platnosci()) if (pl.gdzie && !poz(pl.pozycja)?.zakup) wyk.set(pl.gdzie, (wyk.get(pl.gdzie) || 0) + (pl.kwotaGr || 0));
  const wykL = [...wyk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  h += `<div class="grid2">
    <div class="panel"><h2>Wymaga uwagi</h2>${uwagi.length ? `<div class="rows">${uwagi.map((x) => x.pakiet ? `<button class="row" type="button" data-fpak="${esc(x.pakiet.pk.id)}"><span class="n">${esc(x.p.nazwa)}</span><span class="a num">${zl(x.zapl)}</span><span class="m"><span>${x.pakiet.xs.length} pozycji</span><span class="pill bad">ponad plan o ${zl(x.zapl - x.plan)}</span></span></button>` : `<button class="row" type="button" data-poz="${esc(x.p.id)}"><span class="n">${esc(x.p.nazwa)}</span><span class="a num">${zl(x.zapl)}</span><span class="m"><span>${esc(nazwaPom(x.p.pom))}</span>${pigulka(x)}</span></button>`).join("")}</div><p class="hint" style="margin:8px 0 0">Pozycje ponad planem i płatności spoza planów pozycji. Wszystkie schodzą z budżetu ogólnego.</p>` : `<p class="hint" style="margin:0">Wszystkie płatności mieszczą się w planach pozycji.</p>`}</div>
    <div class="panel"><h2>Wykonawcy i sklepy</h2>${wykL.length ? `<div class="rows">${wykL.map(([g, k]) => `<button class="row" type="button" data-fgdzie="${esc(g)}"><span class="n">${esc(g)}</span><span class="a num">${zl(k)}</span></button>`).join("")}</div>` : `<p class="hint" style="margin:0">Pojawią się, gdy przy płatnościach wpiszesz sklep albo wykonawcę.</p>`}</div>
  </div>`;
  h += `<div class="panel"><h2>Płatności w miesiącach</h2>${wykresMiesieczny()}</div>`;
  if (sz.n) h += `<div class="panel"><h2>Zakup domu</h2><div class="rows">${zakup().map((x) => `<button class="row" type="button" data-poz="${esc(x.p.id)}"><span class="n">${esc(x.p.nazwa)}</span><span class="a num">${zl(x.zapl)}</span></button>`).join("")}</div><p class="hint" style="margin:8px 0 0">Razem <strong class="num">${zl(sz.zapl)}</strong>. Nie wlicza się do budżetu wykończenia.</p></div>`;
  el.innerHTML = h;
}

function wierszPakietu(g) {
  const pill = g.ponad ? `<span class="pill bad">ponad plan o ${zl(g.zapl - g.plan)}</span>` : g.zostalo ? `<span class="pill mut">zostało ${zl(g.zostalo)}</span>` : `<span class="pill ok">zapłacone</span>`;
  return `<button class="row" type="button" data-fpak="${esc(g.pk.id)}"><span class="n">${esc(g.pk.nazwa)}</span><span class="a num">${zl(g.zapl)} <span style="color:var(--muted)">/ ${zl(g.plan)}</span></span>
    ${tasma(g.zapl, g.zostalo, g.plan)}<span class="m"><span>${g.xs.map((x) => esc(x.p.nazwa)).join(", ")}</span>${pill}</span></button>`;
}

/* ---------- pozycje ---------- */
function filtrPoz() {
  const f = S.fp, q = f.q.trim().toLowerCase();
  return [...licz().values()].filter((x) =>
    (!f.pom || (f.pom === "-" ? !pom().some((r) => r.id === x.p.pom) : x.p.pom === f.pom)) &&
    (!f.kat || (f.kat === "-" ? !kat().some((k) => k.id === x.p.kat) : x.p.kat === f.kat)) &&
    (!f.pak || x.p.pakiet === f.pak) &&
    (!f.stan || (f.stan === "otwarte" ? !x.p.zakonczona && x.zostalo > 0 : f.stan === "zakonczone" ? x.p.zakonczona : f.stan === "ponad" ? x.ponad : f.stan === "bezplanu" ? x.bezPlanu : true)) &&
    (!q || [x.p.nazwa, x.p.notatka, nazwaPom(x.p.pom), nazwaKat(x.p.kat)].join(" ").toLowerCase().includes(q)));
}
function wierszPoz(x) {
  return `<button class="row poz" type="button" data-poz="${esc(x.p.id)}"><span class="n">${esc(x.p.nazwa)}</span>
    <span class="a num">${zl(x.zapl)}${x.plan ? ` <span style="color:var(--muted)">/ ${zl(x.plan)}</span>` : ""}</span>
    ${tasma(x.zapl, x.zostalo, x.plan)}
    <span class="m"><span>${esc(nazwaKat(x.p.kat))} · ${x.n} ${x.n === 1 ? "płatność" : "płatności"}${x.zostalo && !x.p.zakonczona ? ` · zostało ${zl(x.zostalo)}` : ""}</span>${pigulka(x)}</span></button>`;
}
function renderPozycje() {
  const f = S.fp;
  $("#fp-pom").innerHTML = opcje(pom(), f.pom, "Wszystkie pomieszczenia", "Bez pomieszczenia");
  $("#fp-kat").innerHTML = opcje(kat(), f.kat, "Wszystkie kategorie", "Bez kategorii");
  $("#fp-stan").value = f.stan;
  if ($("#fp-q") !== document.activeElement) $("#fp-q").value = f.q;
  $("#fp-clear").hidden = !(f.q || f.pom || f.kat || f.stan || f.pak);
  const el = $("#lista-poz");
  if (!S.gotowe) { el.innerHTML = `<div class="banner">Wczytywanie…</div>`; return; }
  const l = filtrPoz(), sw = suma(l.filter((x) => !x.p.zakup));
  $("#fp-sum").innerHTML = `<span>${f.pak ? `Pakiet: ${esc(nazwaPak(f.pak))} · ` : ""}${l.length} z ${pozycje().length} pozycji</span><span>zapłacone <strong class="num">${zl(sw.zapl)}</strong> z planu <strong class="num">${zl(sw.plan)}</strong></span>`;
  if (!l.length) { el.innerHTML = `<div class="panel empty"><h3>${pozycje().length ? "Nic nie pasuje do filtrów" : "Brak pozycji"}</h3><p>${pozycje().length ? "Zmień filtry albo wyczyść wyszukiwanie." : "Dodaj pierwszą pozycję przyciskiem powyżej."}</p></div>`; return; }
  const grupy = [];
  for (const r of pom()) { const xs = l.filter((x) => !x.p.zakup && x.p.pom === r.id); if (xs.length) grupy.push([r.nazwa, xs]); }
  const sieroty = l.filter((x) => !x.p.zakup && !pom().some((r) => r.id === x.p.pom)); if (sieroty.length) grupy.push(["Bez pomieszczenia", sieroty]);
  const zk = l.filter((x) => x.p.zakup); if (zk.length) grupy.push(["Zakup domu", zk]);
  el.innerHTML = grupy.map(([n, xs]) => { const s = suma(xs); return `<div class="month"><div class="month-h"><span class="t">${esc(n)}</span><span class="s num">${zl(s.zapl)}${s.plan ? ` / ${zl(s.plan)}` : ""}</span></div><div class="rows">${xs.map(wierszPoz).join("")}</div></div>`; }).join("");
}

/* ---------- płatności ---------- */
function filtrPl() {
  const f = S.fl, q = f.q.trim().toLowerCase();
  return platnosci().filter((pl) => {
    const p = poz(pl.pozycja);
    return (!f.pom || (p && !p.zakup && (f.pom === "-" ? !pom().some((r) => r.id === p.pom) : p.pom === f.pom))) &&
      (!f.gdzie || pl.gdzie === f.gdzie) &&
      (!q || [pl.opis, pl.gdzie, pl.notatka, p?.nazwa].join(" ").toLowerCase().includes(q));
  }).sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.utworzono || "").localeCompare(a.utworzono || ""));
}
function wierszPl(pl) {
  const p = poz(pl.pozycja);
  const meta = [p ? (p.zakup ? "Zakup domu" : nazwaPom(p.pom)) : "Bez pozycji", pl.gdzie].filter(Boolean).map(esc).join(" · ");
  return `<button class="wyd" type="button" data-pl="${esc(pl.id)}"><span class="dt num">${dataPL(pl.data)}</span>
    <span class="o"><span class="t">${esc(pl.opis || p?.nazwa || "(bez opisu)")}</span><span class="mm"><span>${pl.opis && p ? esc(p.nazwa) + " · " : ""}${meta}</span>${pl.pliki?.length ? `<span title="Załączniki">📎 ${pl.pliki.length}</span>` : ""}</span></span>
    <span class="k num">${zl2(pl.kwotaGr)}</span></button>`;
}
function renderPlatnosci() {
  const f = S.fl;
  $("#fl-pom").innerHTML = opcje(pom(), f.pom, "Wszystkie pomieszczenia", "Bez pomieszczenia");
  $("#fl-gdzie").innerHTML = `<option value="">Wszyscy wykonawcy i sklepy</option>` + wykonawcy().map((g) => `<option ${g === f.gdzie ? "selected" : ""}>${esc(g)}</option>`).join("");
  if ($("#fl-q") !== document.activeElement) $("#fl-q").value = f.q;
  $("#fl-clear").hidden = !(f.q || f.pom || f.gdzie);
  const el = $("#lista-pl");
  if (!S.gotowe) { el.innerHTML = `<div class="banner">Wczytywanie…</div>`; return; }
  const l = filtrPl(), razem = l.reduce((a, p) => a + (p.kwotaGr || 0), 0);
  $("#fl-sum").innerHTML = `<span>${l.length} z ${platnosci().length} płatności</span><span>razem <strong class="num">${zl2(razem)}</strong></span>`;
  if (!l.length) { el.innerHTML = `<div class="panel empty"><h3>${platnosci().length ? "Nic nie pasuje do filtrów" : "Brak płatności"}</h3><p>${platnosci().length ? "Zmień filtry albo wyczyść wyszukiwanie." : "Dodaj płatność przyciskiem na dole."}</p></div>`; return; }
  const g = new Map();
  for (const pl of l) { const k = pl.data ? pl.data.slice(0, 7) : "brak"; if (!g.has(k)) g.set(k, []); g.get(k).push(pl); }
  el.innerHTML = [...g.entries()].map(([k, ps]) => {
    const t = k === "brak" ? "Bez daty · przeniesione z arkusza" : `${MIES[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
    return `<div class="month"><div class="month-h"><span class="t">${t}</span><span class="s num">${zl2(ps.reduce((a, p) => a + (p.kwotaGr || 0), 0))}</span></div>${ps.map(wierszPl).join("")}</div>`;
  }).join("");
}

/* ---------- ustawienia ---------- */
function renderUstawienia(force) {
  const el = $("#v-ustawienia");
  if (!force && el.contains(document.activeElement) && document.activeElement.matches("input[type=text],input:not([type])")) return;
  if (!S.gotowe) { el.innerHTML = `<div class="banner">Wczytywanie…</div>`; return; }
  const ile = (typ, id) => pozycje().filter((p) => p[SLOWNIK[typ].pole] === id).length;
  const ask = (typ, id) => {
    if (S.usuwanie?.typ !== typ || S.usuwanie.id !== id) return "";
    const n = ile(typ, id), lista = slownik(typ);
    if (!n || typ === "pak") return typ === "pak" && n ? `<div class="ask">Usunąć pakiet? ${n} pozycji zostanie bez pakietu (nic nie znika). <button class="btn danger" type="button" data-del-ok>Usuń</button><button class="btn" type="button" data-del-no>Nie</button></div>` : `<div class="ask">Usunąć? <button class="btn danger" type="button" data-del-ok>Usuń</button><button class="btn" type="button" data-del-no>Nie</button></div>`;
    return `<div class="ask">${n} pozycji ma tę wartość. Przenieś je do: <select class="ctl" id="u-move">${opcje(lista.filter((x) => x.id !== id), "")}</select><button class="btn danger" type="button" data-del-ok>Przenieś i usuń</button><button class="btn" type="button" data-del-no>Anuluj</button></div>`;
  };
  const lista = (typ, items) => `<div class="slist">${items.map((x) => `<div class="srow k">
      <input class="ctl" type="text" value="${esc(x.nazwa)}" data-u="${typ}" data-id="${esc(x.id)}" aria-label="Nazwa">
      <button class="btn link" type="button" data-u-del="${typ}" data-id="${esc(x.id)}">usuń <span class="cnt">(${ile(typ, x.id)})</span></button>
      ${ask(typ, x.id)}</div>`).join("")}</div>`;
  el.innerHTML = `
  <div class="grid2">
    <div class="panel stack"><div><h2>Pomieszczenia</h2><p class="hint" style="margin:0">Budżet pomieszczenia to suma planów jego pozycji. Rzeczy na cały dom (podłogi, drzwi, elektryka) trzymaj w „Cały dom”.</p></div>
      ${lista("pom", pom())}
      <form class="srow k" id="u-add-pom"><input class="ctl" type="text" placeholder="Nowe pomieszczenie" aria-label="Nowe pomieszczenie"><button class="btn" type="submit">Dodaj</button></form></div>
    <div class="panel stack"><div><h2>Kategorie</h2><p class="hint" style="margin:0">Rodzaj prac lub zakupów. Pozwala zobaczyć np. ile łącznie idzie na meble we wszystkich pomieszczeniach.</p></div>
      ${lista("kat", kat())}
      <form class="srow k" id="u-add-kat"><input class="ctl" type="text" placeholder="Nowa kategoria" aria-label="Nowa kategoria"><button class="btn" type="submit">Dodaj</button></form></div>
  </div>
  <div class="panel stack"><div><h2>Pakiety</h2><p class="hint" style="margin:0">Kilka pozycji ze wspólnym budżetem, np. wykonawca robiący kilka prac z materiałami. Pozycję dopinasz do pakietu w jej formularzu.</p></div>
    ${lista("pak", pak())}
    <form class="srow k" id="u-add-pak"><input class="ctl" type="text" placeholder="Nowy pakiet" aria-label="Nowy pakiet"><button class="btn" type="submit">Dodaj</button></form></div>
  <div class="panel stack">
    <div><h2>Kopia i historia</h2><p class="hint" style="margin:0">Baza trzyma kopię 300 ostatnich wersji danych, więc pomyłkę da się cofnąć (poproś Claude’a). Pliki CSV otworzysz w Excelu i Google Sheets. Aplikacja działa od razu na każdym urządzeniu, wystarczy otworzyć adres strony.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="u-csv-poz">CSV: pozycje</button><button class="btn" type="button" id="u-csv-pl">CSV: płatności</button></div>
  </div>`;
}
function pobierzCsv(nazwa, rows) {
  const q = (v) => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const kw = (gr) => f2.format((gr || 0) / 100).replace(/\s/g, "");
  const tekst = "﻿" + rows.map((r) => r.map((c) => q(typeof c === "object" && c ? kw(c.gr) : c)).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([tekst], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `${nazwa}-${dzis()}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function csvPozycje() {
  const rows = [["Pomieszczenie", "Pozycja", "Kategoria", "Plan", "Zapłacone", "Zostało", "Zakończona", "Zakup domu", "Pakiet", "Notatka"]];
  for (const x of licz().values()) rows.push([nazwaPom(x.p.pom), x.p.nazwa, nazwaKat(x.p.kat), { gr: x.plan }, { gr: x.zapl }, { gr: x.zostalo }, x.p.zakonczona ? "tak" : "", x.p.zakup ? "tak" : "", nazwaPak(x.p.pakiet), x.p.notatka]);
  pobierzCsv("koszty-pozycje", rows);
}
function csvPlatnosci() {
  const rows = [["Data", "Pozycja", "Pomieszczenie", "Opis", "Sklep / wykonawca", "Kwota", "Notatka"]];
  for (const pl of [...platnosci()].sort((a, b) => (a.data || "").localeCompare(b.data || ""))) { const p = poz(pl.pozycja); rows.push([pl.data, p?.nazwa, p ? nazwaPom(p.pom) : "", pl.opis, pl.gdzie, { gr: pl.kwotaGr }, pl.notatka]); }
  pobierzCsv("koszty-platnosci", rows);
}

/* ---------- arkusz: pozycja ---------- */
function otworzPoz(id) {
  const p = id ? poz(id) : null;
  S.sheet = { typ: "poz", id: p?.id || null };
  const x = p ? licz().get(p.id) : null;
  const pl = p ? platnosci().filter((q) => q.pozycja === p.id).sort((a, b) => (b.data || "").localeCompare(a.data || "")) : [];
  const domPom = S.fp.pom && S.fp.pom !== "-" ? S.fp.pom : pom()[0]?.id || "";
  $("#sheet").innerHTML = `<div class="tapebar" aria-hidden="true"></div><form class="sheet-in" id="form-poz" novalidate>
    <h2 id="sheet-h">${p ? "Pozycja" : "Nowa pozycja"}</h2>
    <div class="fg"><label for="p-nazwa">Nazwa</label><input class="ctl" id="p-nazwa" value="${esc(p?.nazwa || "")}" placeholder="np. Meble kuchnia" autocomplete="off"></div>
    <div class="two">
      <div class="fg"><label for="p-pom">Pomieszczenie</label><select class="ctl" id="p-pom">${opcje(pom(), p ? p.pom : domPom, "— wybierz —")}</select></div>
      <div class="fg"><label for="p-kat">Kategoria</label><select class="ctl" id="p-kat">${opcje(kat(), p ? p.kat : S.fp.kat !== "-" ? S.fp.kat : "", "— wybierz —")}</select></div>
    </div>
    <div class="two">
      <div class="fg"><label for="p-plan">Plan (zł)</label><input class="ctl kw" id="p-plan" inputmode="decimal" value="${p?.planGr ? f0.format(p.planGr / 100) : ""}" placeholder="ile planujesz wydać"></div>
      <div class="fg checks"><label><input type="checkbox" id="p-zak" ${p?.zakonczona ? "checked" : ""}> Zakończone, nic więcej nie płacę</label><label><input type="checkbox" id="p-zakup" ${p?.zakup ? "checked" : ""}> Zakup domu (poza budżetem wykończenia)</label></div>
    </div>
    ${pak().length ? `<div class="fg"><label for="p-pak">Pakiet <span class="hint">(wspólny budżet z innymi pozycjami)</span></label><select class="ctl" id="p-pak">${opcje(pak(), p ? p.pakiet || "" : S.fp.pak || "", "— bez pakietu —")}</select></div>` : ""}
    <div class="fg"><label for="p-notatka">Notatka</label><textarea class="ctl" id="p-notatka" rows="2" placeholder="zakres, ustalenia z wykonawcą…">${esc(p?.notatka || "")}</textarea></div>
    ${p ? `<div class="pozsum"><div><span class="lbl">Zapłacone</span><b class="num">${zl2(x.zapl)}</b></div><div><span class="lbl">Plan</span><b class="num">${x.plan ? zl2(x.plan) : "—"}</b></div><div><span class="lbl">Zostało</span><b class="num">${zl2(x.zostalo)}</b></div></div>${tasma(x.zapl, x.zostalo, x.plan)}
      ${x.wPakiecie ? (() => { const g = S.pakiety.get(x.wPakiecie.id); return `<p class="hint" style="margin:0">W pakiecie „${esc(g.pk.nazwa)}”: plan ${zl(g.plan)}, zapłacone ${zl(g.zapl)}, zostało ${zl(g.zostalo)}. „Zostało” tej pozycji to jej część kwoty pakietu.</p>`; })() : ""}
      <div class="fg"><div class="pl-head"><span class="lbl">Płatności (${pl.length})</span><button class="btn" type="button" data-nowa-pl="${esc(p.id)}">+ Dodaj płatność</button></div>
      ${pl.length ? `<div>${pl.map(wierszPl).join("")}</div>` : `<p class="hint" style="margin:0">Brak płatności.</p>`}</div>` : ""}
    <div class="err" id="p-err" hidden></div>
    <div class="actions"><div>${p ? `<button class="btn danger" type="button" id="p-del">Usuń pozycję</button>` : ""}</div>
      <div class="r"><button class="btn" type="button" data-zamknij>Anuluj</button><button class="btn pri" type="submit">Zapisz</button></div></div>
  </form>`;
  pokazSheet(p ? null : "#p-nazwa");
}
async function zapiszPoz() {
  const id = S.sheet.id || losoweId();
  const nazwa = $("#p-nazwa").value.trim(), planTxt = $("#p-plan").value.trim();
  const plan = planTxt ? parseKwota(planTxt) : 0;
  const blad = !nazwa ? "Wpisz nazwę pozycji." : plan === null || plan < 0 ? "Plan wpisz jako liczbę, np. 45000." : !$("#p-pom").value ? "Wybierz pomieszczenie." : !$("#p-kat").value ? "Wybierz kategorię." : "";
  if (blad) { const e = $("#p-err"); e.textContent = blad; e.hidden = false; return; }
  const dane = { nazwa, pom: $("#p-pom").value, kat: $("#p-kat").value, planGr: plan || 0, zakonczona: $("#p-zak").checked, zakup: $("#p-zakup").checked, pakiet: $("#p-pak")?.value || "", notatka: $("#p-notatka").value.trim() };
  try {
    await zmien(`${S.sheet.id ? "Pozycja" : "Nowa pozycja"}: ${nazwa}`, (d) => {
      const p = d.pozycje.find((q) => q.id === id);
      if (p) Object.assign(p, dane); else d.pozycje.push({ id, ...dane });
    });
    zamknij(); toast(`Zapisano pozycję: ${nazwa}`);
  } catch (e) { bladZapisu(e); }
}
async function usunPoz() {
  const id = S.sheet.id, b = $("#p-del"), n = platnosci().filter((q) => q.pozycja === id).length;
  if (n) { const e = $("#p-err"); e.textContent = `Ta pozycja ma ${n} płatności. Najpierw je usuń albo przepnij do innej pozycji.`; e.hidden = false; return; }
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Na pewno usunąć?"; return; }
  try { await zmien(`Usunięto pozycję: ${poz(id)?.nazwa}`, (d) => { d.pozycje = d.pozycje.filter((q) => q.id !== id); }); zamknij(); toast("Usunięto pozycję."); }
  catch (e) { bladZapisu(e); }
}

/* ---------- arkusz: płatność ---------- */
function otworzPl(id, pozId, powrot) {
  const pl = id ? platnosci().find((q) => q.id === id) : null;
  S.sheet = { typ: "pl", id: pl?.id || null, pliki: [...(pl?.pliki || [])], nowe: [], wgrywa: false, powrot: powrot || null };
  const wyb = pl?.pozycja || pozId || S.ostatniaPoz || "";
  $("#sheet").innerHTML = `<div class="tapebar" aria-hidden="true"></div><form class="sheet-in" id="form-pl" novalidate>
    <h2 id="sheet-h">${pl ? "Płatność" : "Nowa płatność"}</h2>
    <div class="fg"><label for="pl-poz">Pozycja</label><select class="ctl" id="pl-poz">${opcjePoz(wyb)}</select></div>
    <div class="two">
      <div class="fg"><label for="pl-kwota">Kwota (zł)</label><input class="ctl kw" id="pl-kwota" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${pl ? f2.format(pl.kwotaGr / 100) : ""}"></div>
      <div class="fg"><label for="pl-data">Data</label><input class="ctl" id="pl-data" type="date" value="${pl ? pl.data || "" : dzis()}"></div>
    </div>
    <div class="fg"><label for="pl-opis">Za co <span class="hint">(opcjonalnie)</span></label><input class="ctl" id="pl-opis" autocomplete="off" placeholder="np. zaliczka, fuga i klej, II rata" value="${esc(pl?.opis || "")}"></div>
    <div class="fg"><label for="pl-gdzie">Sklep / wykonawca</label><input class="ctl" id="pl-gdzie" list="dl-gdzie" autocomplete="off" placeholder="np. Kazik, Leroy Merlin" value="${esc(pl?.gdzie || "")}"><datalist id="dl-gdzie">${wykonawcy().map((g) => `<option value="${esc(g)}">`).join("")}</datalist></div>
    <div class="fg"><label for="pl-notatka">Notatka</label><textarea class="ctl" id="pl-notatka" rows="2" placeholder="nr faktury, gwarancja…">${esc(pl?.notatka || "")}</textarea></div>
    <div class="fg"><span class="lbl">Paragony i faktury</span><div class="files" id="pl-files"></div><input type="file" id="pl-file" accept="image/*,application/pdf" multiple hidden></div>
    <div class="err" id="pl-err" hidden></div>
    <div class="actions"><div>${pl ? `<button class="btn danger" type="button" id="pl-del">Usuń</button>` : ""}</div>
      <div class="r"><button class="btn" type="button" data-zamknij>Anuluj</button>${pl ? "" : `<button class="btn" type="button" id="pl-next">Zapisz i dodaj kolejną</button>`}<button class="btn pri" type="submit" id="pl-save">Zapisz</button></div></div>
  </form>`;
  renderPliki();
  pokazSheet(pl ? null : pozId ? "#pl-kwota" : "#pl-poz");
}
function renderPliki() {
  const e = S.sheet; if (!e || e.typ !== "pl") return;
  const box = $("#pl-files");
  box.innerHTML = e.pliki.map((p, i) => `<div class="file">${p.typ === "application/pdf" ? `<button type="button" class="btn link" data-pdf="${esc(p.id)}">PDF</button>` : `<img alt="${esc(p.nazwa || "paragon")}" data-blob="${esc(p.id)}" data-zoom="${esc(p.id)}">`}<button type="button" class="x" data-rm="${i}" aria-label="Usuń załącznik">×</button></div>`).join("")
    + `<button type="button" class="file addfile" id="pl-addfile" ${e.wgrywa ? "disabled" : ""}>${e.wgrywa ? "Wgrywanie…" : "+ zdjęcie lub PDF"}</button>`;
  for (const img of box.querySelectorAll("img[data-blob]")) blobUrl(img.dataset.blob).then((u) => (img.src = u), () => (img.alt = "brak pliku"));
}
async function przygotujPlik(file) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return { bytes: new Uint8Array(await file.arrayBuffer()), type: "application/pdf", ext: "pdf" };
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (blob) return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "image/jpeg", ext: "jpg" };
  } catch {}
  throw { code: "format" };
}
async function wgraj(files) {
  const e = S.sheet; if (!e || e.typ !== "pl") return;
  e.wgrywa = true; renderPliki();
  for (const f of files) {
    try {
      const { bytes, type, ext } = await przygotujPlik(f);
      if (bytes.length > 10 * 1024 * 1024) throw { code: "duzy" };
      const path = `${dzis().slice(0, 7)}-${losoweId()}.${ext}`;
      await wgrajPlik(path, bytes, type);
      bloby.set(path, Promise.resolve(URL.createObjectURL(new Blob([bytes], { type }))));
      if (S.sheet !== e) { usunPlik(path); return; }
      e.pliki.push({ id: path, typ: type, nazwa: f.name }); e.nowe.push(path);
    } catch (err) {
      const c = err?.code;
      if (c === "token") { bladZapisu(err); break; }
      toast(c === "format" ? `Plik ${f.name} ma nieobsługiwany format. Użyj zdjęcia (JPG, PNG) albo PDF.` : c === "duzy" ? `Plik ${f.name} jest za duży (limit 10 MB).` : `Nie udało się wgrać ${f.name}.`);
    }
  }
  e.wgrywa = false; renderPliki();
}
async function zapiszPl(kolejna) {
  const e = S.sheet; if (!e || e.wgrywa) return;
  const kw = parseKwota($("#pl-kwota").value), pozId = $("#pl-poz").value;
  const blad = !pozId ? "Wybierz pozycję, której dotyczy płatność." : kw === null || kw <= 0 ? "Wpisz kwotę większą od zera, np. 1250,50." : "";
  if (blad) { const er = $("#pl-err"); er.textContent = blad; er.hidden = false; return; }
  const id = e.id || losoweId(), stara = platnosci().find((q) => q.id === e.id);
  const doc = { id, pozycja: pozId, data: $("#pl-data").value || "", kwotaGr: kw, opis: $("#pl-opis").value.trim(), gdzie: $("#pl-gdzie").value.trim(), notatka: $("#pl-notatka").value.trim(), pliki: e.pliki, utworzono: stara?.utworzono || new Date().toISOString() };
  if (stara?.zrodlo) doc.zrodlo = stara.zrodlo;
  const usuniete = (stara?.pliki || []).filter((p) => !e.pliki.some((q) => q.id === p.id)).map((p) => p.id);
  const nazwa = poz(pozId)?.nazwa || "";
  for (const b of document.querySelectorAll("#pl-save,#pl-next")) b.disabled = true;
  try {
    await zmien(`${e.id ? "Zmiana płatności" : "Płatność"}: ${nazwa}, ${zl2(kw)}${doc.gdzie ? ", " + doc.gdzie : ""}`, (d) => {
      const i = d.platnosci.findIndex((q) => q.id === id);
      if (i >= 0) d.platnosci[i] = doc; else d.platnosci.push(doc);
    });
    S.ostatniaPoz = pozId;
    for (const p of usuniete) usunPlik(p);
    e.nowe = [];
    toast(`Zapisano: ${nazwa}, ${zl2(kw)}`);
    if (kolejna) { otworzPl(null, pozId, e.powrot); $("#pl-data").value = doc.data; $("#pl-gdzie").value = doc.gdzie; }
    else if (e.powrot) otworzPoz(e.powrot);
    else zamknij();
  } catch (err) { bladZapisu(err); for (const b of document.querySelectorAll("#pl-save,#pl-next")) b.disabled = false; }
}
async function usunPl() {
  const b = $("#pl-del"), e = S.sheet, pl = platnosci().find((q) => q.id === e.id);
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Na pewno usunąć?"; return; }
  try {
    await zmien(`Usunięto płatność: ${poz(pl?.pozycja)?.nazwa || ""}, ${zl2(pl?.kwotaGr)}`, (d) => { d.platnosci = d.platnosci.filter((q) => q.id !== e.id); });
    for (const p of pl?.pliki || []) usunPlik(p.id);
    toast("Usunięto płatność.");
    if (e.powrot) otworzPoz(e.powrot); else zamknij();
  } catch (err) { bladZapisu(err); }
}

/* ---------- arkusz: wspólne ---------- */
function pokazSheet(fokus) {
  $("#veil").hidden = false; document.body.style.overflow = "hidden";
  $("#sheet").scrollTop = 0;
  if (fokus) setTimeout(() => $(fokus)?.focus(), 30);
}
function zamknij(anulowano) {
  const e = S.sheet;
  if (anulowano && e?.typ === "pl" && e.nowe?.length) for (const p of e.nowe) usunPlik(p);
  if (anulowano && e?.typ === "pl" && e.powrot) { otworzPoz(e.powrot); return; }
  S.sheet = null; $("#veil").hidden = true; document.body.style.overflow = "";
}

/* ---------- wczytanie i odświeżanie ---------- */
async function wczytaj() {
  try {
    const p = await pobierz();
    S.wersja = p.wersja; S.blad = ""; ustawDane(p.dane); sync("ok", "Połączono");
  } catch (e) {
    S.blad = e?.code === "brak-bazy" ? "Baza nie jest jeszcze przygotowana. W Supabase trzeba raz uruchomić skrypt supabase.sql." : e?.code === "siec" ? "Brak połączenia z internetem. Spróbuję ponownie za chwilę." : "Nie udało się wczytać danych. Spróbuję ponownie za chwilę.";
    sync("err", "Brak połączenia"); render();
  }
}
async function odswiez() {
  if (zajete || S.sheet || document.visibilityState !== "visible") return;
  if (!S.gotowe) return wczytaj();
  try { const p = await pobierz(); if (p.wersja !== S.wersja && !zajete && !S.sheet) { S.wersja = p.wersja; ustawDane(p.dane); } sync("ok", "Aktualne"); }
  catch (e) { sync("err", e?.code === "siec" ? "Brak internetu" : "Brak połączenia"); }
}

/* ---------- render ---------- */
function render() {
  const el = $("#v-login");
  el.hidden = !S.blad || S.gotowe;
  if (!el.hidden) el.innerHTML = `<div class="banner">${esc(S.blad)}</div>`;
  for (const v of WIDOKI) { $("#v-" + v).hidden = S.view !== v; $("#t-" + v).setAttribute("aria-selected", S.view === v); }
  $("#fab").hidden = !S.gotowe || !pozycje().length;
  if (S.view === "podsumowanie") renderPodsumowanie();
  if (S.view === "pozycje") renderPozycje();
  if (S.view === "platnosci") renderPlatnosci();
  if (S.view === "ustawienia") renderUstawienia();
}
function idz(v) {
  S.view = v; render(); window.scrollTo(0, 0);
  try { localStorage.setItem("kd-view", v); } catch {}
}

/* ---------- zdarzenia ---------- */
function wire() {
  const d = new Date();
  $("#today").textContent = `stan na ${d.getDate()} ${["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"][d.getMonth()]} ${d.getFullYear()}`;
  document.querySelectorAll("nav.tabs button").forEach((b) => b.addEventListener("click", () => idz(b.dataset.v)));
  $("#fab").addEventListener("click", () => otworzPl(null));
  $("#fp-q").addEventListener("input", (e) => { S.fp.q = e.target.value; renderPozycje(); });
  $("#fp-pom").addEventListener("change", (e) => { S.fp.pom = e.target.value; renderPozycje(); });
  $("#fp-kat").addEventListener("change", (e) => { S.fp.kat = e.target.value; renderPozycje(); });
  $("#fp-stan").addEventListener("change", (e) => { S.fp.stan = e.target.value; renderPozycje(); });
  $("#fp-clear").addEventListener("click", () => { S.fp = { q: "", pom: "", kat: "", stan: "", pak: "" }; renderPozycje(); });
  $("#fl-q").addEventListener("input", (e) => { S.fl.q = e.target.value; renderPlatnosci(); });
  $("#fl-pom").addEventListener("change", (e) => { S.fl.pom = e.target.value; renderPlatnosci(); });
  $("#fl-gdzie").addEventListener("change", (e) => { S.fl.gdzie = e.target.value; renderPlatnosci(); });
  $("#fl-clear").addEventListener("click", () => { S.fl = { q: "", pom: "", gdzie: "" }; renderPlatnosci(); });

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    const plB = t.closest("[data-pl]"); if (plB) { otworzPl(plB.dataset.pl, null, S.sheet?.typ === "poz" ? S.sheet.id : null); return; }
    const pozB = t.closest("[data-poz]"); if (pozB) { otworzPoz(pozB.dataset.poz); return; }
    const nPl = t.closest("[data-nowa-pl]"); if (nPl) { otworzPl(null, nPl.dataset.nowaPl, nPl.dataset.nowaPl); return; }
    if (t.closest("[data-nowa-poz]")) { otworzPoz(null); return; }
    if (t.closest("[data-zamknij]")) { zamknij(true); return; }
    const fp = t.closest("[data-fpom]"); if (fp) { S.fp = { q: "", pom: fp.dataset.fpom, kat: "", stan: "", pak: "" }; idz("pozycje"); return; }
    const fpk = t.closest("[data-fpak]"); if (fpk) { S.fp = { q: "", pom: "", kat: "", stan: "", pak: fpk.dataset.fpak }; idz("pozycje"); return; }
    const fk = t.closest("[data-fkat]"); if (fk) { S.fp = { q: "", pom: "", kat: fk.dataset.fkat, stan: "", pak: "" }; idz("pozycje"); return; }
    const fg = t.closest("[data-fgdzie]"); if (fg) { S.fl = { q: "", pom: "", gdzie: fg.dataset.fgdzie }; idz("platnosci"); return; }
    const z = t.closest("[data-zoom]"); if (z && z.src) { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${z.src}" alt="">`; lb.addEventListener("click", () => lb.remove()); document.body.append(lb); return; }
    const pdf = t.closest("[data-pdf]"); if (pdf) { const okno = window.open("", "_blank"); blobUrl(pdf.dataset.pdf).then((u) => { if (okno) okno.location.href = u; else location.href = u; }, () => { okno?.close(); toast("Nie udało się otworzyć pliku."); }); return; }
    const rm = t.closest("[data-rm]"); if (rm && S.sheet?.typ === "pl") { S.sheet.pliki.splice(+rm.dataset.rm, 1); renderPliki(); return; }
    if (t.closest("#pl-addfile")) { $("#pl-file").click(); return; }
    if (t.id === "pl-next") { zapiszPl(true); return; }
    if (t.id === "pl-del") { usunPl(); return; }
    if (t.id === "p-del") { usunPoz(); return; }
    const ud = t.closest("[data-u-del]"); if (ud) { S.usuwanie = { typ: ud.dataset.uDel, id: ud.dataset.id }; renderUstawienia(true); return; }
    if (t.closest("[data-del-no]")) { S.usuwanie = null; renderUstawienia(true); return; }
    if (t.closest("[data-del-ok]")) { usunSlownik(); return; }
    if (t.id === "u-csv-poz") { csvPozycje(); return; }
    if (t.id === "u-csv-pl") { csvPlatnosci(); return; }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "pl-file") { const fs = [...t.files]; t.value = ""; if (fs.length) wgraj(fs); return; }
    const u = t.dataset.u; if (!u || !S.gotowe) return;
    const id = t.dataset.id, lista = slownik(u);
    const x = lista.find((y) => y.id === id), v = t.value.trim();
    if (!x || !v || v === x.nazwa) { t.value = x?.nazwa || ""; return; }
    t.blur();
    zmien(`Zmiana nazwy: ${x.nazwa} → ${v}`, (d) => { const y = (d.ustawienia[SLOWNIK[u].klucz] ??= []).find((q) => q.id === id); if (y) y.nazwa = v; }).catch(bladZapisu);
  });
  document.addEventListener("submit", (ev) => {
    const f = ev.target;
    ev.preventDefault();
    if (f.id === "form-poz") { zapiszPoz(); return; }
    if (f.id === "form-pl") { zapiszPl(false); return; }
    if (f.id === "u-add-pom" || f.id === "u-add-kat" || f.id === "u-add-pak") {
      const inp = f.querySelector("input"), n = inp.value.trim(); if (!n) return;
      const typ = f.id.slice(6);
      if (slownik(typ).some((x) => x.nazwa.toLowerCase() === n.toLowerCase())) { toast(`„${n}” już jest na liście.`); return; }
      inp.value = ""; inp.blur();
      zmien(`Dodano ${SLOWNIK[typ].nazwa}: ${n}`, (d) => {
        const l = (d.ustawienia[SLOWNIK[typ].klucz] ??= []);
        l.push({ id: noweId(l, n), nazwa: n });
      }).catch(bladZapisu);
    }
  });
  $("#veil").addEventListener("click", (e) => { if (e.target.id === "veil") zamknij(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const lb = $(".lightbox"); if (lb) lb.remove(); else if (S.sheet) zamknij(true); } });

  const tip = $("#tip");
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const r = t.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + "px";
    tip.style.top = Math.max(8, r.top + (r.height - (t.querySelector("b")?.offsetHeight || 0)) - tip.offsetHeight - 8) + "px";
  });
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (WIDOKI.includes(v) && v !== S.view) idz(v); });
  document.addEventListener("visibilitychange", odswiez);
  setInterval(odswiez, 15000);
}
async function usunSlownik() {
  const { typ, id } = S.usuwanie;
  const pole = SLOWNIK[typ].pole;
  const n = pozycje().filter((p) => p[pole] === id).length, cel = typ === "pak" ? "" : $("#u-move")?.value;
  if (n && !cel && typ !== "pak") return;
  try {
    await zmien(`Usunięto ${SLOWNIK[typ].nazwa} ${id}${n ? `, przeniesiono ${n} pozycji` : ""}`, (d) => {
      for (const p of d.pozycje) if (p[pole] === id) p[pole] = cel;
      const l = d.ustawienia[SLOWNIK[typ].klucz] ??= [];
      const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1);
    });
    S.usuwanie = null; renderUstawienia(true);
  } catch (e) { bladZapisu(e); }
}

/* ---------- start ---------- */
try { const v = localStorage.getItem("kd-view"); if (WIDOKI.includes(v)) S.view = v; } catch {}
const h = location.hash.slice(1); if (WIDOKI.includes(h)) S.view = h;
try { localStorage.removeItem("kd-gh-token"); } catch {}
if (/^klucz=/.test(h)) history.replaceState(null, "", location.pathname + location.search);
wire(); render(); wczytaj();
})();

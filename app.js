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
  ekran: { typ: "dom" },
  fl: { q: "", stan: "", pom: "" },
  fp: { gdzie: "" },
  sheet: null, menu: false, usuwanie: null, ostatnie: {},
};
function ustawDane(d) { S.dane = d; S.gotowe = true; S.calc = null; render(); }
const pom = () => S.dane?.ustawienia.pomieszczenia || [];
const kat = () => S.dane?.ustawienia.kategorie || [];
const pak = () => S.dane?.ustawienia.pakiety || [];
const nazwaPak = (id) => pak().find((p) => p.id === id)?.nazwa || "";
const SLOWNIK = { pom: { klucz: "pomieszczenia", pole: "pom", nazwa: "pomieszczenie" }, kat: { klucz: "kategorie", pole: "kat", nazwa: "kategorię" }, pak: { klucz: "pakiety", pole: "pakiet", nazwa: "pakiet" } };
const slownik = (typ) => S.dane?.ustawienia[SLOWNIK[typ].klucz] || [];
const pozycje = () => S.dane?.pozycje || [];
const platnosci = () => S.dane?.platnosci || [];
const nazwaPom = (id) => pom().find((p) => p.id === id)?.nazwa || "Bez pomieszczenia";
const nazwaKat = (id) => kat().find((k) => k.id === id)?.nazwa || "";
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
const wykonawcy = () => [...new Set(platnosci().map((p) => p.gdzie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
const kupioneProdukty = () => new Set(platnosci().filter((q) => q.produkt).map((q) => q.produkt));

/* ---------- kolory i ikony pomieszczeń ---------- */
const PASTELE = ["#F8DA6B", "#F6B9D6", "#C8C4F4", "#AEE3D6", "#FBD2AE", "#BCD5F3", "#CFDC9E", "#F6A193", "#E3C5F0", "#EBDCC3"];
const kolorPom = (id) => { const r = pom().find((p) => p.id === id); if (r?.kolor) return r.kolor; const i = pom().findIndex((p) => p.id === id); return i < 0 ? "#E4E4EA" : PASTELE[i % PASTELE.length]; };
const IKONY = {
  dom: "M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z",
  lista: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  portfel: "M3.5 7.5h17v12h-17zM3.5 11h17M15.5 15.5h2",
  suwaki: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  plus: "M12 5v14M5 12h14",
  wstecz: "M14.5 5.5 8 12l6.5 6.5",
  olowek: "M4 20h4L19.5 8.5l-4-4L4 16z",
  x: "M6 6l12 12M18 6 6 18",
  aparat: "M4 8h3l2-2.5h6L17 8h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  strzalka: "M8 16 16 8M10 8h6v6",
  szukaj: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l4 4",
  kuchnia: "M4.5 10h15v5.5a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4zM2.5 10h2M19.5 10h2M9.5 7c0-1.2 1-1.4 1-2.6M13.5 7c0-1.2 1-1.4 1-2.6",
  lazienka: "M3 12h18v1.5a5.5 5.5 0 0 1-5.5 5.5h-7A5.5 5.5 0 0 1 3 13.5zM6 12V6.5a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2",
  toaleta: "M12 3.5s6 6.6 6 10.5a6 6 0 0 1-12 0c0-3.9 6-10.5 6-10.5z",
  sypialnia: "M3 19V7M3 14h18v5M21 14v-1.5a3 3 0 0 0-3-3h-8V14M6.5 11.5h.01",
  garderoba: "M12 7.5a2 2 0 1 1 2-2M12 7.5V9l-8.5 7h17L12 9",
  salon: "M5 11V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2M4 11a2 2 0 0 1 2 2v1.5h12V13a2 2 0 1 1 2 2v3H4v-3a2 2 0 0 1 0-4zM6.5 18v2M17.5 18v2",
  przedpokoj: "M6.5 21V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V21M3.5 21h17M14 12.5h.01",
  kotlownia: "M12 3c1.8 3.6 6 5.6 6 10.8a6 6 0 0 1-12 0c0-2.8 1.6-4.6 2.8-5.6 0 1.8.9 2.8 1.9 2.8 0-2.7-.9-4.6 1.3-8z",
  zewnatrz: "M12 21v-4.5M6.5 16.5h11L12 4z",
  inne: "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z",
  ok: "M5 12.5l4.5 4.5L19 7.5",
};
const ikona = (k, rozm = 22) => `<svg class="ik" width="${rozm}" height="${rozm}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IKONY[k] || IKONY.inne}"/></svg>`;
function ikonaPom(id) {
  const s = slug(nazwaPom(id));
  const k = /kuch/.test(s) ? "kuchnia" : /lazien/.test(s) ? "lazienka" : /toalet|wc/.test(s) ? "toaleta" : /sypial/.test(s) ? "sypialnia" : /garder/.test(s) ? "garderoba" : /salon|pokoj-dzien/.test(s) ? "salon" : /przedpok|hol/.test(s) ? "przedpokoj" : /kotlow|piec/.test(s) ? "kotlownia" : /zewn|ogrod|dzialk|taras/.test(s) ? "zewnatrz" : /caly|dom/.test(s) ? "dom" : "inne";
  return ikona(k);
}

/* ---------- drobne elementy ---------- */
const kw = (gr) => `${f0.format(Math.round((gr || 0) / 100))}<small> zł</small>`;
function pasek(zapl, zostalo, plan) {
  const max = Math.max(plan, zapl + zostalo, 1);
  const a = (zapl / max) * 100, b = (zostalo / max) * 100;
  return `<div class="bar" role="img" aria-label="Zapłacone ${zl(zapl)}, zostało ${zl(zostalo)}">${zapl ? `<i class="z" style="width:${a}%"></i>` : ""}${zostalo ? `<i class="r" style="width:${b}%"></i>` : ""}${plan && zapl > plan ? `<b class="lim" style="left:${(plan / max) * 100}%"></b>` : ""}</div>`;
}
function stanPozycji(x) {
  if (x.wPakiecie) return `<span class="tag">pakiet ${esc(x.wPakiecie.nazwa.split(":")[0])}</span>`;
  if (x.p.zakonczona) return `<span class="tag ok">zakończone</span>`;
  if (x.ponad) return `<span class="tag zle">ponad plan o ${zl(x.zapl - x.plan)}</span>`;
  if (x.bezPlanu && x.zapl) return `<span class="tag uwaga">bez planu</span>`;
  return "";
}
function kolkoPozycji(x) {
  const tlo = x.p.zakup ? "#E4E4EA" : kolorPom(x.p.pom);
  const zle = !x.wPakiecie && (x.ponad || (x.bezPlanu && x.zapl));
  const pelne = x.plan && x.zapl >= x.plan;
  if (x.p.zakonczona || pelne) return `<span class="kolko kolko-pelne" style="--k:${tlo}">${ikona("ok", 22)}</span>`;
  if (!x.plan) return `<span class="kolko" style="--k:${tlo}"><b>zł</b></span>`;
  if (zle) return `<span class="kolko kolko-zle">!</span>`;
  const proc = x.plan ? Math.min(Math.round((x.zapl / x.plan) * 100), 100) : 0, r = 19, c = 2 * Math.PI * r;
  return `<span class="kolko" style="--k:${tlo}"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="${r}" class="kolko-t"/>${proc ? `<circle cx="24" cy="24" r="${r}" class="kolko-v" stroke-dasharray="${(c * proc) / 100} ${c}" transform="rotate(-90 24 24)"/>` : ""}</svg><b class="${proc ? "" : "zero"}">${proc}%</b></span>`;
}
function wierszPozycji(x, gdzie) {
  const kat = nazwaKat(x.p.kat), pod = [gdzie ? (x.p.zakup ? "Zakup domu" : nazwaPom(x.p.pom)) : "", kat && kat !== x.p.nazwa ? kat : "", x.p.produkty?.length ? `${x.p.produkty.length} prod.` : ""].filter(Boolean);
  const plan = x.p.zakonczona ? "zakończone" : x.ponad ? `ponad plan o ${zl(x.zapl - x.plan)}` : x.plan ? `z ${zl(x.plan)}` : x.wPakiecie ? "z budżetu pakietu" : "bez planu";
  return `<a class="poz" href="#poz/${esc(x.p.id)}">
    ${kolkoPozycji(x)}
    <span class="poz-t"><span class="poz-n">${esc(x.p.nazwa)}</span>${pod.length ? `<span class="poz-m">${pod.map(esc).join(", ")}</span>` : ""}</span>
    <span class="poz-c"><span class="poz-v">${kw(x.zapl)}</span><span class="poz-p ${x.ponad && !x.wPakiecie ? "zle" : ""}">${plan}</span></span>
  </a>`;
}
function wierszPlatnosci(pl, bezPozycji) {
  const p = poz(pl.pozycja);
  const tytul = pl.zrodlo === "arkusz" ? (p?.nazwa || "Płatność") : (pl.opis || p?.nazwa || "Płatność");
  const pod = [pl.zrodlo === "arkusz" ? "z arkusza" : !bezPozycji && pl.opis && p ? p.nazwa : "", pl.gdzie, p && !bezPozycji ? (p.zakup ? "zakup domu" : nazwaPom(p.pom)) : ""].filter(Boolean).map(esc).join(", ");
  return `<button class="pl" type="button" data-pl="${esc(pl.id)}"><span class="pl-g"><span class="pl-n">${esc(tytul)}</span><span class="pl-k">${kw(pl.kwotaGr)}</span></span><span class="pl-m">${pl.data ? dataPL(pl.data) + (pod ? ", " : "") : ""}${pod}${pl.pliki?.length ? ` <span class="spinacz">📎${pl.pliki.length}</span>` : ""}</span></button>`;
}
function pierscien(proc) {
  const r = 30, c = 2 * Math.PI * r, p = Math.max(0, Math.min(proc, 100));
  return `<svg class="ring" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="ring-t"/><circle cx="38" cy="38" r="${r}" class="ring-v" stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 38 38)"/></svg>`;
}
const naglowek = (tytul, wstecz, prawy = "") => `<header class="top">${wstecz ? `<a class="okr" href="${wstecz}" aria-label="Wstecz">${ikona("wstecz")}</a>` : ""}<h1>${tytul}</h1>${prawy}</header>`;

/* ---------- ekran: Dom ---------- */
function ekranDom() {
  const w = wykonczenie(), s = suma(w), sz = suma(zakup());
  const wpisany = S.dane.ustawienia.budzetGr || 0, budzet = wpisany || s.plan;
  const pieniadze = budzet - s.zapl, brak = s.zostalo - pieniadze;
  const proc = budzet ? Math.round((s.zapl / budzet) * 100) : 0;
  const d = new Date();
  let h = `<header class="top dom-top"><div><p class="powitanie">Dom, ${d.getDate()} ${["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"][d.getMonth()]}</p><h1>Wykończenie</h1></div><span class="sync" id="sync" data-s="ok"></span></header>`;
  h += `<section class="hero">
    <div class="hero-g"><div><p class="hero-l">Wydane</p><p class="hero-v">${kw(s.zapl)}</p><p class="hero-s">z ${zl(budzet)} ${wpisany ? "budżetu" : "w planach"}</p></div><div class="hero-r">${pierscien(proc)}<span>${proc}%</span></div></div>
  </section>
  <div class="duo">
    <button class="mini mini-y" type="button" data-budzet>${wpisany ? `<p class="mini-l">Zostało pieniędzy</p><p class="mini-v ${pieniadze < 0 ? "zle" : ""}">${kw(pieniadze)}</p><p class="mini-s">budżet ${zl(wpisany)}</p>` : `<p class="mini-l">Ile masz pieniędzy?</p><p class="mini-v">Wpisz budżet</p><p class="mini-s">porównam z planami</p>`}</button>
    <div class="mini mini-w"><p class="mini-l">Potrzeba jeszcze</p><p class="mini-v">${kw(s.zostalo)}</p><p class="mini-s ${brak > 0 ? "zle" : "ok"}">${brak > 0 ? `brakuje ${zl(brak)}` : `zapas ${zl(-brak)}`}</p></div>
  </div>`;
  const uwagi = w.filter((x) => x.ponad || (x.bezPlanu && x.zapl));
  const pakPonad = [...S.pakiety.values()].filter((g) => g.ponad);
  if (uwagi.length || pakPonad.length) {
    const kwota = uwagi.reduce((a, x) => a + (x.ponad ? x.zapl - x.plan : x.zapl), 0) + pakPonad.reduce((a, g) => a + g.zapl - g.plan, 0);
    h += `<a class="alert" href="#lista/uwaga"><span class="alert-i">!</span><span><b>${uwagi.length + pakPonad.length} ${uwagi.length + pakPonad.length === 1 ? "pozycja" : "pozycje"} poza planem</b><span>${zl(kwota)} ponad plany: ${[...pakPonad.map((g) => g.pk.nazwa), ...uwagi.map((x) => x.p.nazwa)].map(esc).join(", ")}</span></span>${ikona("strzalka", 20)}</a>`;
  }
  const grupy = new Map();
  for (const x of w) { const k = pom().some((r) => r.id === x.p.pom) ? x.p.pom : ""; if (!grupy.has(k)) grupy.set(k, []); grupy.get(k).push(x); }
  const kafle = pom().map((r) => ({ r, s: suma(grupy.get(r.id) || []) }));
  h += `<div class="sekcja-h"><h2>Pomieszczenia</h2><a class="lnk" href="#ustawienia">Edytuj</a></div><div class="kafle">${kafle.map(({ r, s: g }) => `
    <a class="kafel" href="#pom/${esc(r.id)}" style="--k:${kolorPom(r.id)}">
      <span class="kafel-t"><span class="okr-b">${ikonaPom(r.id)}</span><span class="kafel-n">${esc(r.nazwa)}</span></span>
      <span class="kafel-v">${kw(g.zostalo)}</span>
      <span class="kafel-s">${g.n ? `zostało z ${zl(g.plan)}` : "brak pozycji"}</span>
      ${pasek(g.zapl, g.zostalo, g.plan)}
    </a>`).join("")}</div>`;
  if (S.pakiety.size) h += `<div class="sekcja-h"><h2>Pakiety</h2></div>${[...S.pakiety.values()].map((g) => `
    <a class="pakiet" href="#lista/pakiet:${esc(g.pk.id)}"><span class="pakiet-g"><span class="pakiet-n">${esc(g.pk.nazwa)}</span><span class="pakiet-v">${kw(g.zostalo)}</span></span>
    <span class="pakiet-s">${g.xs.map((x) => esc(x.p.nazwa)).join(", ")}<br>zapłacone ${zl(g.zapl)} z ${zl(g.plan)}</span>${pasek(g.zapl, g.zostalo, g.plan)}</a>`).join("")}`;
  const wyk = new Map();
  for (const pl of platnosci()) if (pl.gdzie && !poz(pl.pozycja)?.zakup) wyk.set(pl.gdzie, (wyk.get(pl.gdzie) || 0) + (pl.kwotaGr || 0));
  if (wyk.size) h += `<div class="sekcja-h"><h2>Komu płacisz</h2><a class="lnk" href="#platnosci">Wszystkie</a></div><div class="karta lista-p">${[...wyk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, k]) => `<a class="wk" href="#platnosci/${encodeURIComponent(g)}"><span>${esc(g)}</span><span class="num">${kw(k)}</span></a>`).join("")}</div>`;
  if (sz.n) h += `<div class="sekcja-h"><h2>Zakup domu</h2></div><div class="karta lista-p">${zakup().map((x) => `<a class="wk" href="#poz/${esc(x.p.id)}"><span>${esc(x.p.nazwa)}</span><span class="num">${kw(x.zapl)}</span></a>`).join("")}<p class="przyp">Razem ${zl(sz.zapl)}. Nie liczy się do wykończenia.</p></div>`;
  return h;
}

/* ---------- ekran: pomieszczenie ---------- */
function ekranPom(id) {
  const r = pom().find((x) => x.id === id);
  if (!r) return naglowek("Nie ma takiego pomieszczenia", "#dom");
  const xs = wykonczenie().filter((x) => x.p.pom === id), s = suma(xs);
  let h = naglowek(esc(r.nazwa), "#dom");
  h += `<section class="hero" style="--k:${kolorPom(id)}"><div class="hero-g"><div><p class="hero-l">Do wydania</p><p class="hero-v">${kw(s.zostalo)}</p><p class="hero-s">zapłacone ${zl(s.zapl)} z ${zl(s.plan)}</p></div><span class="okr-b duza">${ikonaPom(id)}</span></div>${pasek(s.zapl, s.zostalo, s.plan)}</section>`;
  const luzne = xs.filter((x) => !x.wPakiecie);
  const pakiety = [...new Set(xs.filter((x) => x.wPakiecie).map((x) => x.wPakiecie.id))].map((pid) => S.pakiety.get(pid));
  h += `<div class="sekcja-h"><h2>Pozycje</h2><span class="szary">${xs.length}</span></div>`;
  if (luzne.length) h += `<div class="karta lista-poz">${luzne.map((x) => wierszPozycji(x)).join("")}</div>`;
  for (const g of pakiety) {
    const tu = xs.filter((x) => x.wPakiecie?.id === g.pk.id);
    h += `<div class="karta lista-poz pakiet-grupa"><a class="pakiet-gl" href="#lista/pakiet:${esc(g.pk.id)}"><span><b>${esc(g.pk.nazwa)}</b><span>wspólny budżet: zapłacone ${zl(g.zapl)} z ${zl(g.plan)}</span></span><span class="poz-c"><span class="poz-v">${kw(g.zostalo)}</span><span class="poz-p">zostało</span></span></a>${tu.map((x) => wierszPozycji(x)).join("")}</div>`;
  }
  if (!xs.length) h += `<p class="pusto">Nie ma tu jeszcze pozycji. Dodaj pierwszą, np. „Lampy” albo „Malowanie”.</p>`;
  h += `<button class="btn-czarny szeroki" type="button" data-nowa-poz="${esc(id)}">${ikona("plus", 20)} Dodaj pozycję</button>`;
  return h;
}

/* ---------- ekran: pozycja ---------- */
function ekranPoz(id) {
  const x = licz().get(id);
  if (!x) return naglowek("Nie ma takiej pozycji", "#dom");
  const p = x.p, wroc = p.zakup ? "#dom" : `#pom/${p.pom}`;
  const pl = platnosci().filter((q) => q.pozycja === id).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const pr = p.produkty || [], kup = kupioneProdukty(), sumaPr = pr.reduce((a, q) => a + (q.cenaGr || 0), 0);
  let h = naglowek(esc(p.nazwa), wroc, `<button class="okr" type="button" data-edytuj-poz="${esc(id)}" aria-label="Edytuj pozycję">${ikona("olowek")}</button>`);
  h += `<section class="hero" style="--k:${p.zakup ? "#E4E4EA" : kolorPom(p.pom)}">
    <p class="hero-meta">${[p.zakup ? "Zakup domu" : nazwaPom(p.pom), nazwaKat(p.kat)].filter(Boolean).map(esc).join(" · ")}</p>
    <div class="trio"><div><p class="hero-l">Zapłacone</p><p class="trio-v">${kw(x.zapl)}</p></div><div><p class="hero-l">Plan</p><p class="trio-v">${x.plan ? kw(x.plan) : "—"}</p></div><div><p class="hero-l">Zostało</p><p class="trio-v">${kw(x.zostalo)}</p></div></div>
    ${pasek(x.zapl, x.zostalo, x.plan)}
    ${stanPozycji(x) ? `<p class="hero-tag">${stanPozycji(x)}</p>` : ""}
    ${x.wPakiecie ? (() => { const g = S.pakiety.get(x.wPakiecie.id); return `<p class="hero-s">Pakiet „${esc(g.pk.nazwa)}”: zapłacone ${zl(g.zapl)} z ${zl(g.plan)}, zostało ${zl(g.zostalo)}.</p>`; })() : ""}
    ${p.notatka ? `<p class="hero-s">${esc(p.notatka)}</p>` : ""}
  </section>
  <button class="btn-czarny szeroki" type="button" data-nowa-pl="${esc(id)}">${ikona("plus", 20)} Dodaj płatność</button>`;
  h += `<div class="sekcja-h"><h2>Płatności${pl.length ? ` (${pl.length})` : ""}</h2></div>`;
  h += pl.length ? `<div class="karta lista-p">${pl.map((q) => wierszPlatnosci(q, true)).join("")}</div>` : `<p class="pusto">Jeszcze nic nie zapłacono.</p>`;
  h += `<div class="sekcja-h"><h2>Produkty${pr.length ? ` (${pr.length})` : ""}</h2><button class="lnk" type="button" data-nowy-prod="${esc(id)}">Dodaj</button></div>`;
  if (pr.length) {
    h += `<div class="karta">${pr.map((q) => `<div class="prod">
        <button class="prod-g" type="button" data-prod="${esc(id)}|${esc(q.id)}"><span class="prod-n">${esc(q.nazwa)}</span><span class="prod-m">${esc([q.model, q.sklep].filter(Boolean).join(", "))}</span></button>
        <span class="prod-c">${kw(q.cenaGr)}</span>
        <span class="prod-a">${q.link ? `<a class="chip" href="${esc(q.link)}" target="_blank" rel="noopener">Sklep ${ikona("strzalka", 16)}</a>` : ""}${kup.has(q.id) ? `<span class="tag ok">kupione</span>` : `<button class="chip chip-czarny" type="button" data-kup="${esc(id)}|${esc(q.id)}">Kupione</button>`}</span>
      </div>`).join("")}<p class="przyp">Razem ${zl(sumaPr)}${x.plan ? (sumaPr > x.plan ? `, o ${zl(sumaPr - x.plan)} więcej niż plan` : sumaPr === x.plan ? ", tyle co plan" : `, ${zl(x.plan - sumaPr)} poniżej planu`) : ""}.</p></div>`;
  } else h += `<p class="pusto">Dodaj konkretne modele z cenami, żeby widzieć, czy mieszczą się w planie.</p>`;
  return h;
}

/* ---------- ekran: lista pozycji ---------- */
const STANY = [["", "Wszystkie"], ["otwarte", "Do zapłaty"], ["uwaga", "Poza planem"], ["zakonczone", "Zakończone"]];
function ekranLista() {
  const f = S.fl;
  return `${naglowek("Wszystkie pozycje")}
  <label class="szukaj">${ikona("szukaj", 20)}<input id="fl-q" type="search" placeholder="Szukaj pozycji" value="${esc(f.q)}" autocomplete="off"></label>
  <div class="chipy" role="group" aria-label="Stan">${STANY.map(([v, n]) => `<button class="chip ${f.stan === v ? "on" : ""}" type="button" data-fl-stan="${v}">${n}</button>`).join("")}</div>
  <div class="chipy" role="group" aria-label="Pomieszczenie"><button class="chip ${!f.pom ? "on" : ""}" type="button" data-fl-pom="">Wszędzie</button>${pom().map((r) => `<button class="chip ${f.pom === r.id ? "on" : ""}" type="button" data-fl-pom="${esc(r.id)}"><span class="kropka" style="background:${kolorPom(r.id)}"></span>${esc(r.nazwa)}</button>`).join("")}</div>
  <div id="wyniki"></div>`;
}
function wynikiListy() {
  const f = S.fl, q = f.q.trim().toLowerCase();
  const pakF = f.stan.startsWith("pakiet:") ? f.stan.slice(7) : "";
  const l = [...licz().values()].sort((a, b) => (a.p.zakup ? 1 : 0) - (b.p.zakup ? 1 : 0)).filter((x) =>
    (!f.pom || x.p.pom === f.pom) &&
    (pakF ? x.p.pakiet === pakF : !f.stan || (f.stan === "otwarte" ? x.zostalo > 0 : f.stan === "uwaga" ? x.ponad || (x.bezPlanu && x.zapl) || S.pakiety.get(x.p.pakiet)?.ponad : f.stan === "zakonczone" ? x.p.zakonczona : true)) &&
    (!q || [x.p.nazwa, x.p.notatka, nazwaPom(x.p.pom), nazwaKat(x.p.kat), ...(x.p.produkty || []).map((p) => p.nazwa + " " + p.model)].join(" ").toLowerCase().includes(q)));
  const s = suma(l.filter((x) => !x.p.zakup));
  if (!l.length) return `<p class="pusto">Nic tu nie pasuje. Zmień filtry albo wyszukiwanie.</p>`;
  return `<p class="podsum">${pakF ? `Pakiet ${esc(nazwaPak(pakF))}: ` : ""}${l.length} poz., zapłacone ${zl(s.zapl)} z ${zl(s.plan)}</p><div class="karta lista-poz">${l.map((x) => wierszPozycji(x, true)).join("")}</div>`;
}

/* ---------- ekran: płatności ---------- */
function ekranPlatnosci() {
  const g = S.fp.gdzie;
  return `${naglowek("Płatności")}
  <button class="btn-czarny szeroki odstep" type="button" data-nowa-pl="">${ikona("plus", 20)} Dodaj płatność</button>
  <div class="chipy" role="group" aria-label="Wykonawca lub sklep"><button class="chip ${!g ? "on" : ""}" type="button" data-fp-gdzie="">Wszyscy</button>${wykonawcy().map((w) => `<button class="chip ${g === w ? "on" : ""}" type="button" data-fp-gdzie="${esc(w)}">${esc(w)}</button>`).join("")}</div>
  <div id="wyniki"></div>`;
}
function wynikiPlatnosci() {
  const g = S.fp.gdzie;
  const l = platnosci().filter((pl) => !poz(pl.pozycja)?.zakup && (!g || pl.gdzie === g)).sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.utworzono || "").localeCompare(a.utworzono || ""));
  if (!l.length) return `<p class="pusto">Brak płatności. Dodaj pierwszą przyciskiem plus.</p>`;
  const razem = l.reduce((a, p) => a + (p.kwotaGr || 0), 0);
  const grupy = new Map();
  for (const pl of l) { const k = pl.data ? pl.data.slice(0, 7) : "brak"; if (!grupy.has(k)) grupy.set(k, []); grupy.get(k).push(pl); }
  let h = `<section class="hero hero-plaski"><p class="hero-l">${g ? esc(g) : "Wykończenie razem"}</p><p class="hero-v">${kw(razem)}</p><p class="hero-s">${l.length} płatności, bez zakupu domu</p></section>`;
  for (const [k, ps] of grupy) {
    const t = k === "brak" ? "Przeniesione z arkusza" : `${MIES[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
    h += `<div class="sekcja-h"><h2>${t.charAt(0).toUpperCase() + t.slice(1)}</h2><span class="num szary">${zl(ps.reduce((a, p) => a + (p.kwotaGr || 0), 0))}</span></div><div class="karta lista-p">${ps.map((pl) => wierszPlatnosci(pl)).join("")}</div>`;
  }
  return h;
}

/* ---------- ekran: ustawienia ---------- */
function ekranUstawienia() {
  const ile = (typ, id) => pozycje().filter((p) => p[SLOWNIK[typ].pole] === id).length;
  const ask = (typ, id) => {
    if (S.usuwanie?.typ !== typ || S.usuwanie.id !== id) return "";
    const n = ile(typ, id);
    if (typ === "pak" || !n) return `<div class="ask">${n ? `${n} pozycji zostanie bez pakietu. ` : ""}Usunąć? <button class="chip chip-zle" type="button" data-del-ok>Usuń</button><button class="chip" type="button" data-del-no>Nie</button></div>`;
    return `<div class="ask">${n} pozycji ma tę wartość. Przenieś je do: <select class="pole" id="u-move">${slownik(typ).filter((x) => x.id !== id).map((x) => `<option value="${esc(x.id)}">${esc(x.nazwa)}</option>`).join("")}</select><button class="chip chip-zle" type="button" data-del-ok>Przenieś i usuń</button><button class="chip" type="button" data-del-no>Anuluj</button></div>`;
  };
  const lista = (typ, tytul, opis) => `<div class="sekcja-h"><h2>${tytul}</h2></div><div class="karta ust">${opis ? `<p class="przyp">${opis}</p>` : ""}${slownik(typ).map((x) => `<div class="ust-w">
      ${typ === "pom" ? `<button class="kolor" type="button" data-kolor="${esc(x.id)}" style="background:${kolorPom(x.id)}" aria-label="Zmień kolor: ${esc(x.nazwa)}"></button>` : ""}
      <input class="pole" type="text" value="${esc(x.nazwa)}" data-u="${typ}" data-id="${esc(x.id)}" aria-label="Nazwa">
      <button class="okr maly" type="button" data-u-del="${typ}" data-id="${esc(x.id)}" aria-label="Usuń ${esc(x.nazwa)}">${ikona("x", 18)}</button>
      ${ask(typ, x.id)}</div>`).join("")}
    <form class="ust-w" data-dodaj="${typ}"><input class="pole" type="text" placeholder="Dodaj: ${SLOWNIK[typ].nazwa}" aria-label="Nowe: ${SLOWNIK[typ].nazwa}"><button class="okr maly czarny" type="submit" aria-label="Dodaj">${ikona("plus", 18)}</button></form></div>`;
  const b = S.dane.ustawienia.budzetGr || 0;
  return `${naglowek("Ustawienia")}
  <button class="mini mini-y szeroki" type="button" data-budzet><p class="mini-l">Budżet wykończenia</p><p class="mini-v">${b ? kw(b) : "Wpisz kwotę"}</p><p class="mini-s">ile masz pieniędzy na wykończenie</p></button>
  ${lista("pom", "Pomieszczenia", "Kliknij kółko, żeby zmienić kolor.")}
  ${lista("kat", "Kategorie")}
  ${lista("pak", "Pakiety", "Kilka pozycji ze wspólnym budżetem, np. wykonawca z materiałami. Pozycję dopinasz w jej edycji.")}
  <div class="sekcja-h"><h2>Kopia danych</h2></div>
  <div class="karta"><p class="przyp">Baza trzyma 300 poprzednich wersji, więc każdą pomyłkę da się cofnąć. Pliki CSV otworzysz w Excelu i Arkuszach Google.</p><div class="rzad"><button class="chip" type="button" id="u-csv-poz">CSV pozycji</button><button class="chip" type="button" id="u-csv-pl">CSV płatności</button></div></div>`;
}

/* ---------- arkusze (formularze od dołu) ---------- */
function pokazArkusz(html, fokus) {
  $("#arkusz").innerHTML = `<div class="uchwyt" aria-hidden="true"></div>${html}`;
  $("#zaslona").hidden = false; document.body.classList.add("blok");
  if (!history.state?.ov) history.pushState({ ov: 1 }, "", location.href);
  if (fokus) setTimeout(() => $(fokus)?.focus(), 60);
}
function ukryjArkusz() {
  const e = S.sheet;
  if (e?.typ === "pl" && e.nowe?.length && !e.zapisano) for (const p of e.nowe) usunPlik(p);
  S.sheet = null; $("#zaslona").hidden = true; $("#arkusz").innerHTML = ""; document.body.classList.remove("blok");
}
function zamknijArkusz() { ukryjArkusz(); if (history.state?.ov) { S.cichyPop = true; history.back(); } }
const chipyWyboru = (nazwa, lista, wybrany, kolory) => `<div class="chipy" role="radiogroup">${lista.map((x) => `<button class="chip ${x.id === wybrany ? "on" : ""}" type="button" role="radio" aria-checked="${x.id === wybrany}" data-wybor="${nazwa}" data-v="${esc(x.id)}">${kolory ? `<span class="kropka" style="background:${kolorPom(x.id)}"></span>` : ""}${esc(x.nazwa)}</button>`).join("")}</div>`;
const wybrane = (nazwa) => $(`#arkusz [data-wybor="${nazwa}"].on`)?.dataset.v || "";

function arkuszNowejPozycji(pomId) {
  S.sheet = { typ: "nowa-poz" };
  const p0 = pomId || S.ostatnie.pom || pom()[0]?.id;
  setTimeout(() => { for (const b of document.querySelectorAll("#arkusz [data-wybor].on")) b.scrollIntoView({ block: "nearest", inline: "center" }); }, 80);
  pokazArkusz(`<form id="f-nowa-poz" class="ark" novalidate>
    <h2>Nowa pozycja</h2>
    <label class="pole-l" for="np-nazwa">Co to jest?</label><input class="pole duze" id="np-nazwa" placeholder="np. Lampy nad wyspą" autocomplete="off" enterkeyhint="next">
    <label class="pole-l" for="np-plan">Plan, ile chcesz wydać <span class="szary">(można później)</span></label><input class="pole" id="np-plan" inputmode="decimal" placeholder="0 zł" autocomplete="off" enterkeyhint="done">
    <p class="pole-l">Pomieszczenie</p>${chipyWyboru("pom", pom(), p0, true)}
    <p class="pole-l">Kategoria <span class="szary">(opcjonalnie)</span></p>${chipyWyboru("kat", kat(), S.ostatnie.kat || "")}
    <p class="blad" id="np-blad" hidden></p>
    <div class="ark-akcje"><button class="btn-jasny" type="button" id="np-kolejna">Dodaj i następna</button><button class="btn-czarny" type="submit">Dodaj</button></div>
  </form>`, "#np-nazwa");
}
async function zapiszNowaPozycje(kolejna) {
  const nazwa = $("#np-nazwa").value.trim(), t = $("#np-plan").value.trim(), plan = t ? parseKwota(t) : 0, pomId = wybrane("pom"), katId = wybrane("kat");
  const blad = !nazwa ? "Wpisz, co to jest." : plan === null || plan < 0 ? "Plan wpisz liczbą, np. 3500." : !pomId ? "Wybierz pomieszczenie." : "";
  if (blad) { const e = $("#np-blad"); e.textContent = blad; e.hidden = false; return; }
  const id = losoweId();
  try {
    await zmien(`Nowa pozycja: ${nazwa} (${nazwaPom(pomId)})`, (d) => { d.pozycje.push({ id, nazwa, pom: pomId, kat: katId, planGr: plan || 0, zakonczona: false, zakup: false, notatka: "" }); });
    S.ostatnie = { ...S.ostatnie, pom: pomId, kat: katId };
    toast(`Dodano: ${nazwa}`);
    if (kolejna) { $("#np-nazwa").value = ""; $("#np-plan").value = ""; $("#np-nazwa").focus(); }
    else zamknijArkusz();
  } catch (e) { bladZapisu(e); }
}

function opcjePozycji(wyb) {
  const o = (p) => `<option value="${esc(p.id)}" ${p.id === wyb ? "selected" : ""}>${esc(p.nazwa)}</option>`;
  let h = `<option value="">Wybierz pozycję</option>`;
  for (const r of pom()) { const ps = pozycje().filter((p) => !p.zakup && p.pom === r.id); if (ps.length) h += `<optgroup label="${esc(r.nazwa)}">${ps.map(o).join("")}</optgroup>`; }
  const zk = pozycje().filter((p) => p.zakup); if (zk.length) h += `<optgroup label="Zakup domu">${zk.map(o).join("")}</optgroup>`;
  return h;
}
function arkuszPlatnosci(id, pozId, prod) {
  const pl = id ? platnosci().find((q) => q.id === id) : null;
  S.sheet = { typ: "pl", id: pl?.id || null, pliki: [...(pl?.pliki || [])], nowe: [], wgrywa: false, produkt: prod?.id || pl?.produkt || "" };
  const wyb = pl?.pozycja || pozId || "";
  const kwota = pl ? f2.format(pl.kwotaGr / 100) : prod ? f2.format(prod.cenaGr / 100) : "";
  pokazArkusz(`<form id="f-pl" class="ark" novalidate>
    <h2>${pl ? "Płatność" : prod ? "Płatność za produkt" : "Nowa płatność"}</h2>
    <label class="pole-l" for="pl-kwota">Kwota</label><div class="kwota-w"><input class="pole kwota" id="pl-kwota" inputmode="decimal" placeholder="0" value="${kwota}" autocomplete="off"><span>zł</span></div>
    <label class="pole-l" for="pl-poz">Za co</label><select class="pole" id="pl-poz">${opcjePozycji(wyb)}</select>
    <label class="pole-l" for="pl-opis">Opis <span class="szary">(opcjonalnie)</span></label><input class="pole" id="pl-opis" placeholder="np. zaliczka, klej do płytek" value="${esc(pl?.opis ?? (prod ? [prod.nazwa, prod.model].filter(Boolean).join(" ") : ""))}" autocomplete="off">
    <label class="pole-l" for="pl-gdzie">Komu</label><input class="pole" id="pl-gdzie" list="dl-gdzie" placeholder="np. Kazik, Leroy Merlin" value="${esc(pl?.gdzie ?? prod?.sklep ?? "")}" autocomplete="off"><datalist id="dl-gdzie">${wykonawcy().map((g) => `<option value="${esc(g)}">`).join("")}</datalist>
    ${wykonawcy().length ? `<div class="chipy">${wykonawcy().slice(0, 6).map((g) => `<button class="chip" type="button" data-gdzie="${esc(g)}">${esc(g)}</button>`).join("")}</div>` : ""}
    <div class="dwa"><div><label class="pole-l" for="pl-data">Data</label><input class="pole" id="pl-data" type="date" value="${pl ? pl.data || "" : dzis()}"></div><div><p class="pole-l">Paragon</p><div class="pliki" id="pl-pliki"></div></div></div>
    <input type="file" id="pl-plik" accept="image/*,application/pdf" multiple hidden>
    <label class="pole-l" for="pl-notatka">Notatka</label><input class="pole" id="pl-notatka" placeholder="nr faktury, gwarancja" value="${esc(pl?.notatka || "")}" autocomplete="off">
    <p class="blad" id="pl-blad" hidden></p>
    <div class="ark-akcje">${pl ? `<button class="btn-jasny zle" type="button" id="pl-usun">Usuń</button>` : ""}<button class="btn-czarny" type="submit" id="pl-zapisz">Zapisz</button></div>
  </form>`, pl ? null : "#pl-kwota");
  renderPliki();
}
function renderPliki() {
  const e = S.sheet; if (!e || e.typ !== "pl") return;
  const box = $("#pl-pliki");
  box.innerHTML = e.pliki.map((p, i) => `<span class="plik">${p.typ === "application/pdf" ? `<button type="button" class="plik-pdf" data-pdf="${esc(p.id)}">PDF</button>` : `<img alt="${esc(p.nazwa || "paragon")}" data-blob="${esc(p.id)}" data-zoom>`}<button type="button" class="plik-x" data-rm="${i}" aria-label="Usuń załącznik">${ikona("x", 14)}</button></span>`).join("")
    + `<button type="button" class="plik plik-dodaj" id="pl-dodaj-plik" aria-label="Dodaj zdjęcie lub PDF" ${e.wgrywa ? "disabled" : ""}>${e.wgrywa ? "…" : ikona("aparat")}</button>`;
  for (const img of box.querySelectorAll("img[data-blob]")) blobUrl(img.dataset.blob).then((u) => (img.src = u), () => (img.alt = "brak"));
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
      toast(err?.code === "format" ? `${f.name}: użyj zdjęcia (JPG, PNG) albo PDF.` : err?.code === "duzy" ? `${f.name} jest za duży (limit 10 MB).` : `Nie udało się wgrać ${f.name}.`);
    }
  }
  e.wgrywa = false; renderPliki();
}
async function zapiszPlatnosc() {
  const e = S.sheet; if (!e || e.wgrywa) return;
  const kwG = parseKwota($("#pl-kwota").value), pozId = $("#pl-poz").value;
  const blad = kwG === null || kwG <= 0 ? "Wpisz kwotę, np. 1250,50." : !pozId ? "Wybierz, za co płacisz." : "";
  if (blad) { const er = $("#pl-blad"); er.textContent = blad; er.hidden = false; return; }
  const id = e.id || losoweId(), stara = platnosci().find((q) => q.id === e.id);
  const doc = { id, pozycja: pozId, data: $("#pl-data").value || "", kwotaGr: kwG, opis: $("#pl-opis").value.trim(), gdzie: $("#pl-gdzie").value.trim(), notatka: $("#pl-notatka").value.trim(), pliki: e.pliki, utworzono: stara?.utworzono || new Date().toISOString() };
  if (stara?.zrodlo) doc.zrodlo = stara.zrodlo;
  if (e.produkt) doc.produkt = e.produkt;
  const usuniete = (stara?.pliki || []).filter((p) => !e.pliki.some((q) => q.id === p.id)).map((p) => p.id);
  $("#pl-zapisz").disabled = true;
  try {
    await zmien(`${e.id ? "Zmiana płatności" : "Płatność"}: ${poz(pozId)?.nazwa || ""}, ${zl2(kwG)}${doc.gdzie ? ", " + doc.gdzie : ""}`, (d) => {
      const i = d.platnosci.findIndex((q) => q.id === id);
      if (i >= 0) d.platnosci[i] = doc; else d.platnosci.push(doc);
    });
    e.zapisano = true;
    for (const p of usuniete) usunPlik(p);
    toast(`Zapisano ${zl2(kwG)}: ${poz(pozId)?.nazwa || ""}`);
    zamknijArkusz();
  } catch (err) { bladZapisu(err); $("#pl-zapisz").disabled = false; }
}
async function usunPlatnosc() {
  const b = $("#pl-usun"), e = S.sheet, pl = platnosci().find((q) => q.id === e.id);
  if (!b.dataset.pewne) { b.dataset.pewne = "1"; b.textContent = "Na pewno?"; return; }
  try {
    await zmien(`Usunięto płatność: ${poz(pl?.pozycja)?.nazwa || ""}, ${zl2(pl?.kwotaGr)}`, (d) => { d.platnosci = d.platnosci.filter((q) => q.id !== e.id); });
    for (const p of pl?.pliki || []) usunPlik(p.id);
    e.zapisano = true; toast("Usunięto płatność."); zamknijArkusz();
  } catch (err) { bladZapisu(err); }
}

function arkuszEdycjiPozycji(id) {
  const p = poz(id); if (!p) return;
  S.sheet = { typ: "poz", id };
  const opcje = (lista, w, pusta) => (pusta ? `<option value="">${pusta}</option>` : "") + lista.map((x) => `<option value="${esc(x.id)}" ${x.id === w ? "selected" : ""}>${esc(x.nazwa)}</option>`).join("");
  pokazArkusz(`<form id="f-poz" class="ark" novalidate>
    <h2>Edycja pozycji</h2>
    <label class="pole-l" for="ep-nazwa">Nazwa</label><input class="pole duze" id="ep-nazwa" value="${esc(p.nazwa)}" autocomplete="off">
    <label class="pole-l" for="ep-plan">Plan</label><div class="kwota-w"><input class="pole kwota mala" id="ep-plan" inputmode="decimal" value="${p.planGr ? f0.format(p.planGr / 100) : ""}" placeholder="0"><span>zł</span></div>
    <div class="dwa"><div><label class="pole-l" for="ep-pom">Pomieszczenie</label><select class="pole" id="ep-pom">${opcje(pom(), p.pom)}</select></div><div><label class="pole-l" for="ep-kat">Kategoria</label><select class="pole" id="ep-kat">${opcje(kat(), p.kat, "Bez kategorii")}</select></div></div>
    ${pak().length ? `<label class="pole-l" for="ep-pak">Pakiet</label><select class="pole" id="ep-pak">${opcje(pak(), p.pakiet || "", "Bez pakietu")}</select>` : ""}
    <label class="przel"><input type="checkbox" id="ep-zak" ${p.zakonczona ? "checked" : ""}><span>Zakończone, nic więcej nie płacę</span></label>
    <label class="przel"><input type="checkbox" id="ep-zakup" ${p.zakup ? "checked" : ""}><span>Zakup domu, poza wykończeniem</span></label>
    <label class="pole-l" for="ep-notatka">Notatka</label><textarea class="pole" id="ep-notatka" rows="2" placeholder="zakres, ustalenia">${esc(p.notatka || "")}</textarea>
    <p class="blad" id="ep-blad" hidden></p>
    <div class="ark-akcje"><button class="btn-jasny zle" type="button" id="ep-usun">Usuń</button><button class="btn-czarny" type="submit">Zapisz</button></div>
  </form>`);
}
async function zapiszEdycjePozycji() {
  const id = S.sheet.id, nazwa = $("#ep-nazwa").value.trim(), t = $("#ep-plan").value.trim(), plan = t ? parseKwota(t) : 0;
  const blad = !nazwa ? "Wpisz nazwę." : plan === null || plan < 0 ? "Plan wpisz liczbą." : "";
  if (blad) { const e = $("#ep-blad"); e.textContent = blad; e.hidden = false; return; }
  const dane = { nazwa, planGr: plan || 0, pom: $("#ep-pom").value, kat: $("#ep-kat").value, pakiet: $("#ep-pak")?.value || "", zakonczona: $("#ep-zak").checked, zakup: $("#ep-zakup").checked, notatka: $("#ep-notatka").value.trim() };
  try { await zmien(`Pozycja: ${nazwa}`, (d) => { const p = d.pozycje.find((q) => q.id === id); if (p) Object.assign(p, dane); }); toast("Zapisano."); zamknijArkusz(); }
  catch (e) { bladZapisu(e); }
}
async function usunPozycje() {
  const id = S.sheet.id, b = $("#ep-usun"), n = platnosci().filter((q) => q.pozycja === id).length;
  if (n) { const e = $("#ep-blad"); e.textContent = `Ta pozycja ma ${n} płatności. Najpierw je usuń albo przepnij.`; e.hidden = false; return; }
  if (!b.dataset.pewne) { b.dataset.pewne = "1"; b.textContent = "Na pewno?"; return; }
  const p = poz(id);
  try { await zmien(`Usunięto pozycję: ${p?.nazwa}`, (d) => { d.pozycje = d.pozycje.filter((q) => q.id !== id); }); zamknijArkusz(); location.hash = p?.zakup ? "#dom" : `#pom/${p?.pom}`; toast("Usunięto pozycję."); }
  catch (e) { bladZapisu(e); }
}

function arkuszProduktu(pozId, prodId) {
  const x = (poz(pozId)?.produkty || []).find((q) => q.id === prodId);
  S.sheet = { typ: "prod", pozId, id: x?.id || null };
  pokazArkusz(`<form id="f-prod" class="ark" novalidate>
    <h2>${x ? "Produkt" : "Nowy produkt"}</h2>
    <label class="pole-l" for="pr-nazwa">Nazwa</label><input class="pole duze" id="pr-nazwa" value="${esc(x?.nazwa || "")}" placeholder="np. Zmywarka Bosch Serie 6" autocomplete="off">
    <div class="dwa"><div><label class="pole-l" for="pr-model">Model</label><input class="pole" id="pr-model" value="${esc(x?.model || "")}" autocomplete="off"></div><div><label class="pole-l" for="pr-cena">Cena</label><input class="pole" id="pr-cena" inputmode="decimal" value="${x ? f0.format(x.cenaGr / 100) : ""}" placeholder="0 zł"></div></div>
    <label class="pole-l" for="pr-sklep">Sklep</label><input class="pole" id="pr-sklep" value="${esc(x?.sklep || "")}" autocomplete="off">
    <label class="pole-l" for="pr-link">Link</label><input class="pole" id="pr-link" type="url" value="${esc(x?.link || "")}" placeholder="https://" autocomplete="off">
    <label class="pole-l" for="pr-notatka">Notatka</label><input class="pole" id="pr-notatka" value="${esc(x?.notatka || "")}" autocomplete="off">
    <p class="blad" id="pr-blad" hidden></p>
    <div class="ark-akcje">${x ? `<button class="btn-jasny zle" type="button" id="pr-usun">Usuń</button>` : ""}<button class="btn-czarny" type="submit">Zapisz</button></div>
  </form>`, x ? null : "#pr-nazwa");
}
async function zapiszProdukt() {
  const e = S.sheet, nazwa = $("#pr-nazwa").value.trim(), cena = parseKwota($("#pr-cena").value), link = $("#pr-link").value.trim();
  const blad = !nazwa ? "Wpisz nazwę." : cena === null || cena <= 0 ? "Wpisz cenę." : link && !/^https?:\/\//i.test(link) ? "Link musi zaczynać się od https://" : "";
  if (blad) { const er = $("#pr-blad"); er.textContent = blad; er.hidden = false; return; }
  const id = e.id || losoweId();
  const dane = { id, nazwa, model: $("#pr-model").value.trim(), cenaGr: cena, sklep: $("#pr-sklep").value.trim(), link, notatka: $("#pr-notatka").value.trim() };
  try {
    await zmien(`Produkt: ${nazwa}, ${zl2(cena)}`, (d) => { const p = d.pozycje.find((q) => q.id === e.pozId); if (!p) return; p.produkty ??= []; const i = p.produkty.findIndex((q) => q.id === id); if (i >= 0) p.produkty[i] = dane; else p.produkty.push(dane); });
    toast(`Zapisano: ${nazwa}`); zamknijArkusz();
  } catch (err) { bladZapisu(err); }
}
async function usunProdukt() {
  const e = S.sheet, b = $("#pr-usun");
  if (!b.dataset.pewne) { b.dataset.pewne = "1"; b.textContent = "Na pewno?"; return; }
  try { await zmien("Usunięto produkt", (d) => { const p = d.pozycje.find((q) => q.id === e.pozId); if (p) p.produkty = (p.produkty || []).filter((q) => q.id !== e.id); }); zamknijArkusz(); }
  catch (err) { bladZapisu(err); }
}

function arkuszBudzetu() {
  const b = S.dane.ustawienia.budzetGr || 0;
  S.sheet = { typ: "budzet" };
  pokazArkusz(`<form id="f-budzet" class="ark" novalidate>
    <h2>Budżet wykończenia</h2>
    <p class="przyp">Ile masz pieniędzy na wykończenie, razem z tym, co już wydałeś. Porównam to z planami pozycji.</p>
    <div class="kwota-w"><input class="pole kwota" id="b-kwota" inputmode="decimal" value="${b ? f0.format(b / 100) : ""}" placeholder="0" autocomplete="off"><span>zł</span></div>
    <div class="ark-akcje">${b ? `<button class="btn-jasny" type="button" id="b-wyczysc">Usuń kwotę</button>` : ""}<button class="btn-czarny" type="submit">Zapisz</button></div>
  </form>`, "#b-kwota");
}
async function zapiszBudzet(wyczysc) {
  const t = wyczysc ? "" : $("#b-kwota").value.trim(), v = t ? parseKwota(t) : 0;
  if (v === null || v < 0) { toast("Wpisz kwotę liczbą, np. 400000."); return; }
  try { await zmien(v ? `Budżet wykończenia: ${zl(v)}` : "Usunięto kwotę budżetu", (d) => { if (v) d.ustawienia.budzetGr = v; else delete d.ustawienia.budzetGr; }); toast(v ? `Budżet: ${zl(v)}` : "Budżet liczony z planów."); zamknijArkusz(); }
  catch (e) { bladZapisu(e); }
}

/* ---------- komunikaty ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3500); }
function sync(s) { S.sync = s; const e = $("#sync"); if (e) e.dataset.s = s; }
function bladZapisu(e) {
  const c = e?.code; sync("err");
  toast(c === "siec" ? "Brak internetu. Nic nie zostało zapisane." : c === "brak-bazy" ? "Baza nie jest przygotowana." : c === "konflikt" ? "Ktoś zapisywał w tym samym czasie. Spróbuj jeszcze raz." : "Nie udało się zapisać. Spróbuj ponownie.");
}

/* ---------- CSV ---------- */
function pobierzCsv(nazwa, rows) {
  const q = (v) => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const kwc = (gr) => f2.format((gr || 0) / 100).replace(/\s/g, "");
  const tekst = "﻿" + rows.map((r) => r.map((c) => q(typeof c === "object" && c ? kwc(c.gr) : c)).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([tekst], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `${nazwa}-${dzis()}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function csvPozycje() {
  const rows = [["Pomieszczenie", "Pozycja", "Kategoria", "Plan", "Zapłacone", "Zostało", "Zakończona", "Zakup domu", "Pakiet", "Produkty", "Notatka"]];
  for (const x of licz().values()) rows.push([nazwaPom(x.p.pom), x.p.nazwa, nazwaKat(x.p.kat), { gr: x.plan }, { gr: x.zapl }, { gr: x.zostalo }, x.p.zakonczona ? "tak" : "", x.p.zakup ? "tak" : "", nazwaPak(x.p.pakiet), (x.p.produkty || []).map((q) => `${q.nazwa} ${q.model || ""} ${f2.format(q.cenaGr / 100)} zł`.replace(/\s+/g, " ")).join(" | "), x.p.notatka]);
  pobierzCsv("koszty-pozycje", rows);
}
function csvPlatnosci() {
  const rows = [["Data", "Pozycja", "Pomieszczenie", "Opis", "Komu", "Kwota", "Notatka"]];
  for (const pl of [...platnosci()].sort((a, b) => (a.data || "").localeCompare(b.data || ""))) { const p = poz(pl.pozycja); rows.push([pl.data, p?.nazwa, p ? nazwaPom(p.pom) : "", pl.opis, pl.gdzie, { gr: pl.kwotaGr }, pl.notatka]); }
  pobierzCsv("koszty-platnosci", rows);
}

/* ---------- nawigacja ---------- */
function trasa() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [typ, ...reszta] = h.split("/"); const arg = reszta.join("/");
  if (typ === "pom" && arg) return { typ: "pom", id: arg };
  if (typ === "poz" && arg) return { typ: "poz", id: arg };
  if (typ === "lista") { if (arg) S.fl = { q: "", pom: "", stan: arg }; return { typ: "lista" }; }
  if (typ === "platnosci") { if (arg) S.fp.gdzie = arg; return { typ: "platnosci" }; }
  if (typ === "ustawienia") return { typ: "ustawienia" };
  return { typ: "dom" };
}
function render() {
  const e = S.ekran = trasa();
  const el = $("#ekran");
  for (const b of document.querySelectorAll("#nav [data-ekran]")) b.classList.toggle("on", b.dataset.ekran === (["pom", "poz"].includes(e.typ) ? "dom" : e.typ));
  if (!S.gotowe) { el.innerHTML = `<div class="ladowanie">${S.blad ? esc(S.blad) : "Wczytywanie…"}</div>`; return; }
  licz();
  const klucz = e.typ + "/" + (e.id || "");
  if ((e.typ === "lista" || e.typ === "platnosci") && S.ostatniKlucz === klucz && $("#wyniki")) { odswiezWyniki(); return; }
  if (e.typ === "ustawienia" && S.ostatniKlucz === klucz && el.contains(document.activeElement) && document.activeElement.matches("input")) return;
  const przewin = S.ostatniKlucz !== klucz;
  S.ostatniKlucz = klucz;
  el.innerHTML = e.typ === "pom" ? ekranPom(e.id) : e.typ === "poz" ? ekranPoz(e.id) : e.typ === "lista" ? ekranLista() : e.typ === "platnosci" ? ekranPlatnosci() : e.typ === "ustawienia" ? ekranUstawienia() : ekranDom();
  if (e.typ === "lista" || e.typ === "platnosci") odswiezWyniki();
  sync(S.sync || "ok");
  if (przewin) window.scrollTo(0, 0);
}
function odswiezWyniki() { const w = $("#wyniki"); if (w) w.innerHTML = S.ekran.typ === "lista" ? wynikiListy() : wynikiPlatnosci(); }

/* ---------- wczytanie i odświeżanie ---------- */
async function wczytaj() {
  try { const p = await pobierz(); S.wersja = p.wersja; S.blad = ""; ustawDane(p.dane); sync("ok"); }
  catch (e) { S.blad = e?.code === "brak-bazy" ? "Baza nie jest jeszcze przygotowana." : e?.code === "siec" ? "Brak internetu. Spróbuję ponownie za chwilę." : "Nie udało się wczytać danych. Spróbuję ponownie za chwilę."; sync("err"); render(); }
}
async function odswiez() {
  if (zajete || S.sheet || document.visibilityState !== "visible") return;
  if (!S.gotowe) return wczytaj();
  try { const p = await pobierz(); if (p.wersja !== S.wersja && !zajete && !S.sheet) { S.wersja = p.wersja; ustawDane(p.dane); } sync("ok"); }
  catch { sync("err"); }
}

/* ---------- zdarzenia ---------- */
function wire() {
  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", () => { if (S.cichyPop) { S.cichyPop = false; return; } if (S.sheet) ukryjArkusz(); });
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t.closest("[data-zamknij]")) { zamknijArkusz(); return; }
    const plB = t.closest("[data-pl]"); if (plB) { arkuszPlatnosci(plB.dataset.pl); return; }
    const np = t.closest("[data-nowa-poz]"); if (np) { arkuszNowejPozycji(np.dataset.nowaPoz); return; }
    const npl = t.closest("[data-nowa-pl]"); if (npl) { arkuszPlatnosci(null, npl.dataset.nowaPl); return; }
    const ep = t.closest("[data-edytuj-poz]"); if (ep) { arkuszEdycjiPozycji(ep.dataset.edytujPoz); return; }
    const nprod = t.closest("[data-nowy-prod]"); if (nprod) { arkuszProduktu(nprod.dataset.nowyProd, null); return; }
    const prod = t.closest("[data-prod]"); if (prod) { const [a, b] = prod.dataset.prod.split("|"); arkuszProduktu(a, b); return; }
    const kup = t.closest("[data-kup]"); if (kup) { const [a, b] = kup.dataset.kup.split("|"); arkuszPlatnosci(null, a, (poz(a)?.produkty || []).find((q) => q.id === b)); return; }
    if (t.closest("[data-budzet]")) { arkuszBudzetu(); return; }
    const wyb = t.closest("[data-wybor]"); if (wyb) { for (const b of document.querySelectorAll(`#arkusz [data-wybor="${wyb.dataset.wybor}"]`)) { const on = b === wyb && !(b.classList.contains("on") && wyb.dataset.wybor === "kat"); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); } return; }
    const gd = t.closest("[data-gdzie]"); if (gd) { $("#pl-gdzie").value = gd.dataset.gdzie; return; }
    const fs = t.closest("[data-fl-stan]"); if (fs) { S.fl.stan = fs.dataset.flStan; for (const b of document.querySelectorAll("[data-fl-stan]")) b.classList.toggle("on", b === fs); odswiezWyniki(); return; }
    const fpm = t.closest("[data-fl-pom]"); if (fpm) { S.fl.pom = fpm.dataset.flPom; for (const b of document.querySelectorAll("[data-fl-pom]")) b.classList.toggle("on", b === fpm); odswiezWyniki(); return; }
    const fg = t.closest("[data-fp-gdzie]"); if (fg) { S.fp.gdzie = fg.dataset.fpGdzie; for (const b of document.querySelectorAll("[data-fp-gdzie]")) b.classList.toggle("on", b === fg); odswiezWyniki(); return; }
    const z = t.closest("[data-zoom]"); if (z && z.src) { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${z.src}" alt="">`; lb.addEventListener("click", () => lb.remove()); document.body.append(lb); return; }
    const pdf = t.closest("[data-pdf]"); if (pdf) { const okno = window.open("", "_blank"); blobUrl(pdf.dataset.pdf).then((u) => { if (okno) okno.location.href = u; else location.href = u; }, () => { okno?.close(); toast("Nie udało się otworzyć pliku."); }); return; }
    const rm = t.closest("[data-rm]"); if (rm && S.sheet?.typ === "pl") { S.sheet.pliki.splice(+rm.dataset.rm, 1); renderPliki(); return; }
    if (t.closest("#pl-dodaj-plik")) { $("#pl-plik").click(); return; }
    if (t.id === "np-kolejna") { zapiszNowaPozycje(true); return; }
    if (t.id === "pl-usun") { usunPlatnosc(); return; }
    if (t.id === "ep-usun") { usunPozycje(); return; }
    if (t.id === "pr-usun") { usunProdukt(); return; }
    if (t.id === "b-wyczysc") { zapiszBudzet(true); return; }
    const kol = t.closest("[data-kolor]"); if (kol) { const id = kol.dataset.kolor, i = PASTELE.indexOf(kolorPom(id)), nowy = PASTELE[(i + 1) % PASTELE.length]; kol.style.background = nowy; zmien("Kolor pomieszczenia", (d) => { const r = d.ustawienia.pomieszczenia.find((q) => q.id === id); if (r) r.kolor = nowy; }).catch(bladZapisu); return; }
    const ud = t.closest("[data-u-del]"); if (ud) { S.usuwanie = { typ: ud.dataset.uDel, id: ud.dataset.id }; S.ostatniKlucz = ""; render(); return; }
    if (t.closest("[data-del-no]")) { S.usuwanie = null; S.ostatniKlucz = ""; render(); return; }
    if (t.closest("[data-del-ok]")) { usunZeSlownika(); return; }
    if (t.id === "u-csv-poz") { csvPozycje(); return; }
    if (t.id === "u-csv-pl") { csvPlatnosci(); return; }
  });
  document.addEventListener("input", (ev) => { if (ev.target.id === "fl-q") { S.fl.q = ev.target.value; odswiezWyniki(); } });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "pl-plik") { const fs = [...t.files]; t.value = ""; if (fs.length) wgraj(fs); return; }
    const u = t.dataset.u; if (!u || !S.gotowe) return;
    const id = t.dataset.id, x = slownik(u).find((y) => y.id === id), v = t.value.trim();
    if (!x || !v || v === x.nazwa) { t.value = x?.nazwa || ""; return; }
    t.blur();
    zmien(`Zmiana nazwy: ${x.nazwa} → ${v}`, (d) => { const y = (d.ustawienia[SLOWNIK[u].klucz] ??= []).find((q) => q.id === id); if (y) y.nazwa = v; }).catch(bladZapisu);
  });
  document.addEventListener("submit", (ev) => {
    const f = ev.target; ev.preventDefault();
    if (f.id === "f-nowa-poz") return zapiszNowaPozycje(false);
    if (f.id === "f-pl") return zapiszPlatnosc();
    if (f.id === "f-poz") return zapiszEdycjePozycji();
    if (f.id === "f-prod") return zapiszProdukt();
    if (f.id === "f-budzet") return zapiszBudzet(false);
    const typ = f.dataset.dodaj;
    if (typ) {
      const inp = f.querySelector("input"), n = inp.value.trim(); if (!n) return;
      if (slownik(typ).some((x) => x.nazwa.toLowerCase() === n.toLowerCase())) { toast(`„${n}” już jest na liście.`); return; }
      inp.value = ""; inp.blur();
      zmien(`Dodano ${SLOWNIK[typ].nazwa}: ${n}`, (d) => { const l = (d.ustawienia[SLOWNIK[typ].klucz] ??= []); l.push({ id: noweId(l, n), nazwa: n }); }).then(() => { S.ostatniKlucz = ""; render(); }, bladZapisu);
    }
  });
  $("#zaslona").addEventListener("click", (e) => { if (e.target.id === "zaslona") zamknijArkusz(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const lb = $(".lightbox"); if (lb) lb.remove(); else if (S.sheet) zamknijArkusz(); } });
  document.addEventListener("visibilitychange", odswiez);
  setInterval(odswiez, 15000);
}
async function usunZeSlownika() {
  const { typ, id } = S.usuwanie, pole = SLOWNIK[typ].pole;
  const n = pozycje().filter((p) => p[pole] === id).length, cel = typ === "pak" ? "" : $("#u-move")?.value || "";
  if (n && !cel && typ !== "pak") return;
  try {
    await zmien(`Usunięto ${SLOWNIK[typ].nazwa} ${id}${n ? `, przeniesiono ${n} pozycji` : ""}`, (d) => {
      for (const p of d.pozycje) if (p[pole] === id) p[pole] = cel;
      const l = d.ustawienia[SLOWNIK[typ].klucz] ??= [];
      const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1);
    });
    S.usuwanie = null; S.ostatniKlucz = ""; render();
  } catch (e) { bladZapisu(e); }
}

/* ---------- start ---------- */
try { localStorage.removeItem("kd-gh-token"); localStorage.removeItem("kd-view"); } catch {}
if (/^klucz=/.test(location.hash.slice(1)) || ["podsumowanie", "pozycje"].includes(location.hash.slice(1))) history.replaceState(null, "", location.pathname + location.search);
wire(); render(); wczytaj();
})();

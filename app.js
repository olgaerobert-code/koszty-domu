(() => {
const REPO_DANE = { owner: "olgaerobert-code", repo: "koszty-domu-dane", plik: "dane.json", branch: "main" };
const DOMYSLNE = {
  pomieszczenia: [
    { id: "caly-dom", nazwa: "Cały dom", budzetGr: 0 },
    { id: "kuchnia", nazwa: "Kuchnia", budzetGr: 0 },
    { id: "salon", nazwa: "Salon", budzetGr: 0 },
    { id: "sypialnia", nazwa: "Sypialnia", budzetGr: 0 },
    { id: "lazienka", nazwa: "Łazienka", budzetGr: 0 },
    { id: "przedpokoj", nazwa: "Przedpokój", budzetGr: 0 },
  ],
  kategorie: [
    { id: "materialy", nazwa: "Materiały budowlane" },
    { id: "robocizna", nazwa: "Robocizna" },
    { id: "meble", nazwa: "Meble i zabudowy" },
    { id: "agd", nazwa: "AGD i RTV" },
    { id: "elektryka", nazwa: "Elektryka i oświetlenie" },
    { id: "hydraulika", nazwa: "Hydraulika i armatura" },
    { id: "podlogi", nazwa: "Podłogi i płytki" },
    { id: "drzwi", nazwa: "Drzwi i okna" },
    { id: "dekoracje", nazwa: "Dekoracje i tekstylia" },
    { id: "inne", nazwa: "Transport i inne" },
  ],
};

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
function iso(y, m, d) {
  y = +y; m = +m; d = +d;
  if (!(y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}
function parseData(s) {
  s = String(s ?? "").trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/))) return iso(m[3].length === 2 ? "20" + m[3] : m[3], m[2], m[1]);
  if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})$/))) return iso(new Date().getFullYear(), m[2], m[1]);
  return "";
}
const dataPL = (d) => d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "—";

/* ---------- GitHub jako baza ---------- */
const TOKEN_KEY = "kd-gh-token";
const czytajToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
const zapiszToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };
const b64enc = (bytes) => { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = (s) => Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0));
const sciezka = (p) => `/repos/${REPO_DANE.owner}/${REPO_DANE.repo}/contents/${p.split("/").map(encodeURIComponent).join("/")}`;

async function gh(path, opts = {}) {
  let r;
  try {
    r = await fetch("https://api.github.com" + path, { ...opts, cache: "no-store", headers: { Authorization: "Bearer " + S.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) } });
  } catch { throw { code: "siec" }; }
  if (r.status === 401) throw { code: "token", status: 401 };
  if (r.status === 403 || r.status === 429) {
    if (r.headers.get("x-ratelimit-remaining") === "0") throw { code: "limit", status: r.status };
    throw { code: "dostep", status: r.status };
  }
  return r;
}
async function pobierz() {
  const r = await gh(sciezka(REPO_DANE.plik) + "?ref=" + REPO_DANE.branch);
  if (r.status === 404) {
    const repo = await gh(`/repos/${REPO_DANE.owner}/${REPO_DANE.repo}`);
    if (!repo.ok) throw { code: "dostep", status: 404 };
    return { sha: null, dane: { wersja: 1, ustawienia: klon(DOMYSLNE), wydatki: [] } };
  }
  if (!r.ok) throw { code: "inny", status: r.status };
  const j = await r.json();
  let tekst;
  if (j.encoding === "base64" && j.content) tekst = new TextDecoder().decode(b64dec(j.content));
  else {
    const b = await gh(`/repos/${REPO_DANE.owner}/${REPO_DANE.repo}/git/blobs/${j.sha}`, { headers: { Accept: "application/vnd.github.raw+json" } });
    tekst = await b.text();
  }
  const dane = JSON.parse(tekst);
  dane.ustawienia ??= klon(DOMYSLNE); dane.wydatki ??= [];
  return { sha: j.sha, dane };
}
let kolejka = Promise.resolve();
function wKolejce(fn) { const p = kolejka.then(fn); kolejka = p.catch(() => {}); return p; }
let zajete = 0;
/* zmien(opis, fn): fn zmienia kopię danych; zapis = jeden commit; przy konflikcie dane są pobierane ponownie i zmiana nakładana jeszcze raz */
function zmien(opis, fn) {
  return wKolejce(async () => {
    zajete++; sync("saving", "Zapisywanie…");
    try {
      for (let proba = 0; proba < 4; proba++) {
        const draft = klon(S.dane);
        fn(draft);
        const body = { message: opis, branch: REPO_DANE.branch, content: b64enc(new TextEncoder().encode(JSON.stringify(draft, null, 1))) };
        if (S.sha) body.sha = S.sha;
        const r = await gh(sciezka(REPO_DANE.plik), { method: "PUT", body: JSON.stringify(body) });
        if (r.ok) { const j = await r.json(); S.sha = j.content.sha; ustawDane(draft); sync("ok", "Zapisano"); return; }
        if (r.status === 409 || r.status === 422) { const p = await pobierz(); S.sha = p.sha; ustawDane(p.dane); continue; }
        throw { code: "inny", status: r.status };
      }
      throw { code: "konflikt" };
    } finally { zajete--; }
  });
}
function wgrajPlikGH(path, bytes, opis) {
  return wKolejce(async () => {
    const r = await gh(sciezka(path), { method: "PUT", body: JSON.stringify({ message: opis, branch: REPO_DANE.branch, content: b64enc(bytes) }) });
    if (!r.ok) throw { code: "inny", status: r.status };
  });
}
function usunPlikGH(path) {
  return wKolejce(async () => {
    const m = await gh(sciezka(path) + "?ref=" + REPO_DANE.branch);
    if (m.status === 404) return;
    if (!m.ok) throw { code: "inny", status: m.status };
    const { sha } = await m.json();
    await gh(sciezka(path), { method: "DELETE", body: JSON.stringify({ message: "Usunięto załącznik " + path, sha, branch: REPO_DANE.branch }) });
  }).catch(() => {});
}
const bloby = new Map();
function blobUrl(path) {
  if (!bloby.has(path)) bloby.set(path, gh(sciezka(path) + "?ref=" + REPO_DANE.branch, { headers: { Accept: "application/vnd.github.raw+json" } })
    .then((r) => { if (!r.ok) throw 0; return r.blob(); }).then((b) => URL.createObjectURL(b)).catch((e) => { bloby.delete(path); throw e; }));
  return bloby.get(path);
}

const S = {
  token: czytajToken(), zalogowany: false, logowanie: false, bladLogowania: "",
  dane: null, sha: null, ust: null, wyd: [], ustLoaded: false, wydLoaded: false,
  view: "podsumowanie", f: { q: "", pom: "", kat: "", st: "" },
  edit: null, usuwanie: null, imp: null, importuje: false,
};
function ustawDane(d) { S.dane = d; S.ust = d.ustawienia; S.wyd = d.wydatki; S.ustLoaded = S.wydLoaded = true; render(); }
const pisanie = () => S.zalogowany;
const pom = () => S.ust?.pomieszczenia || [];
const kat = () => S.ust?.kategorie || [];
const nazwaPom = (id) => pom().find((p) => p.id === id)?.nazwa || "Bez pomieszczenia";
const nazwaKat = (id) => kat().find((k) => k.id === id)?.nazwa || "Bez kategorii";

/* ---------- komunikaty ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200); }
function sync(s, txt) { const e = $("#sync"); e.dataset.s = s; e.textContent = txt; }
function bladZapisu(e) {
  const c = e?.code;
  if (c === "token") { wyloguj("Token wygasł albo został cofnięty. Wklej nowy."); return; }
  if (c === "limit") { sync("err", "Limit GitHuba"); toast("GitHub chwilowo ogranicza zapytania. Spróbuj za kilka minut."); return; }
  if (c === "dostep") { sync("err", "Brak uprawnień"); toast("Token nie ma prawa zapisu do repozytorium z danymi (Contents: Read and write)."); return; }
  if (c === "siec") { sync("err", "Brak internetu"); toast("Brak połączenia z internetem. Nic nie zostało zapisane."); return; }
  sync("err", "Nie zapisano"); toast("Nie udało się zapisać. Spróbuj ponownie.");
}

/* ---------- podsumowanie ---------- */
function sumy(lista = S.wyd) {
  const p = {}, k = {}; let wyd = 0, plan = 0;
  for (const w of lista) {
    const g = w.kwotaGr || 0, pl = w.status === "do-zaplaty";
    if (pl) plan += g; else wyd += g;
    const pk = pom().some((x) => x.id === w.pom) ? w.pom : "";
    const kk = kat().some((x) => x.id === w.kat) ? w.kat : "";
    for (const [m, key] of [[p, pk], [k, kk]]) {
      m[key] ??= { wyd: 0, plan: 0, n: 0 };
      m[key][pl ? "plan" : "wyd"] += g; m[key].n++;
    }
  }
  return { p, k, wyd, plan };
}
function tasma(wyd, plan, budzet, skala) {
  const max = Math.max(budzet || 0, wyd + plan, skala || 0, 1);
  const pw = (wyd / max) * 100, ph = (plan / max) * 100;
  let h = `<div class="tape" role="img" aria-label="Wydane ${zl(wyd)}, do zapłaty ${zl(plan)}${budzet ? ", budżet " + zl(budzet) : ""}">`;
  if (wyd) h += `<span class="p" style="width:${pw}%"></span>`;
  if (plan) h += `<span class="h" style="left:calc(${pw}% + ${wyd ? 2 : 0}px);width:max(0px,calc(${ph}% - ${wyd ? 2 : 0}px))"></span>`;
  if (budzet && wyd + plan > budzet) h += `<span class="lim" style="left:calc(${(budzet / max) * 100}% - 1px)"></span>`;
  return h + "</div>";
}
function niceStep(max) {
  const raw = max / 3, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
const krotko = (v) => v >= 1000 ? (Math.round(v / 100) / 10).toLocaleString("pl-PL") + " tys." : f0.format(v) + " zł";
function wykresMiesieczny() {
  const zapl = S.wyd.filter((w) => w.status !== "do-zaplaty" && w.data);
  if (!zapl.length) return `<p class="hint">Wykres pojawi się po dodaniu zapłaconych wydatków z datą.</p>`;
  const m = {};
  for (const w of zapl) { const k = w.data.slice(0, 7); m[k] = (m[k] || 0) + (w.kwotaGr || 0); }
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
    const lab = i === imax || i === pokaz.length - 1 ? `<em style="bottom:${(vals[i] / top) * 100}%">${krotko(vals[i])}</em>` : "";
    return `<div class="c" data-tip="${esc(tip)}">${lab}<b style="height:${(vals[i] / top) * 100}%"></b></div>`;
  }).join("");
  const xl = pokaz.map((k, i) => { const [yy, mm] = k.split("-"); return `<span>${MIES_K[+mm - 1]}${mm === "01" || i === 0 ? " " + yy.slice(2) : ""}</span>`; }).join("");
  return `<div class="chart-wrap"><div class="chart-inner"><div class="chart"><div class="plot">${gl}<div class="cols">${cols}</div></div><div class="xl">${xl}</div></div></div></div>`;
}

function renderPodsumowanie() {
  const el = $("#v-podsumowanie");
  if (!S.wydLoaded) { el.innerHTML = `<div class="banner">Wczytywanie danych z GitHuba…</div>`; return; }
  const s = sumy();
  const budzet = pom().reduce((a, p) => a + (p.budzetGr || 0), 0);
  const zostaje = budzet - s.wyd - s.plan;
  const proc = budzet ? Math.round(((s.wyd + s.plan) / budzet) * 100) : null;
  let h = `<div class="kpis">
    <div class="kpi"><span class="lbl">Budżet</span><span class="v num">${budzet ? zl(budzet) : "—"}</span><span class="d">${budzet ? "suma budżetów pomieszczeń" : `<button class="btn link" data-go="ustawienia" type="button">Ustaw budżet</button>`}</span></div>
    <div class="kpi"><span class="lbl">Wydane</span><span class="v num">${zl(s.wyd)}</span><span class="d">${S.wyd.filter((w) => w.status !== "do-zaplaty").length} pozycji zapłaconych</span></div>
    <div class="kpi"><span class="lbl">Do zapłaty</span><span class="v num">${zl(s.plan)}</span><span class="d">wyceny, zaliczki, umówione</span></div>
    <div class="kpi"><span class="lbl">Zostaje</span><span class="v num ${zostaje < 0 ? "neg" : ""}">${budzet ? zl(zostaje) : "—"}</span><span class="d">${budzet ? (zostaje < 0 ? `ponad budżet o ${zl(-zostaje)}` : `wykorzystane ${proc}% budżetu`) : "po ustawieniu budżetu"}</span></div>
  </div>`;
  if (!S.wyd.length) {
    h += `<div class="panel empty"><h3>Jeszcze nic tu nie ma</h3><p>Dodaj pierwszy wydatek przyciskiem na dole albo przenieś dane z Google Sheets w zakładce „Budżet i listy”.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn pri" type="button" data-add>+ Dodaj wydatek</button><button class="btn" type="button" data-go="ustawienia">Import z arkusza</button></div></div>`;
    el.innerHTML = h; return;
  }
  h += `<div class="panel overall"><div class="lbl">Cały dom${budzet ? ` · budżet ${zl(budzet)}` : ""}</div>${tasma(s.wyd, s.plan, budzet)}
    <div class="overall-legend"><span class="key"><i></i>zapłacone</span><span class="key"><i class="h"></i>do zapłaty</span><span class="key"><i class="l"></i>granica budżetu (gdy przekroczona)</span><span>Każda kreska miarki to 10% skali.</span></div></div>`;

  const maxPom = Math.max(...Object.values(s.p).map((x) => x.wyd + x.plan), 1);
  const wiersze = pom().map((p) => ({ id: p.id, nm: p.nazwa, b: p.budzetGr || 0, ...(s.p[p.id] || { wyd: 0, plan: 0, n: 0 }) }));
  if (s.p[""]) wiersze.push({ id: "", nm: "Bez pomieszczenia", b: 0, ...s.p[""] });
  wiersze.sort((a, b) => (b.wyd + b.plan) - (a.wyd + a.plan) || b.b - a.b);
  const rp = wiersze.filter((w) => w.n || w.b).map((w) => {
    const suma = w.wyd + w.plan, over = w.b && suma > w.b;
    const status = !w.b ? `<span class="pill mut">bez budżetu</span>` : over ? `<span class="pill bad">ponad o ${zl(suma - w.b)}</span>` : suma / w.b > 0.85 ? `<span class="pill warn">zostało ${zl(w.b - suma)}</span>` : `<span class="pill ok">zostało ${zl(w.b - suma)}</span>`;
    return `<button class="row" type="button" data-fpom="${esc(w.id)}"><span class="n">${esc(w.nm)}</span><span class="a num">${zl(suma)}${w.b ? ` <span style="color:var(--muted)">/ ${zl(w.b)}</span>` : ""}</span>
      ${tasma(w.wyd, w.plan, w.b, w.b ? 0 : maxPom)}<span class="m"><span>${w.n} poz.${w.plan ? ` · do zapłaty ${zl(w.plan)}` : ""}</span>${status}</span></button>`;
  }).join("");

  const kw = Object.entries(s.k).map(([id, v]) => ({ id, nm: id ? nazwaKat(id) : "Bez kategorii", ...v })).sort((a, b) => (b.wyd + b.plan) - (a.wyd + a.plan));
  const maxK = Math.max(...kw.map((k) => k.wyd + k.plan), 1), tot = s.wyd + s.plan || 1;
  const rk = kw.map((k) => `<button class="row" type="button" data-fkat="${esc(k.id)}"><span class="n">${esc(k.nm)}</span><span class="a num">${zl(k.wyd + k.plan)} <span style="color:var(--muted)">${Math.round(((k.wyd + k.plan) / tot) * 100)}%</span></span>${tasma(k.wyd, k.plan, 0, maxK)}</button>`).join("");

  h += `<div class="grid2"><div class="panel"><h2>Pomieszczenia</h2><div class="rows">${rp}</div></div>
    <div class="panel"><h2>Kategorie</h2><div class="rows">${rk}</div></div></div>
    <div class="panel"><h2>Zapłacone w miesiącach</h2>${wykresMiesieczny()}</div>`;
  const najw = [...S.wyd].sort((a, b) => (b.kwotaGr || 0) - (a.kwotaGr || 0)).slice(0, 5);
  h += `<div class="panel"><h2>Największe pozycje</h2>${najw.map(wierszWyd).join("")}</div>`;
  el.innerHTML = h;
}

/* ---------- lista wydatków ---------- */
function wierszWyd(w) {
  const pl = w.status === "do-zaplaty";
  const meta = [nazwaPom(w.pom), nazwaKat(w.kat), w.gdzie].filter(Boolean).map(esc).join(" · ");
  return `<button class="wyd" type="button" data-id="${esc(w.id)}"><span class="dt num">${dataPL(w.data)}</span>
    <span class="o"><span class="t">${esc(w.opis || "(bez opisu)")}</span><span class="mm"><span>${meta}</span>${pl ? `<span class="pill warn">do zapłaty</span>` : ""}${w.pliki?.length ? `<span title="Załączniki">📎 ${w.pliki.length}</span>` : ""}</span></span>
    <span class="k num ${pl ? "plan" : ""}">${zl2(w.kwotaGr)}</span></button>`;
}
function filtrowane() {
  const q = S.f.q.trim().toLowerCase();
  return S.wyd.filter((w) =>
    (!S.f.pom || (S.f.pom === "-" ? !pom().some((p) => p.id === w.pom) : w.pom === S.f.pom)) &&
    (!S.f.kat || (S.f.kat === "-" ? !kat().some((k) => k.id === w.kat) : w.kat === S.f.kat)) &&
    (!S.f.st || (S.f.st === "do-zaplaty" ? w.status === "do-zaplaty" : w.status !== "do-zaplaty")) &&
    (!q || [w.opis, w.gdzie, w.notatka, nazwaPom(w.pom), nazwaKat(w.kat)].join(" ").toLowerCase().includes(q))
  ).sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.utworzono || "").localeCompare(a.utworzono || ""));
}
function opcje(lista, wybrane, pusta, bez) {
  return (pusta ? `<option value="">${pusta}</option>` : "") + lista.map((x) => `<option value="${esc(x.id)}" ${x.id === wybrane ? "selected" : ""}>${esc(x.nazwa)}</option>`).join("") + (bez ? `<option value="-" ${wybrane === "-" ? "selected" : ""}>${bez}</option>` : "");
}
function renderWydatki() {
  $("#f-pom-f").innerHTML = opcje(pom(), S.f.pom, "Wszystkie pomieszczenia", "Bez pomieszczenia");
  $("#f-kat-f").innerHTML = opcje(kat(), S.f.kat, "Wszystkie kategorie", "Bez kategorii");
  $("#f-st-f").value = S.f.st;
  if ($("#q") !== document.activeElement) $("#q").value = S.f.q;
  $("#f-clear").hidden = !(S.f.q || S.f.pom || S.f.kat || S.f.st);
  const list = $("#list");
  if (!S.wydLoaded) { list.innerHTML = `<div class="banner">Wczytywanie…</div>`; return; }
  const l = filtrowane(), s = sumy(l);
  $("#fsum").innerHTML = `<span>${l.length} z ${S.wyd.length} pozycji</span><span>zapłacone <strong class="num">${zl2(s.wyd)}</strong>${s.plan ? ` · do zapłaty <strong class="num">${zl2(s.plan)}</strong>` : ""}</span>`;
  if (!l.length) {
    list.innerHTML = S.wyd.length ? `<div class="panel empty"><h3>Nic nie pasuje do filtrów</h3><p>Zmień filtry albo wyczyść wyszukiwanie.</p></div>`
      : `<div class="panel empty"><h3>Brak wydatków</h3><p>Dodaj pierwszy wydatek albo zaimportuj dane z Google Sheets w zakładce „Budżet i listy”.</p></div>`;
    return;
  }
  const grupy = new Map();
  for (const w of l) { const k = w.data ? w.data.slice(0, 7) : "brak"; if (!grupy.has(k)) grupy.set(k, []); grupy.get(k).push(w); }
  let h = "";
  for (const [k, ws] of grupy) {
    const gs = sumy(ws);
    const t = k === "brak" ? "Bez daty" : `${MIES[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
    h += `<div class="month"><div class="month-h"><span class="t">${t}</span><span class="s num">${zl2(gs.wyd)}${gs.plan ? ` + ${zl2(gs.plan)} do zapłaty` : ""}</span></div>${ws.map(wierszWyd).join("")}</div>`;
  }
  list.innerHTML = h;
}

/* ---------- ustawienia ---------- */
function renderUstawienia(force) {
  const el = $("#v-ustawienia");
  if (!force && el.contains(document.activeElement) && document.activeElement.matches("input[type=text],input:not([type]),textarea")) return;
  if (!S.ustLoaded) { el.innerHTML = `<div class="banner">Wczytywanie…</div>`; return; }
  const s = sumy();
  const ask = (typ, id, n) => {
    if (S.usuwanie?.typ !== typ || S.usuwanie.id !== id) return "";
    const lista = typ === "pom" ? pom() : kat();
    if (!n) return `<div class="ask">Usunąć tę pozycję? <button class="btn danger" type="button" data-del-ok>Usuń</button><button class="btn" type="button" data-del-no>Nie</button></div>`;
    return `<div class="ask">${n} wydatków ma tę pozycję. Przenieś je do: <select class="ctl" id="u-move">${opcje(lista.filter((x) => x.id !== id), "")}</select><button class="btn danger" type="button" data-del-ok>Przenieś i usuń</button><button class="btn" type="button" data-del-no>Anuluj</button></div>`;
  };
  const budzet = pom().reduce((a, p) => a + (p.budzetGr || 0), 0);
  const repoUrl = `https://github.com/${REPO_DANE.owner}/${REPO_DANE.repo}`;
  el.innerHTML = `
  <div class="grid2">
    <div class="panel stack">
      <div><h2>Pomieszczenia i budżety</h2><p class="hint" style="margin:0">Budżet całego domu to suma budżetów pomieszczeń: <strong class="num">${zl(budzet)}</strong>. Wydatki na cały dom (np. elektryka, transport) zapisuj w „Cały dom”.</p></div>
      <div class="slist">${pom().map((p) => `<div class="srow">
        <input class="ctl" type="text" value="${esc(p.nazwa)}" data-u="pom-n" data-id="${esc(p.id)}" aria-label="Nazwa pomieszczenia">
        <input class="ctl num" type="text" inputmode="decimal" value="${p.budzetGr ? f0.format(p.budzetGr / 100) : ""}" placeholder="budżet zł" data-u="pom-b" data-id="${esc(p.id)}" aria-label="Budżet ${esc(p.nazwa)}">
        <button class="btn link" type="button" data-u-del="pom" data-id="${esc(p.id)}" aria-label="Usuń ${esc(p.nazwa)}">usuń</button>
        ${ask("pom", p.id, s.p[p.id]?.n || 0)}</div>`).join("")}</div>
      <form class="srow k" id="u-add-pom"><input class="ctl" type="text" id="u-new-pom" placeholder="Nowe pomieszczenie, np. Garderoba" aria-label="Nowe pomieszczenie"><button class="btn" type="submit">Dodaj</button></form>
    </div>
    <div class="panel stack">
      <div><h2>Kategorie</h2><p class="hint" style="margin:0">Stała lista zamiast wpisywania z ręki, żeby te same rzeczy zawsze lądowały w jednym miejscu.</p></div>
      <div class="slist">${kat().map((k) => `<div class="srow k">
        <input class="ctl" type="text" value="${esc(k.nazwa)}" data-u="kat-n" data-id="${esc(k.id)}" aria-label="Nazwa kategorii">
        <button class="btn link" type="button" data-u-del="kat" data-id="${esc(k.id)}" aria-label="Usuń ${esc(k.nazwa)}">usuń</button>
        ${ask("kat", k.id, s.k[k.id]?.n || 0)}</div>`).join("")}</div>
      <form class="srow k" id="u-add-kat"><input class="ctl" type="text" id="u-new-kat" placeholder="Nowa kategoria" aria-label="Nowa kategoria"><button class="btn" type="submit">Dodaj</button></form>
    </div>
  </div>
  ${renderImport()}
  <div class="panel stack">
    <div><h2>Kopia i historia</h2><p class="hint" style="margin:0">Każdy zapis to osobna wersja w prywatnym repozytorium <a href="${repoUrl}/commits/${REPO_DANE.branch}" target="_blank" rel="noopener">${REPO_DANE.repo}</a>, więc każdą zmianę da się podejrzeć i cofnąć. CSV otworzysz w Excelu i Google Sheets.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="u-export" ${S.wyd.length ? "" : "disabled"}>Pobierz CSV (${S.wyd.length} poz.)</button><button class="btn" type="button" id="u-logout">Wyloguj to urządzenie</button></div>
  </div>`;
}

/* ---------- import z arkusza ---------- */
const POLA = [["", "— pomiń —"], ["data", "Data"], ["opis", "Opis"], ["kwota", "Kwota"], ["pom", "Pomieszczenie"], ["kat", "Kategoria"], ["gdzie", "Sklep / wykonawca"], ["status", "Status"], ["notatka", "Notatka"]];
const ROZPOZNAJ = [["data", /^(data|dzie[nń]|kiedy|date)/i], ["kwota", /(kwota|cena|koszt|warto|suma|brutto|zap[lł]acono|z[lł]$|pln)/i], ["pom", /(pomieszcz|pok[oó]j|miejsce|strefa|gdzie w domu)/i], ["kat", /(kategor|rodzaj|typ|bran[zż])/i], ["gdzie", /(sklep|firma|wykonawca|dostawca|komu|kto|ekipa|sprzedawca)/i], ["status", /(status|op[lł]acon|stan)/i], ["notatka", /(uwag|notat|komentarz|info)/i], ["opis", /(opis|nazwa|co|pozycja|produkt|tytu|czego|przedmiot)/i]];
function parseTabela(txt) {
  txt = txt.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  const first = txt.split("\n")[0];
  const sep = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"' && cell === "") q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}
function zgadnijMape(rows) {
  const ncol = Math.max(...rows.map((r) => r.length));
  const head = rows[0].map((c) => c.trim());
  const mapa = Array(ncol).fill(""), uzyte = new Set();
  let naglowek = false;
  head.forEach((h, i) => { for (const [pole, re] of ROZPOZNAJ) if (!uzyte.has(pole) && h && re.test(h)) { mapa[i] = pole; uzyte.add(pole); naglowek = true; break; } });
  if (!naglowek) {
    for (let i = 0; i < ncol; i++) {
      const v = rows.slice(0, 10).map((r) => (r[i] || "").trim()).filter(Boolean);
      if (!v.length) continue;
      if (!uzyte.has("data") && v.every((x) => parseData(x))) { mapa[i] = "data"; uzyte.add("data"); }
      else if (!uzyte.has("kwota") && v.every((x) => parseKwota(x) !== null)) { mapa[i] = "kwota"; uzyte.add("kwota"); }
      else if (!uzyte.has("opis")) { mapa[i] = "opis"; uzyte.add("opis"); }
    }
  }
  return { mapa, naglowek, ncol };
}
const znajdz = (lista, nazwa) => lista.find((x) => x.nazwa.trim().toLowerCase() === nazwa.trim().toLowerCase());
function przygotujImport() {
  const { rows, mapa, naglowek } = S.imp;
  const dane = naglowek ? rows.slice(1) : rows;
  const nowePom = new Set(), noweKat = new Set();
  const out = []; let pominiete = 0, suma = 0;
  for (const r of dane) {
    const v = (pole) => { const i = mapa.indexOf(pole); return i < 0 ? "" : (r[i] || "").trim(); };
    const kw = parseKwota(v("kwota"));
    if (kw === null || kw === 0) { pominiete++; continue; }
    const pn = v("pom"), kn = v("kat"), st = v("status");
    if (pn && !znajdz(pom(), pn)) nowePom.add(pn);
    if (kn && !znajdz(kat(), kn)) noweKat.add(kn);
    suma += kw;
    out.push({ data: parseData(v("data")), opis: v("opis"), kwotaGr: kw, pomN: pn, katN: kn, gdzie: v("gdzie"), notatka: v("notatka"),
      status: /(nie|do zap|plan|wycen|zaliczk|umówion|umowion)/i.test(st) ? "do-zaplaty" : "zaplacone" });
  }
  return { out, pominiete, suma, nowePom: [...nowePom], noweKat: [...noweKat] };
}
function renderImport() {
  let h = `<div class="panel stack imp"><div><h2>Przenieś dane z Google Sheets</h2>
    <p class="hint" style="margin:0">W arkuszu zaznacz wiersze razem z nagłówkiem (np. kliknij lewy górny róg tabeli), skopiuj Ctrl+C i wklej poniżej. Działa też tekst z pliku CSV.</p></div>`;
  if (!S.imp) {
    h += `<textarea class="ctl" id="imp-txt" placeholder="Data	Opis	Kwota	Pomieszczenie	Kategoria	Sklep" aria-label="Dane z arkusza"></textarea><div><button class="btn pri" type="button" id="imp-czytaj">Wczytaj</button></div>`;
    return h + "</div>";
  }
  const { rows, mapa, naglowek, ncol } = S.imp;
  const p = przygotujImport();
  const pokaz = (naglowek ? rows.slice(1) : rows).slice(0, 6);
  h += `<div class="tbl-wrap"><table class="tbl"><thead><tr>${Array.from({ length: ncol }, (_, i) => `<th><select class="ctl" data-imp-col="${i}" aria-label="Kolumna ${i + 1}">${POLA.map(([v, n]) => `<option value="${v}" ${mapa[i] === v ? "selected" : ""}>${n}</option>`).join("")}</select>${naglowek ? `<div class="hint">${esc(rows[0][i] || "")}</div>` : ""}</th>`).join("")}</tr></thead>
    <tbody>${pokaz.map((r) => `<tr>${Array.from({ length: ncol }, (_, i) => `<td>${esc(r[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="imp-nagl" ${naglowek ? "checked" : ""}> Pierwszy wiersz to nagłówki</label>
    <div class="banner"><strong>${p.out.length}</strong> wydatków na łącznie <strong class="num">${zl2(p.suma)}</strong>${p.pominiete ? ` · pominięte ${p.pominiete} wierszy bez kwoty (np. sumy lub puste)` : ""}
    ${p.nowePom.length ? `<br>Nowe pomieszczenia: ${p.nowePom.map(esc).join(", ")}` : ""}${p.noweKat.length ? `<br>Nowe kategorie: ${p.noweKat.map(esc).join(", ")}` : ""}
    ${!mapa.includes("kwota") ? `<br><span class="err">Wskaż, która kolumna to kwota.</span>` : ""}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn pri" type="button" id="imp-go" ${!p.out.length || S.importuje ? "disabled" : ""}>Importuj ${p.out.length} wydatków</button><button class="btn" type="button" id="imp-anuluj" ${S.importuje ? "disabled" : ""}>Anuluj</button></div>`;
  return h + "</div>";
}
async function wykonajImport() {
  const p = przygotujImport();
  if (!p.out.length) return;
  S.importuje = true; renderUstawienia(true);
  const teraz = new Date().toISOString();
  try {
    await zmien(`Import z arkusza: ${p.out.length} wydatków`, (d) => {
      const u = d.ustawienia;
      for (const n of p.nowePom) if (!znajdz(u.pomieszczenia, n)) u.pomieszczenia.push({ id: noweId(u.pomieszczenia, n), nazwa: n, budzetGr: 0 });
      for (const n of p.noweKat) if (!znajdz(u.kategorie, n)) u.kategorie.push({ id: noweId(u.kategorie, n), nazwa: n });
      const domPom = u.pomieszczenia.find((x) => x.id === "caly-dom")?.id || "";
      for (const w of p.out) d.wydatki.push({ id: losoweId(), data: w.data, opis: w.opis, kwotaGr: w.kwotaGr,
        pom: w.pomN ? znajdz(u.pomieszczenia, w.pomN).id : domPom, kat: w.katN ? znajdz(u.kategorie, w.katN).id : "",
        gdzie: w.gdzie, status: w.status, notatka: w.notatka, pliki: [], utworzono: teraz, zrodlo: "import" });
    });
    S.imp = null; toast(`Zaimportowano ${p.out.length} wydatków.`);
  } catch (e) { bladZapisu(e); }
  S.importuje = false; renderUstawienia(true);
}

function csv() {
  const q = (v) => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const l = [...S.wyd].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const rows = [["Data", "Opis", "Kwota", "Pomieszczenie", "Kategoria", "Sklep / wykonawca", "Status", "Notatka"]];
  for (const w of l) rows.push([w.data, w.opis, f2.format((w.kwotaGr || 0) / 100).replace(/\s/g, ""), nazwaPom(w.pom), nazwaKat(w.kat), w.gdzie, w.status === "do-zaplaty" ? "do zapłaty" : "zapłacone", w.notatka]);
  return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
}
function eksport() {
  const url = URL.createObjectURL(new Blob([csv()], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `koszty-wykonczenia-${dzis()}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- formularz ---------- */
function otworz(w) {
  const ost = S.ostatni || {};
  S.edit = w ? { ...klon(w), pliki: [...(w.pliki || [])], nowe: [] } : { id: null, data: dzis(), opis: "", kwotaGr: null, pom: S.f.pom && S.f.pom !== "-" ? S.f.pom : ost.pom || pom()[0]?.id || "", kat: S.f.kat && S.f.kat !== "-" ? S.f.kat : ost.kat || "", gdzie: "", status: "zaplacone", notatka: "", pliki: [], nowe: [] };
  const e = S.edit;
  $("#form-h").textContent = e.id ? "Edycja wydatku" : "Nowy wydatek";
  $("#f-opis").value = e.opis || "";
  $("#f-kwota").value = e.kwotaGr != null ? f2.format(e.kwotaGr / 100) : "";
  $("#f-data").value = e.data || "";
  $("#f-pom").innerHTML = opcje(pom(), e.pom, "— wybierz —");
  $("#f-kat").innerHTML = opcje(kat(), e.kat, "— wybierz —");
  $("#f-gdzie").value = e.gdzie || "";
  $("#f-notatka").value = e.notatka || "";
  $("#dl-gdzie").innerHTML = [...new Set(S.wyd.map((w) => w.gdzie).filter(Boolean))].sort().map((g) => `<option value="${esc(g)}">`).join("");
  ustawStatus(e.status);
  $("#f-save-next").hidden = !!e.id;
  $("#f-del").hidden = !e.id; $("#f-del").textContent = "Usuń"; delete $("#f-del").dataset.sure;
  $("#f-err").hidden = true;
  renderPliki();
  $("#veil").hidden = false; document.body.style.overflow = "hidden";
  if (!e.id) setTimeout(() => $("#f-opis").focus(), 30);
}
function ustawStatus(st) {
  if (S.edit) S.edit.status = st;
  $("#f-st-z").setAttribute("aria-pressed", st !== "do-zaplaty");
  $("#f-st-d").setAttribute("aria-pressed", st === "do-zaplaty");
}
function renderPliki() {
  const e = S.edit; if (!e) return;
  $("#f-files").innerHTML = e.pliki.map((p, i) => `<div class="file">${p.typ === "application/pdf" ? `<button type="button" class="btn link" data-pdf="${esc(p.id)}">PDF</button>` : `<img alt="${esc(p.nazwa || "paragon")}" data-blob="${esc(p.id)}" data-zoom="${esc(p.id)}">`}<button type="button" class="x" data-rm="${i}" aria-label="Usuń załącznik">×</button></div>`).join("")
    + `<button type="button" class="file addfile" id="f-addfile" ${e.wgrywa ? "disabled" : ""}>${e.wgrywa ? "Wgrywanie…" : "+ zdjęcie lub PDF"}</button>`;
  $("#f-files-h").textContent = "";
  for (const img of $("#f-files").querySelectorAll("img[data-blob]")) blobUrl(img.dataset.blob).then((u) => (img.src = u), () => (img.alt = "brak pliku"));
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
  const e = S.edit; if (!e) return;
  e.wgrywa = true; renderPliki();
  for (const f of files) {
    try {
      const { bytes, type, ext } = await przygotujPlik(f);
      if (bytes.length > 20 * 1024 * 1024) throw { code: "duzy" };
      const path = `paragony/${dzis().slice(0, 7)}/${losoweId()}.${ext}`;
      await wgrajPlikGH(path, bytes, `Załącznik: ${f.name}`);
      bloby.set(path, Promise.resolve(URL.createObjectURL(new Blob([bytes], { type }))));
      if (S.edit !== e) { usunPlikGH(path); return; }
      e.pliki.push({ id: path, typ: type, nazwa: f.name }); e.nowe.push(path);
    } catch (err) {
      const c = err?.code;
      if (c === "token") { bladZapisu(err); break; }
      toast(c === "format" ? `Plik ${f.name} ma nieobsługiwany format. Użyj zdjęcia (JPG, PNG) albo PDF.` : c === "duzy" ? `Plik ${f.name} jest za duży (limit 20 MB).` : `Nie udało się wgrać ${f.name}.`);
    }
  }
  e.wgrywa = false; renderPliki();
}
function zamknij(anulowano) {
  const e = S.edit;
  if (anulowano && e?.nowe?.length) for (const p of e.nowe) usunPlikGH(p);
  S.edit = null; $("#veil").hidden = true; document.body.style.overflow = "";
}
async function zapisz(kolejny) {
  const e = S.edit; if (!e || e.wgrywa) return;
  const kw = parseKwota($("#f-kwota").value), opis = $("#f-opis").value.trim();
  const blad = !opis ? "Wpisz, za co płacisz." : kw === null || kw <= 0 ? "Wpisz kwotę większą od zera, np. 1250,50." : !$("#f-pom").value ? "Wybierz pomieszczenie." : !$("#f-kat").value ? "Wybierz kategorię." : "";
  if (blad) { const er = $("#f-err"); er.textContent = blad; er.hidden = false; return; }
  const id = e.id || losoweId();
  const doc = { id, data: $("#f-data").value || "", opis, kwotaGr: kw, pom: $("#f-pom").value, kat: $("#f-kat").value, gdzie: $("#f-gdzie").value.trim(), status: e.status, notatka: $("#f-notatka").value.trim(), pliki: e.pliki, utworzono: e.utworzono || new Date().toISOString() };
  if (e.zrodlo) doc.zrodlo = e.zrodlo;
  const usuniete = (S.wyd.find((w) => w.id === e.id)?.pliki || []).filter((p) => !e.pliki.some((q) => q.id === p.id)).map((p) => p.id);
  $("#f-save").disabled = $("#f-save-next").disabled = true;
  try {
    await zmien(`${e.id ? "Zmiana" : "Nowy wydatek"}: ${opis}, ${zl2(kw)}`, (d) => {
      const i = d.wydatki.findIndex((x) => x.id === id);
      if (i >= 0) d.wydatki[i] = doc; else d.wydatki.push(doc);
    });
    S.ostatni = { pom: doc.pom, kat: doc.kat };
    for (const p of usuniete) usunPlikGH(p);
    S.edit = null;
    toast(`Zapisano: ${opis}, ${zl2(kw)}`);
    if (kolejny) { otworz(null); $("#f-data").value = doc.data; $("#f-gdzie").value = doc.gdzie; }
    else zamknij(false);
  } catch (err) { bladZapisu(err); }
  finally { $("#f-save").disabled = $("#f-save-next").disabled = false; }
}
async function usunWydatek() {
  const b = $("#f-del"), e = S.edit;
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Na pewno usunąć?"; return; }
  try {
    await zmien(`Usunięto: ${e.opis}`, (d) => { d.wydatki = d.wydatki.filter((x) => x.id !== e.id); });
    for (const p of S.wyd.find((w) => w.id === e.id)?.pliki || e.pliki) usunPlikGH(p.id);
    zamknij(false); toast("Usunięto wydatek.");
  } catch (err) { bladZapisu(err); }
}
async function usunPozycje() {
  const { typ, id } = S.usuwanie;
  const pole = typ === "pom" ? "pom" : "kat";
  const ile = S.wyd.filter((w) => w[pole] === id).length;
  const cel = $("#u-move")?.value;
  if (ile && !cel) return;
  try {
    await zmien(`Usunięto ${typ === "pom" ? "pomieszczenie" : "kategorię"} ${id}${ile ? `, przeniesiono ${ile} wydatków` : ""}`, (d) => {
      for (const w of d.wydatki) if (w[pole] === id) w[pole] = cel;
      const lista = typ === "pom" ? d.ustawienia.pomieszczenia : d.ustawienia.kategorie;
      const i = lista.findIndex((x) => x.id === id); if (i >= 0) lista.splice(i, 1);
    });
    S.usuwanie = null; if (S.f[pole] === id) S.f[pole] = "";
    renderUstawienia(true);
  } catch (e) { bladZapisu(e); }
}

/* ---------- logowanie ---------- */
function renderLogin() {
  const el = $("#v-login");
  if (S.logowanie && S.cichy) { el.innerHTML = `<div class="banner">Łączenie z GitHubem…</div>`; return; }
  el.innerHTML = `<div class="panel stack login">
    <div><h2>Połącz z GitHubem</h2><p style="margin:0">Dane leżą w Twoim prywatnym repozytorium <strong>${REPO_DANE.repo}</strong>. Żeby aplikacja mogła je czytać i zapisywać, wklej token. Na każdym urządzeniu robisz to raz.</p></div>
    <ol class="steps">
      <li>Otwórz <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a> (zalogowany jako ${REPO_DANE.owner}).</li>
      <li><b>Token name:</b> koszty-domu + nazwa urządzenia, np. „koszty-domu telefon”.</li>
      <li><b>Expiration:</b> wybierz najdłuższy termin (Custom, rok do przodu).</li>
      <li><b>Repository access:</b> Only select repositories → <b>${REPO_DANE.repo}</b>.</li>
      <li><b>Permissions → Repository permissions → Contents:</b> Read and write.</li>
      <li>Kliknij <b>Generate token</b>, skopiuj go i wklej poniżej.</li>
    </ol>
    <form id="login-form" class="stack">
      <div class="fg"><label for="login-token">Token (zaczyna się od github_pat_)</label><input class="ctl num" id="login-token" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div>
      ${S.bladLogowania ? `<div class="err">${esc(S.bladLogowania)}</div>` : ""}
      <div><button class="btn pri" type="submit" ${S.logowanie ? "disabled" : ""}>${S.logowanie ? "Sprawdzanie…" : "Połącz"}</button></div>
    </form>
    <p class="hint" style="margin:0">Token daje dostęp tylko do repozytorium z danymi. Jeśli zgubisz telefon, usuń jego token na GitHubie w Settings → Developer settings → Personal access tokens.</p>
  </div>`;
}
async function zaloguj(token) {
  S.token = token.trim(); S.logowanie = true; S.bladLogowania = ""; render();
  try {
    const p = await pobierz();
    S.sha = p.sha; S.zalogowany = true; zapiszToken(S.token); ustawDane(p.dane);
    sync("ok", "Połączono z GitHubem");
  } catch (e) {
    S.zalogowany = false;
    S.bladLogowania = e?.code === "token" ? "GitHub nie przyjął tego tokenu. Sprawdź, czy skopiowałeś go w całości." : e?.code === "dostep" ? `Token nie ma dostępu do repozytorium ${REPO_DANE.repo}. Zaznacz je w „Repository access” i daj Contents: Read and write.` : e?.code === "siec" ? "Brak połączenia z internetem." : "Nie udało się połączyć. Spróbuj ponownie.";
    if (e?.code !== "siec") zapiszToken("");
    sync("off", "Niepołączone");
  }
  S.logowanie = false; S.cichy = false; render();
}
function wyloguj(msg) {
  zapiszToken(""); S.token = ""; S.zalogowany = false; S.bladLogowania = msg || ""; S.dane = null; S.wyd = []; S.ust = null; S.ustLoaded = S.wydLoaded = false;
  if (S.edit) zamknij(false);
  sync("off", "Niepołączone"); render();
}
async function odswiez() {
  if (!S.zalogowany || zajete || S.edit || S.importuje || document.visibilityState !== "visible") return;
  try { const p = await pobierz(); if (p.sha !== S.sha && !zajete) { S.sha = p.sha; ustawDane(p.dane); } sync("ok", "Aktualne"); }
  catch (e) { if (e?.code === "token") wyloguj("Token wygasł albo został cofnięty. Wklej nowy."); else if (e?.code === "siec") sync("err", "Brak internetu"); }
}

/* ---------- render ---------- */
function render() {
  const zal = S.zalogowany;
  $("#v-login").hidden = zal; $("nav.tabs").hidden = !zal;
  if (!zal) { for (const v of ["podsumowanie", "wydatki", "ustawienia"]) $("#v-" + v).hidden = true; $("#fab").hidden = true; renderLogin(); return; }
  for (const v of ["podsumowanie", "wydatki", "ustawienia"]) {
    $("#v-" + v).hidden = S.view !== v;
    $("#t-" + v).setAttribute("aria-selected", S.view === v);
  }
  $("#fab").hidden = !S.ustLoaded;
  if (S.view === "podsumowanie") renderPodsumowanie();
  if (S.view === "wydatki") renderWydatki();
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
  $("#fab").addEventListener("click", () => otworz(null));
  $("#q").addEventListener("input", (e) => { S.f.q = e.target.value; renderWydatki(); });
  $("#f-pom-f").addEventListener("change", (e) => { S.f.pom = e.target.value; renderWydatki(); });
  $("#f-kat-f").addEventListener("change", (e) => { S.f.kat = e.target.value; renderWydatki(); });
  $("#f-st-f").addEventListener("change", (e) => { S.f.st = e.target.value; renderWydatki(); });
  $("#f-clear").addEventListener("click", () => { S.f = { q: "", pom: "", kat: "", st: "" }; renderWydatki(); });

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    const wid = t.closest("[data-id].wyd"); if (wid) { const w = S.wyd.find((x) => x.id === wid.dataset.id); if (w) otworz(w); return; }
    const fp = t.closest("[data-fpom]"); if (fp) { S.f = { q: "", pom: fp.dataset.fpom || "-", kat: "", st: "" }; idz("wydatki"); return; }
    const fk = t.closest("[data-fkat]"); if (fk) { S.f = { q: "", pom: "", kat: fk.dataset.fkat || "-", st: "" }; idz("wydatki"); return; }
    const go = t.closest("[data-go]"); if (go) { idz(go.dataset.go); return; }
    if (t.closest("[data-add]")) { otworz(null); return; }
    const z = t.closest("[data-zoom]"); if (z && z.src) { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${z.src}" alt="">`; lb.addEventListener("click", () => lb.remove()); document.body.append(lb); return; }
    const pdf = t.closest("[data-pdf]"); if (pdf) { const okno = window.open("", "_blank"); blobUrl(pdf.dataset.pdf).then((u) => { if (okno) okno.location.href = u; else location.href = u; }, () => { okno?.close(); toast("Nie udało się otworzyć pliku."); }); return; }
    const rm = t.closest("[data-rm]"); if (rm && S.edit) { S.edit.pliki.splice(+rm.dataset.rm, 1); renderPliki(); return; }
    if (t.closest("#f-addfile")) { $("#f-file").click(); return; }
    const ud = t.closest("[data-u-del]"); if (ud) { S.usuwanie = { typ: ud.dataset.uDel, id: ud.dataset.id }; renderUstawienia(true); return; }
    if (t.closest("[data-del-no]")) { S.usuwanie = null; renderUstawienia(true); return; }
    if (t.closest("[data-del-ok]")) { usunPozycje(); return; }
    if (t.id === "u-export") { eksport(); return; }
    if (t.id === "u-logout") { wyloguj(); return; }
    if (t.id === "imp-czytaj") {
      const rows = parseTabela($("#imp-txt").value);
      if (!rows.length) { toast("Wklej najpierw dane z arkusza."); return; }
      S.imp = { rows, ...zgadnijMape(rows) }; renderUstawienia(true); return;
    }
    if (t.id === "imp-anuluj") { S.imp = null; renderUstawienia(true); return; }
    if (t.id === "imp-go") { wykonajImport(); return; }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.impCol != null && S.imp) { S.imp.mapa[+t.dataset.impCol] = t.value; renderUstawienia(true); return; }
    if (t.id === "imp-nagl" && S.imp) { S.imp.naglowek = t.checked; renderUstawienia(true); return; }
    const u = t.dataset.u; if (!u || !pisanie()) return;
    const id = t.dataset.id;
    if (u === "pom-n" || u === "kat-n") {
      const lista = u === "pom-n" ? pom() : kat();
      const x = lista.find((y) => y.id === id); const v = t.value.trim();
      if (!x || !v || v === x.nazwa) { t.value = x?.nazwa || ""; return; }
      t.blur();
      zmien(`Zmiana nazwy: ${x.nazwa} → ${v}`, (d) => { const y = (u === "pom-n" ? d.ustawienia.pomieszczenia : d.ustawienia.kategorie).find((z) => z.id === id); if (y) y.nazwa = v; }).catch(bladZapisu);
    } else if (u === "pom-b") {
      const x = pom().find((y) => y.id === id); const v = t.value.trim() ? parseKwota(t.value) : 0;
      if (!x || v === null || v < 0) { toast("Budżet wpisz jako liczbę, np. 45000."); t.value = x?.budzetGr ? f0.format(x.budzetGr / 100) : ""; return; }
      t.value = v ? f0.format(v / 100) : ""; t.blur();
      zmien(`Budżet: ${x.nazwa} = ${zl(v)}`, (d) => { const y = d.ustawienia.pomieszczenia.find((z) => z.id === id); if (y) y.budzetGr = v; }).catch(bladZapisu);
    }
  });
  document.addEventListener("submit", (ev) => {
    const f = ev.target;
    if (f.id === "login-form") { ev.preventDefault(); const v = $("#login-token").value.trim(); if (v) zaloguj(v); return; }
    if (f.id === "u-add-pom" || f.id === "u-add-kat") {
      ev.preventDefault();
      const inp = f.querySelector("input"), n = inp.value.trim(); if (!n) return;
      const czyPom = f.id === "u-add-pom";
      if (znajdz(czyPom ? pom() : kat(), n)) { toast(`„${n}” już jest na liście.`); return; }
      inp.value = ""; inp.blur();
      zmien(`Dodano ${czyPom ? "pomieszczenie" : "kategorię"}: ${n}`, (d) => {
        const lista = czyPom ? d.ustawienia.pomieszczenia : d.ustawienia.kategorie;
        if (!znajdz(lista, n)) lista.push(czyPom ? { id: noweId(lista, n), nazwa: n, budzetGr: 0 } : { id: noweId(lista, n), nazwa: n });
      }).catch(bladZapisu);
    }
  });

  $("#form").addEventListener("submit", (e) => { e.preventDefault(); zapisz(false); });
  $("#f-save-next").addEventListener("click", () => zapisz(true));
  $("#f-cancel").addEventListener("click", () => zamknij(true));
  $("#f-del").addEventListener("click", usunWydatek);
  $("#f-st-z").addEventListener("click", () => ustawStatus("zaplacone"));
  $("#f-st-d").addEventListener("click", () => ustawStatus("do-zaplaty"));
  $("#f-file").addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; if (fs.length) wgraj(fs); });
  $("#veil").addEventListener("click", (e) => { if (e.target.id === "veil") zamknij(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const lb = $(".lightbox"); if (lb) lb.remove(); else if (S.edit) zamknij(true); } });

  const tip = $("#tip");
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const r = t.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + "px";
    tip.style.top = Math.max(8, r.top + (r.height - (t.querySelector("b")?.offsetHeight || 0)) - tip.offsetHeight - 8) + "px";
  });

  document.addEventListener("visibilitychange", odswiez);
  setInterval(odswiez, 60000);
}

/* ---------- start ---------- */
try { const v = localStorage.getItem("kd-view"); if (["podsumowanie", "wydatki", "ustawienia"].includes(v)) S.view = v; } catch {}
const h = location.hash.slice(1); if (["podsumowanie", "wydatki", "ustawienia"].includes(h)) S.view = h;
wire(); render();
if (S.token) { S.cichy = true; zaloguj(S.token); } else sync("off", "Niepołączone");
})();

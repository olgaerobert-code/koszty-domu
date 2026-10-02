/* Obliczenia aplikacji, bez dostępu do strony: działa w przeglądarce (window.Logika) i w testach (require). */
(function (root) {
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

  /* Plan obejmuje to, co już wydane: pozycja ma do wydania plan minus wydane (zakończona: nic).
     Pakiet (np. Kazik: robocizna + materiały) liczy budżet wspólnie: zostało = suma planów − suma wpłat
     (nie więcej niż suma tego, co zostało w pozycjach). Kwota jest rozkładana na pozycje proporcjonalnie,
     żeby sumy pomieszczeń i kategorii się zgadzały. Pojedyncza pozycja w pakiecie nie jest „ponad planem”. */
  function policz(dane) {
    const mapa = new Map();
    for (const p of dane.pozycje || []) mapa.set(p.id, { p, zapl: 0, n: 0 });
    for (const pl of dane.platnosci || []) { const x = mapa.get(pl.pozycja); if (x) { x.zapl += pl.kwotaGr || 0; x.n++; } }
    for (const x of mapa.values()) {
      x.plan = x.p.planGr || 0;
      x.zostalo = x.p.zakonczona ? 0 : Math.max(x.plan - x.zapl, 0);
      x.ponad = x.plan > 0 && x.zapl > x.plan;
      x.bezPlanu = !x.plan;
    }
    const pakiety = new Map();
    for (const pk of dane.ustawienia?.pakiety || []) {
      const xs = [...mapa.values()].filter((x) => x.p.pakiet === pk.id);
      if (!xs.length) continue;
      const plan = xs.reduce((a, x) => a + x.plan, 0), zapl = xs.reduce((a, x) => a + x.zapl, 0), ind = xs.reduce((a, x) => a + x.zostalo, 0);
      const zostalo = Math.min(Math.max(plan - zapl, 0), ind);
      let reszta = zostalo;
      const otwarte = xs.filter((x) => x.zostalo > 0).sort((a, b) => b.zostalo - a.zostalo);
      otwarte.forEach((x, i) => { const v = i === otwarte.length - 1 ? reszta : Math.round((x.zostalo * zostalo) / ind); x.zostalo = v; reszta -= v; });
      for (const x of xs) { x.ponad = false; x.bezPlanu = false; x.wPakiecie = pk; }
      pakiety.set(pk.id, { pk, xs, plan, zapl, zostalo, ponad: zapl > plan });
    }
    return { mapa, pakiety };
  }

  function suma(lista) {
    const s = { plan: 0, zapl: 0, zostalo: 0, n: 0 };
    for (const x of lista) { s.plan += x.plan; s.zapl += x.zapl; s.zostalo += x.zostalo; s.n++; }
    return s;
  }

  /* Liczba „nabijana” od starej do nowej wartości: zwalnia pod koniec (ease-out cubic), zawsze całkowita. */
  function wartoscLicznika(od, doWartosci, t) {
    const k = Math.min(Math.max(t, 0), 1), e = 1 - Math.pow(1 - k, 3);
    return Math.round(od + (doWartosci - od) * e);
  }

  /* Produkty, które od ostatniego wczytania dostały płatność (do krótkiego wyróżnienia). */
  function noweKupione(przed, po) {
    if (!przed) return new Set();
    const bylo = new Set(przed.filter((q) => q.produkt).map((q) => q.produkt));
    return new Set(po.filter((q) => q.produkt && !bylo.has(q.produkt)).map((q) => q.produkt));
  }

  /* Dane z bazy może zapisać każdy, kto zna kod domu, więc do CSS trafia tylko kolor #RRGGBB. */
  function bezpiecznyKolor(k) {
    return typeof k === "string" && /^#[0-9A-Fa-f]{6}$/.test(k) ? k : null;
  }
  /* view-transition-name z dowolnego id: litery, cyfry i „-” zostają, reszta jako _kod_ (różne id, różne nazwy). */
  function nazwaPrzejscia(prefiks, id) {
    return prefiks + "-" + String(id).replace(/[^A-Za-z0-9-]/g, (c) => "_" + c.codePointAt(0).toString(16) + "_");
  }

  /* Link do sklepu z bazy: tylko http(s), żeby javascript: ani data: nie trafiły do href. */
  function bezpiecznyLink(u) {
    return typeof u === "string" && /^https?:\/\//i.test(u) ? u : null;
  }

  const api = { parseKwota, policz, suma, wartoscLicznika, noweKupione, bezpiecznyKolor, nazwaPrzejscia, bezpiecznyLink };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Logika = api;
})(typeof window !== "undefined" ? window : this);

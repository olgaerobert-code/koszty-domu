// Testy obliczeń aplikacji. Uruchom: node --test testy/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logika.js");

const pozycja = (id, planGr, extra = {}) => ({ id, nazwa: id, pom: "kuchnia", kat: "", planGr, zakonczona: false, zakup: false, ...extra });
const platnosc = (pozycjaId, kwotaGr, extra = {}) => ({ id: pozycjaId + kwotaGr, pozycja: pozycjaId, kwotaGr, data: "", ...extra });
const dane = (pozycje, platnosci, pakiety = []) => ({ ustawienia: { pomieszczenia: [], kategorie: [], pakiety }, pozycje, platnosci });

/* ---------- kwoty ---------- */
test("parseKwota czyta polski zapis z groszami i spacjami", () => {
  assert.equal(L.parseKwota("1 234,56 zł"), 123456);
});
test("parseKwota traktuje kropki co trzy cyfry jako tysiące", () => {
  assert.equal(L.parseKwota("1.234"), 123400);
});
test("parseKwota zwraca null dla tekstu i pustego pola", () => {
  assert.equal(L.parseKwota("abc"), null);
  assert.equal(L.parseKwota(""), null);
});

/* ---------- pozycje ---------- */
test("pozycja ma do wydania plan minus wydane", () => {
  const { mapa } = L.policz(dane([pozycja("a", 100000)], [platnosc("a", 30000)]));
  assert.equal(mapa.get("a").zostalo, 70000);
  assert.equal(mapa.get("a").zapl, 30000);
});
test("zakończona pozycja nie ma nic do wydania", () => {
  const { mapa } = L.policz(dane([pozycja("a", 100000, { zakonczona: true })], [platnosc("a", 30000)]));
  assert.equal(mapa.get("a").zostalo, 0);
});
test("wydane ponad plan oznacza pozycję jako ponad planem", () => {
  const { mapa } = L.policz(dane([pozycja("a", 10000)], [platnosc("a", 15000)]));
  assert.equal(mapa.get("a").ponad, true);
  assert.equal(mapa.get("a").zostalo, 0);
});
test("pozycja bez planu z płatnością jest bez planu", () => {
  const { mapa } = L.policz(dane([pozycja("a", 0)], [platnosc("a", 5000)]));
  assert.equal(mapa.get("a").bezPlanu, true);
});

/* ---------- pakiety ---------- */
test("pakiet liczy budżet wspólnie i rozkłada resztę na otwarte pozycje", () => {
  const d = dane(
    [pozycja("plytki", 45000, { pakiet: "k" }), pozycja("sciany", 40000, { pakiet: "k" }), pozycja("bez", 0, { pakiet: "k" })],
    [platnosc("plytki", 21700), platnosc("bez", 25000)],
    [{ id: "k", nazwa: "Kazik" }]);
  const { mapa, pakiety } = L.policz(d);
  const g = pakiety.get("k");
  assert.equal(g.plan, 85000);
  assert.equal(g.zapl, 46700);
  assert.equal(g.zostalo, 38300);
  assert.equal(mapa.get("plytki").zostalo + mapa.get("sciany").zostalo, 38300);
  assert.equal(mapa.get("bez").bezPlanu, false);
});

/* ---------- sumy ---------- */
test("suma dodaje plan, wydane i zostało", () => {
  const { mapa } = L.policz(dane([pozycja("a", 1000), pozycja("b", 2000)], [platnosc("a", 500)]));
  assert.deepEqual(L.suma([...mapa.values()]), { plan: 3000, zapl: 500, zostalo: 2500, n: 2 });
});

/* ---------- efekty: liczba „nabijana” od starej do nowej ---------- */
test("licznik zaczyna od wartości startowej i kończy na docelowej", () => {
  assert.equal(L.wartoscLicznika(1000, 5000, 0), 1000);
  assert.equal(L.wartoscLicznika(1000, 5000, 1), 5000);
});
test("licznik zwalnia pod koniec, w połowie czasu jest dalej niż połowa drogi", () => {
  assert.ok(L.wartoscLicznika(0, 1000, 0.5) > 500);
});
test("licznik nie wychodzi poza zakres przy czasie spoza 0–1", () => {
  assert.equal(L.wartoscLicznika(0, 1000, 1.7), 1000);
  assert.equal(L.wartoscLicznika(0, 1000, -0.3), 0);
});
test("licznik działa też w dół i zwraca liczby całkowite", () => {
  const v = L.wartoscLicznika(5000, 1000, 0.3);
  assert.ok(v < 5000 && v > 1000);
  assert.equal(Number.isInteger(v), true);
});

/* ---------- efekty: świeżo kupiony produkt ---------- */
test("noweKupione zwraca produkty, które dostały płatność od ostatniego razu", () => {
  const przed = [platnosc("a", 100, { produkt: "p1" })];
  const po = [...przed, platnosc("a", 200, { produkt: "p2" }), platnosc("a", 300)];
  assert.deepEqual([...L.noweKupione(przed, po)], ["p2"]);
});
test("noweKupione przy pierwszym wczytaniu nic nie zwraca", () => {
  assert.deepEqual([...L.noweKupione(null, [platnosc("a", 100, { produkt: "p1" })])], []);
});

/* ---------- bezpieczeństwo: dane z bazy trafiające do HTML i CSS ---------- */
test("bezpiecznyKolor przepuszcza tylko kolor #RRGGBB", () => {
  assert.equal(L.bezpiecznyKolor("#F8DA6B"), "#F8DA6B");
  assert.equal(L.bezpiecznyKolor('#fff" onmouseover="x'), null);
  assert.equal(L.bezpiecznyKolor("red;background:url(//zly)"), null);
  assert.equal(L.bezpiecznyKolor(undefined), null);
});
test("nazwaPrzejscia daje poprawny identyfikator CSS z dowolnego id", () => {
  const n = L.nazwaPrzejscia("pom", 'x"><img src=x onerror=alert(1)>;background:red');
  assert.match(n, /^pom-[A-Za-z0-9_-]+$/);
});
test("nazwaPrzejscia rozróżnia różne id", () => {
  assert.notEqual(L.nazwaPrzejscia("poz", "a b"), L.nazwaPrzejscia("poz", "a_b"));
});

test("bezpiecznyLink przepuszcza tylko adresy http i https", () => {
  assert.equal(L.bezpiecznyLink("https://www.euro.com.pl/x"), "https://www.euro.com.pl/x");
  assert.equal(L.bezpiecznyLink("javascript:alert(1)"), null);
  assert.equal(L.bezpiecznyLink(" JavaScript:alert(1)"), null);
  assert.equal(L.bezpiecznyLink("data:text/html,x"), null);
  assert.equal(L.bezpiecznyLink(""), null);
});

/* ---------- wygląd „farba”: poziom wypełnienia i odcienie ---------- */
test("poziomFarby to procent wydanego planu, zaokrąglony i obcięty do 100", () => {
  assert.equal(L.poziomFarby(21700, 45000), 48);
  assert.equal(L.poziomFarby(15000, 10000), 100);
  assert.equal(L.poziomFarby(0, 15000), 0);
});
test("poziomFarby bez planu: pełny, gdy coś wydano, pusty, gdy nic", () => {
  assert.equal(L.poziomFarby(4940, 0), 100);
  assert.equal(L.poziomFarby(0, 0), 0);
});
test("odcienie dają jasną ścianę i ciemną kreskę farby z koloru pomieszczenia", () => {
  assert.deepEqual(L.odcienie("#F8DA6B"), { sciana: "#FCEEBC", farba: "#F8DA6B", linia: "#88783B" });
});
test("odcienie dla złego koloru wracają do neutralnej szarości", () => {
  assert.equal(L.odcienie("red").farba, "#E4E4EA");
});
test("powitanie zależy od pory dnia", () => {
  assert.equal(L.powitanie(8), "Dzień dobry");
  assert.equal(L.powitanie(17), "Dzień dobry");
  assert.equal(L.powitanie(18), "Dobry wieczór");
  assert.equal(L.powitanie(2), "Dobry wieczór");
});

test("procent wydanego planu bez górnej granicy, do podpisów", () => {
  assert.equal(L.procent(55000, 123544), 45);
  assert.equal(L.procent(13000, 10000), 130);
  assert.equal(L.procent(0, 15000), 0);
  assert.equal(L.procent(4940, 0), 0);
});

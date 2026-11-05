# Pakiet „Kazik: ściany, sufity, podłogi” – sprawdzenie podziału (5.11.2026)

Kopia danych: `koszty_2026-11-05_210025.json` (wersja 46 z bazy, stan z 5.11.2026 20:51 UTC).
Żadne dane nie były zmieniane. Baza trzyma też sama ostatnie 300 wersji w tabeli `koszty_historia`.

## Co jest w pakiecie

| Pozycja | Plan | Wydane | Zostało wg własnego planu |
|---|---:|---:|---:|
| Płytki | 45 000 | 21 700 | 23 300 |
| Panele | 6 800 | 6 800 | 0 |
| Ściany i sufity | 40 000 | 0 | 40 000 |
| Listwy | 10 000 | 0 | 10 000 |
| Kazik – wpłaty bez podziału | 0 | 35 000 | 0 |
| **Razem** | **101 800** | **63 500** | **73 300** |

Pakiet: zostało = 101 800 − 63 500 = **38 300 zł** (mniej niż 73 300, więc nie ma obcięcia).

## Jak aplikacja rozkłada 38 300 zł na pozycje

Proporcjonalnie do tego, ile każda otwarta pozycja ma jeszcze wg własnego planu (23 300 : 40 000 : 10 000):

| Pozycja | Zostało po rozłożeniu | „Zjadła” z wpłaty 35 000 |
|---|---:|---:|
| Płytki | 12 174,49 | 11 125,51 |
| Ściany i sufity | 20 900,41 | 19 099,59 |
| Listwy | 5 225,10 | 4 774,90 |
| Panele | 0 | 0 (plan wykorzystany) |
| Kazik – wpłaty bez podziału | 0 | — |
| **Razem** | **38 300,00** | **35 000,00** |

Sumy się zgadzają (pozycje = pakiet = 38 300). Testy jednostkowe: 31/31 przechodzi.

## Uwagi

1. Logika działa zgodnie z opisem w `logika.js`. Nie znalazłam błędu w obliczeniach.
2. Kosmetyka: na ekranie pozycji kwoty są zaokrąglane do pełnych zł (12 174 + 20 900 + 5 225 = 38 299), czyli o 1 zł mniej niż pakiet. Nie widać tego nigdzie obok siebie.
3. Podział jest wg „ile zostało”, nie wg planu: Płytki (już częściowo opłacone) dostają mniejszą część wpłaty bez podziału niż Ściany. To świadomy wybór, nie błąd.
4. Do sprawdzenia w arkuszu: wpłata „Kazik – wpłaty bez podziału” z arkusza to 35 000 zł, dokładnie tyle samo co „Meble kuchnia” z arkusza. Może to zbieg okoliczności.
5. Tylko wpłata 35 000 ma wykonawcę „Kazik”; płatności za Płytki (21 700) i Panele (6 800) nie mają wpisanego „komu”, więc kafelek „Komu płacisz” pokazuje Kazika z 35 000, nie 63 500.

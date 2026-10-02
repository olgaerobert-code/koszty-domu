# System wyglądu: Koszty wykończenia domu

Aplikacja na telefon. Inspiracja: pastelowe karty z dużym zaokrągleniem, czarne pigułki, pływający czarny pasek (zdjęcie z Pinteresta). Wszystkie wartości są tokenami w `:root` w `index.html`. W regułach CSS nie wpisujemy kolorów ani rozmiarów na sztywno.

## Tokeny

### Kolory
| Token | Wartość | Do czego |
|---|---|---|
| `--tlo` | `#EFEFF3` | tło aplikacji (chłodna jasna szarość) |
| `--karta` | `#FFFFFF` | białe karty z listami, pola formularzy po fokusie |
| `--czern` | `#000000` | tekst, przyciski główne, pasek nawigacji, wypełnienie postępu |
| `--tekst-2` | `#55555C` | tekst pomocniczy na białym i na tle (7,4:1 i 6,5:1) |
| `--linia` | `#E4E4EB` | linie między wierszami |
| `--zolty`, `--lawenda` | `#F8DA6B`, `#C8C4F4` | budżet i karta „Wydane” |
| `PASTELE` (app.js) | 10 kolorów | kolor pomieszczenia: kafel, karta, kółka, kropki |
| `--zle`, `--zle-tlo`, `--zle-tekst` | `#C62F23`, `#FADAD6`, `#A3241A` | przekroczenia, błędy (plakietka 5,7:1) |
| `--ok`, `--ok-tlo` | `#1E7445`, `#D7F0E0` | zakończone, kupione, zapas |
| `--uwaga` | `#FBD2AE` | „poza planem” |
| `--tusz-2` | czerń 72% | podpisy na pastelach (min. 6,3:1) |

Kolor pomieszczenia zapisany w bazie przechodzi przez `Logika.bezpiecznyKolor`: tylko `#RRGGBB`, inaczej domyślny pastel.

### Pismo
- **Bricolage Grotesque** (700–800): liczby, tytuły, kwoty. Ciasny odstęp liter (−0,02em).
- **Plus Jakarta Sans** (400–700): cała reszta.
- Skala: `--t-xs` 12,5 · `--t-s` 13,5 · `--t-m` 15 · `--t-l` 17 · `--t-xl` 21 · `--t-2xl` 26 · `--t-3xl` 30 · `--t-hero` 42 px.
- Wyjątek: pola formularzy mają 16 px, bo przy mniejszej czcionce iPhone przybliża stronę.
- Kwoty: liczba dużą czcionką, „zł” jako `<small>` (0,62em). Cyfry równej szerokości.

### Kształty i odstępy
- Promienie: `--r-duzy` 28 (karty główne, arkusz), `--r-sredni` 22 (kafle, karty list), `--r-maly` 16 (pola). Przyciski i chipy to pełna pigułka (99px).
- Kolumna max 520 px, margines 16 px, odstęp między kaflami 12 px, nad sekcją 28 px.
- Każdy element do stuknięcia ma co najmniej 44×44 px.

## Komponenty
| Komponent | Klasa | Kiedy |
|---|---|---|
| Karta główna | `.hero` (`--k` = kolor) | jedna na ekran, najważniejsza liczba. Na Dom bez paska, na pomieszczeniu i pozycji z paskiem. |
| Mini kafel | `.mini` | dwa obok siebie pod kartą główną (budżet, zostało do wydania) |
| Kafel pomieszczenia | `.kafel` | siatka 2 kolumny na Dom: ikona, nazwa, „zostało”, pasek |
| Wiersz pozycji | `.poz` + `.kolko` | listy pozycji: kółko postępu w kolorze pomieszczenia (✓ gdy opłacone, ! gdy poza planem, „zł” gdy bez planu), po prawej wydane i plan |
| Wiersz płatności | `.pl` | nazwa, kwota, data i komu |
| Pasek postępu | `.bar` | **tylko na pastelowych kartach**: czarne = wydane, kreskowane = zostało, czerwona kreska = plan przekroczony |
| Chip | `.chip` | filtry (`aria-pressed`) i wybór w formularzu (`role=radio`) |
| Przycisk główny | `.btn-czarny` | jedna akcja na ekran: „Dodaj pozycję”, „Dodaj płatność”, „Zapisz” |
| Arkusz | `#arkusz` | wszystkie formularze, wysuwa się od dołu; `aria-labelledby` = tytuł, Tab krąży w środku, „wstecz” zamyka |
| Pasek nawigacji | `#nav` | 4 ikony, `aria-current="page"`, bez „+” (decyzja Roberta) |
| Plakietka | `.tag` (`.ok`, `.zle`, `.uwaga`) | stan pozycji lub produktu |

## Ruch
Zasada: ruch odpowiada na działanie użytkownika, nigdy sam z siebie. Przy „Ogranicz ruch” w systemie wszystko jest wyłączone (`prefers-reduced-motion`).

| Token | Wartość | Użycie |
|---|---|---|
| `--ruch-klik` | 120 ms | wciśnięcie (scale .94–.985) |
| `--ruch-szybki` | 180 ms | zamykanie arkusza, zanik |
| `--ruch-sredni` | 300 ms | wjazd arkusza, przejścia ekranów, komunikat |
| `--ruch-wolny` | 900 ms | liczniki kwot, dorysowanie kółka |
| `--ease-wyjscie` | `cubic-bezier(.2,.8,.2,1)` | domyślna krzywa |
| `--ease-sprezyna` | `cubic-bezier(.34,1.56,.64,1)` | „podskok” (komunikat, plakietka kupione) |

Efekty:
1. **Przejście kafel → ekran** (View Transitions): kafel pomieszczenia zamienia się w kartę główną, wiersz pozycji w kartę pozycji. Nazwy przejść tylko z `Logika.nazwaPrzejscia`. Pominięte przejście (szybkie stuknięcia, obrót) jest ciche.
2. **Liczniki kwot** (`kwL` + `Logika.wartoscLicznika`): przy pierwszym otwarciu Dom kwoty nabijają się od zera, później tylko przy zmianie, od starej do nowej wartości.
3. **Kółko na Dom** dorysowuje się od poprzedniego procentu.
4. **Wciśnięcia** na kaflach, wierszach, przyciskach i chipach.
5. **Arkusz** wjeżdża i zjeżdża, a zasłona płynnie się pojawia i znika.
6. **Komunikat sukcesu** wskakuje od góry z żółtym ptaszkiem.
7. **„kupione”** podskakuje, gdy produkt właśnie dostał płatność.

## Teksty
Jedno pojęcie, jedna nazwa:
- **Wydane** (nigdy „Zapłacone”)
- **Zostało** / **Zostało do wydania**
- **Plan**, **Pozycja**, **Komu**, **Paragon**
- Przycisk przy produkcie: **Kupiłem**; plakietka: **kupione**
- Potwierdzenie usunięcia: **Tak, usuń**

Komunikaty: „Dodano płatność: Dywan, 1 899,00 zł”. Błędy mówią, co zrobić: „Wpisz kwotę, np. 1250,50.”

## Bezpieczeństwo w HTML
Wszystko, co pochodzi z bazy (nazwy, id, opisy, linki), przechodzi przez `esc()` przed wstawieniem do HTML. Kolor przechodzi przez `bezpiecznyKolor`, a nazwy przejść przez `nazwaPrzejscia`. Linki produktów muszą zaczynać się od `http(s)://`. Testy: `node --test testy/logika.test.js`.

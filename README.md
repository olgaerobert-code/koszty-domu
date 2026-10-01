# Koszty wykończenia domu

Aplikacja do zapisywania wydatków na wykończenie domu: budżet per pomieszczenie, kategorie, status „zapłacone / do zapłaty”, zdjęcia paragonów, import z Google Sheets, eksport CSV.

Dane (pozycje, płatności, paragony) są w Supabase, w tym samym projekcie co aplikacja treningowa. Tabele są zamknięte, a cały ruch idzie przez funkcje wymagające kodu domu wpisanego w `app.js` — schemat i funkcje w `supabase.sql`. Aplikacja działa od razu na każdym urządzeniu, bez logowania; kod jest jawny w źródle, co jest świadomym wyborem (dane nie są poufne).

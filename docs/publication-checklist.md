# Checklista publikacji Fitaily MCP

Wymagania sprawdzone 2026-11-11. Główna ścieżka z tego planu to **Anthropic Connectors Directory** — zdalny serwer MCP zgłasza się bezpośrednio w portalu, nie przez paczkę ZIP.

## Anthropic Connectors Directory — wymagania

- [x] Zdalny endpoint HTTPS: `https://mcp.fitaily.com/mcp`; Streamable HTTP i OAuth 2.0.
- [x] Wszystkie 70 narzędzi mają `title` i adnotacje `readOnlyHint` / `destructiveHint`; nazwy mieszczą się w limicie 64 znaków.
- [x] Serwer udostępnia 10 promptów startowych przez `prompts/list`.
- [ ] Sprawdzić narzędzia w Claude jako własny konektor i przez MCP Inspector; w portalu potwierdzić samodzielne przetestowanie każdego narzędzia.
- [ ] Przygotować publiczną dokumentację, politykę prywatności, kontakt wsparcia, ikonę i kompletne konto testowe z danymi posiłków, treningów oraz pomiarów.
- [ ] W portalu opisać nazwę (≤100 znaków), one-liner (≤200), opis (≤2000), 1–5 kategorii, dokumentację, politykę prywatności, kontakt, ikonę i niezmienny po publikacji slug.
- [ ] Uzupełnić use cases, wymagania wobec konta użytkownika i zakres odczytu/zapisu; wpisać firmę, stronę i kontakt do aktualizacji recenzji.
- [ ] Uzupełnić konfigurację OAuth oraz deklaracje obsługi danych zdrowotnych i treści sponsorowanych; przejrzeć wszystkie wymagane potwierdzenia zgodności.
- [ ] Wpisać dane testowe i instrukcje recenzenta tylko do zabezpieczonych pól portalu — nigdy do repozytorium ani publicznego opisu.
- [ ] Po wysłaniu sprawdzać status i uwagi recenzenta w portalu. Automatyczna publikacja może nadać status Community; status Verified jest osobną, późniejszą oceną.

### Roboczy listing

- Nazwa: **Fitaily**
- One-liner: **Log meals, plan nutrition, and review training with your Fitaily data.**
- Opis: **Connect your Fitaily account to Claude to review nutrition, meals, hydration, recipes, training, body measurements, and progress. Choose read-only or read-and-write access during OAuth. The connector calls the Fitaily API on your behalf; Fitaily MCP does not store prompts, tool results, or health records. The connected assistant receives the data returned for your requests, and Fitaily MCP access logs contain HTTP method, path, status, and duration only. Write actions should be shown as a short summary and require your explicit confirmation before saving. Sign in with an existing Fitaily account. This is a logging and information service, not medical advice.**
- Dokumentacja: `https://fitaily.com/mcp`
- Polityka prywatności: `https://fitaily.com/privacy-policy` (wymaga aktualizacji o przepływ przez konektory AI i logi MCP przed zgłoszeniem).
- Kontakt wsparcia: `info@fitaily.com`
- Ikona: istniejące logo Fitaily 512×512; sprawdzić dostępność URL przed zgłoszeniem.
- Dane zdrowotne osobowe: **tak** — konektor może zwracać wagę, pomiary i dane żywieniowe/treningowe.
- Zakupy/płatności przez MCP: **do potwierdzenia przez właściciela**; w aktualnych 70 narzędziach nie ma płatności ani zakupów.

Claude wymaga zrzutów karuzeli 3–5 PNG o szerokości co najmniej 1000 px tylko wtedy, gdy serwer publikuje interaktywną aplikację MCP z UI. Fitaily MCP jest obecnie serwerem narzędziowym, więc te zrzuty nie są wymogiem jego wpisu; mogą być materiałem promocyjnym. Lista promptów serwera synchronizuje się automatycznie w portalu. Formalny krok testowy wymaga uruchomienia każdego narzędzia, nie tylko promptów przykładowych.

## Ręczna macierz QA

Plan dodatkowy: 10 promptów × Claude Web × Claude Mobile × ChatGPT × konto demo × konto puste = 60 przebiegów. Mobile korzysta z konektora dodanego wcześniej do konta Claude; niestandardowe konektory dodaje się przez web. ChatGPT custom MCP jest obecnie dostępny w workspace Business i Enterprise/Edu, a konfiguracja odbywa się w web.

| Prompt | Klient | Konto | Wywołania narzędzi | Poprawność danych | Potwierdzenie zapisu | Komunikat / poprawka | Status |
|---|---|---|---:|---|---|---|---|

Kryteria zaliczenia: odczyt najwyżej w 3 wywołaniach; każdy zapis dopiero po wyraźnym potwierdzeniu; makra tylko z katalogu Fitaily lub od użytkownika; puste konto dostaje czytelny komunikat, także dla `get_forecast`. Poprawki trafiają do opisów narzędzi lub skills i przechodzą ponownie test wszystkich narzędzi.

## Opcjonalnie: OpenAI Plugins Directory

To osobny kanał publikacji przez plugin ZIP, weryfikację wydawcy i portal OpenAI. Wymaga czterech publicznych URL-i (produkt, support, privacy, terms), ikon PNG w paczce, dokładnych listing fields, skanu MCP, pięciu pozytywnych i trzech negatywnych przypadków, recenzenckiego dostępu do demo oraz dostępnego nagrania wideo. Dane logowania przekazuje się tylko w zabezpieczonym polu portalu. Przygotowanie tej paczki nie oznacza wysłania jej do recenzji.

## Opcjonalnie: MCP Registry

- Zdalny serwer może użyć `server.json` z `remotes: [{ "type": "streamable-http", "url": "https://mcp.fitaily.com/mcp" }]`; `packages` nie jest wymagane.
- Proponowana nazwa dla GitHub namespace: `io.github.rafafau/fitaily-mcp`.
- Sam plik w repo nie publikuje wpisu. Przed ewentualną publikacją uruchomić walidację `mcp-publisher` i potwierdzić, że konto GitHub ma uprawnienia do namespace.

## Źródła

- [Claude: submit a connector to the directory](https://claude.com/docs/connectors/building/submission)
- [Claude: connector pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria)
- [Claude: build an MCP server](https://claude.com/docs/connectors/building)
- [Claude Help: custom connectors and supported plans](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [OpenAI: remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [OpenAI: connect a custom MCP server in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [MCP Registry: remote servers](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx)
- [MCP Registry: authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx)

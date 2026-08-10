# Testet

Dy nivele: teste njësi për logjikën e pastër, dhe teste end-to-end që e drejtojnë
aplikacionin e ndërtuar ashtu si e drejton shfletuesi.

| Suita | Kontrolle | Çfarë mbulon |
|---|---|---|
| `unit/availability.test.js` | 53 | slot-et, zona orare, telefoni shqiptar, slug-et |
| `unit/calendar.test.js` | 49 | rrjeta e muajit, javët, kolonat e mbivendosjeve |
| `unit/rules.test.js` | 26 | buffer, pushimi, mbylljet, njoftimi, dritarja |
| `unit/email.test.js` | 18 | email-i i pezullimit: me/pa arsye, ikja e HTML-së |
| `unit/email-provider.test.js` | 12 | zgjedhja e provider-it dhe parsimi i EMAIL_FROM |
| `unit/design.test.js` | 17 | pjesët e përbashkëta të pamjes nuk shpërndahen sërish |
| `e2e/main.js` | 69 | rrjedha e plotë: regjistrim → dyqan → rezervim → kalendar |
| `e2e/features.js` | 62 | rregullat, mbylljet, walk-in-et, paneli, klientët |
| `e2e/admin.js` | 68 | të drejtat e adminit, pezullimi/riaktivizimi + njoftimet, fshirja |
| `e2e/shell.js` | 32 | njoftimet, tema, shtylla anësore, linku i adminit |
| `e2e/realtime.js` | 11 | njoftimet live mbërrijnë vërtet, dhe vetëm te pronari i duhur |
| `e2e/security.js` | 50 | sulme: IDOR, eskalim privilegjesh, rrjedhje të dhënash, koka HTTP |
| `e2e/suspension.js` | 32 | biznesi i pezulluar: lexon gjithçka, nuk shkruan asgjë |

---

## Teste njësi

```bash
npm run test:unit
```

Kompilon `src/lib/*` në CommonJS te `tests/.build` dhe i drejton të tri suitat.
Nuk i duhet as rrjet, as bazë të dhënash.

---

## Teste end-to-end

```bash
./tests/run-e2e.sh
```

Ndërton te `.next-test` (jo `.next`), nxjerr ID-të e Server Action-eve nga
output-i, nis serverin te `:3100` dhe drejton të katër suitat.

**Pse një dosje tjetër build-i:** `next dev` dhe `next build` shkruajnë të dyja te
`.next` dhe e prishin njëra-tjetrën. Me `NEXT_DIST_DIR` testet mund të drejtohen
ndërsa `npm run dev` vazhdon të punojë.

**Pse ka një suitë të veçantë për realtime:** abonimi ndodh në shfletues, ndaj
testet HTTP nuk e prekin dot. `realtime.js` përdor të njëjtin `supabase-js` me të
njëjtin token si faqja — nëse ngjarja mbërrin atje, mbërrin edhe te zilja. Mbulon
gabimin ku, pa `realtime.setAuth()`, socket-i lidhet si `anon` dhe RLS-ja i heq
të gjitha ngjarjet pa dhënë asnjë gabim.

**Pse nxirren ID-të e veprimeve:** çdo buton i panelit thërret një Server Action,
dhe Next-i i thërret ato me një POST që mban header-in `Next-Action: <id>`. ID-të
gjenerohen gjatë build-it. Testet i lexojnë nga output-i që të mund të shtypin
"butonat" e vërtetë e jo thjesht të lexojnë HTML.

### Fazat e dyta

`admin` dhe `shell` kanë nga një fazë të dytë që kërkon një përdorues admin —
gjë që kërkon SQL, ndaj s'automatizohet dot brenda skriptit:

```bash
# 1. Faza e parë shtyp një ID në fund
BASE=http://localhost:3100 PHASE=1 node tests/e2e/admin.js

# 2. Ngrije atë përdorues në admin
#    insert into public.platform_admins (user_id, note)
#    values ('<ID>', 'test') on conflict do nothing;

# 3. Faza e dytë
BASE=http://localhost:3100 PHASE=2 node tests/e2e/admin.js
```

I njëjti model vlen për `shell.js` dhe `suspension.js`.

`suspension.js` provon të dyja rrugët: server action-et e aplikacionit DHE
PostgREST-in direkt me JWT-në e pronarit. E dyta është ajo që ka rëndësi — çelësi
`anon` është publik, ndaj një ndalim vetëm te Next-i anashkalohet duke mos kaluar
fare nga Next-i.

---

## Skema SQL

`sql/prelude.sql` + `sql/verify.sql` e provojnë skemën kundër një Postgres-i të
zhveshur (pa Supabase), duke imituar `auth.users` dhe `auth.uid()`:

```bash
docker run -d --name rz-test -e POSTGRES_PASSWORD=pw postgres:16-alpine
cat tests/sql/prelude.sql   | docker exec -i rz-test psql -U postgres -q -v ON_ERROR_STOP=1
cat supabase/schema.sql     | docker exec -i rz-test psql -U postgres -q -v ON_ERROR_STOP=1
cat tests/sql/verify.sql    | docker exec -i rz-test psql -U postgres
docker rm -f rz-test
```

Provon mbivendosjet, orarin e punës, RLS-në dhe normalizimin e telefonit —
pikërisht ato gjëra që nuk duhen besuar pa i parë.

`tests/sql/verify-suspension.sql` provon rregullin "vetëm lexim" dhe
`tests/sql/verify-history.sql` provon që një rezervim i kaluar nuk rikthehet e nuk
zhvendoset. Të dyve u duhet i gjithë grumbulli:

```bash
cat tests/sql/prelude.sql supabase/schema.sql supabase/admin.sql \
    supabase/features.sql supabase/shell.sql supabase/security.sql \
    supabase/suspension.sql supabase/history.sql | docker exec -i rz-test psql -U postgres -q
cat tests/sql/verify-suspension.sql | docker exec -i rz-test psql -U postgres -q
cat tests/sql/verify-history.sql    | docker exec -i rz-test psql -U postgres -q
```

**Kujdes te `set local`:** psql punon në autocommit, ndaj `set local` jashtë një
transaksioni nuk bën asgjë dhe testi kalon duke provuar gjendjen e gabuar. Përdor
`select set_config(..., false)`. Kjo e mbante seksionin 22 të `verify.sql` duke
pohuar se pronari sheh 0 rezervimet e VETA.

---

## Të dhënat e testeve

Testet end-to-end krijojnë llogari të vërteta (`rezervo.<suitë>.<kohë>@gmail.com`)
te projekti Supabase i `.env.local`, dhe i fshijnë vetë në fund.

Nëse një suitë ndërpritet në mes, pastro me dorë:

```sql
delete from public.platform_admins
where user_id in (select id from auth.users where email like 'rezervo.%@gmail.com');

delete from auth.users where email like 'rezervo.%@gmail.com';
```

> Mos i drejto këto teste kundër një baze me klientë realë.

---

## Numrat e telefonit të klientëve

Testet nuk përdorin numra fiksë për klientët. `create_booking()` ka kufi prej 10
përpjekjesh/orë **për numër**, ndaj numra fiksë do ta ngopnin kuotën vetë suita
pas disa drejtimesh dhe testet do të dështonin pa asnjë defekt në aplikacion.
Çdo suitë ndërton numrat me `custPhone(n)` nga stampa e kohës së drejtimit.

---

## Gjuha

Aplikacioni flet shqip dhe anglisht; gjuha mbahet te cookie-ja `rezervo-locale`
dhe shqipja është e parazgjedhura. Testet drejtohen pa e vendosur atë, ndaj presin
tekst shqip.

Fjalorët ngarkohen te bundle-i i klientit, JO si prop nga serveri. Po t'i kalosh
si prop, çdo varg i tyre futet në ngarkesën RSC të çdo faqeje — dhe atëherë çdo
pohim `html.includes("ndonjë fjali")` përputhet me fjalorin e jo me atë që sheh
përdoruesi. Kjo i bëri gjashtë teste të dështonin pa pasur asnjë defekt.

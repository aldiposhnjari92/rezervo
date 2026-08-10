# Siguria

Ky dokument thotë çfarë është e mbrojtur, **si** e dimë që është e mbrojtur, dhe
çfarë mbetet ende për t'u bërë. Çdo pretendim këtu ka një test që e provon —
shih `tests/e2e/security.js` (50 kontrolle, të shkruara si sulme).

---

## Supozimi bazë

**Çelësi `anon` është publik.** Ndodhet në çdo bundle të shfletuesit; kushdo mund
ta marrë dhe t'i flasë Supabase-it direkt, pa kaluar fare nga aplikacioni.

Prandaj asnjë mbrojtje nuk mbështetet te kodi i Next-it. Çdo rregull që ka
rëndësi zbatohet në bazën e të dhënave, ku sulmuesi nuk e anashkalon dot.

---

## Çfarë mbron çfarë

### Dy shtresa mbi çdo tabelë

Supabase u jep `anon` dhe `authenticated` grant-e të plota mbi schema-n `public`.
Kjo do të thoshte se RLS-ja ishte e vetmja mbrojtje — dhe një policy e shkruar
gabim do të hapte gjithçka.

Tani duhen **të dyja** për të kaluar: grant-i i tabelës **dhe** policy-a.

| Roli | Çfarë mund të prekë |
|---|---|
| `anon` | **asgjë** — asnjë tabelë, në asnjë mënyrë |
| `authenticated` | vetëm rreshtat e biznesit të vet, vetëm veprimet që përdor UI-ja |
| `platform_admins` | asnjë rol nuk e prek; ndryshohet vetëm me SQL |

Faqja publike e rezervimit nuk lexon asnjë tabelë. Gjithçka kalon nga katër
funksione `SECURITY DEFINER` që kthejnë vetëm fushat e nevojshme.

### Të dhënat e klientëve

Numrat e telefonit të klientëve janë e dhëna më e ndjeshme këtu.

- `get_taken_slots()` kthen **vetëm** `start_time` dhe `end_time` — asnjë emër,
  asnjë numër. Faqja publike kështu di cilat orë janë të zëna pa ditur se kush i zuri.
- `get_public_business()` nuk kthen `owner_email` as `owner_id`.
- `admin_account()` nuk përmban fare fjalën `customer_phone` — as super-admini
  nuk i sheh numrat e klientëve të një biznesi tjetër.

### Ndarja mes bizneseve

Një pronar i kyçur nuk sheh dhe nuk prek asgjë të një biznesi tjetër, edhe kur i
di ID-të (të cilat i merr lehtë nga faqja publike). E provuar për: ndryshim çmimi,
anulim rezervimi, fshirje shërbimi, riemërtim biznesi, futje rezervimi në kalendarin
e tjetrit — nëpërmjet PostgREST-it dhe nëpërmjet vetë server action-eve.

### Biznesi i pezulluar

Pezullimi nuk shuan vetëm faqen publike — e bën gjithë panelin **vetëm për lexim**.
Pronari sheh çdo të dhënë të vetën dhe nuk ndryshon asnjë: as shërbime, as orar,
as rregulla, as statuse rezervimesh, as ditë të mbyllura, as rezervime me dorë.

Zbatohet te policy-t, jo te server action-et: çelësi `anon` është publik, ndaj një
pronar i pezulluar mund t'i flasë PostgREST-it pa kaluar fare nga aplikacioni.
`tests/e2e/suspension.js` e provon pikërisht atë rrugë.

Mbeten të lejuara me qëllim: leximi i gjithçkaje dhe fshirja e llogarisë — pezullimi
nuk e burgos njeriun brenda platformës.

### Rrugët e adminit

Leja kontrollohet në bazë, jo në aplikacion: `is_platform_admin()` përdoret
njëkohësisht nga RLS-ja dhe nga çdo funksion `admin_*`. Kush nuk është admin merr
**404** te `/admin` — jo "ndalohet", që të mos zbulohet as ekzistenca e panelit.

### Mbivendosjet e rezervimeve

Ndalohen nga një constraint `EXCLUDE` në Postgres, jo nga kodi. Dy klientë që
shtypin *Konfirmo* në të njëjtin milisekond — vetëm një kalon.

### Kufizim shpejtësie

Zbatohet **brenda** `create_booking()`, jo te shtresa e aplikacionit — pikërisht
sepse çelësi `anon` është publik dhe një kufi te Next-i anashkalohet duke mos
kaluar nga Next-i.

| Kova | Kufiri |
|---|---|
| për numër telefoni | 10 përpjekje / orë |
| për biznes | 30 përpjekje / orë |

Numërohen **përpjekjet**, jo rezervimet e suksesshme: përndryshe një sulm me
kërkesa që dështojnë do të kalonte i panumëruar.

### Koka HTTP

Vendosen nga middleware-i për çdo rrugë (jo vetëm ato të mbrojtura):

- **CSP me nonce për çdo kërkesë** + `strict-dynamic`. Pa `unsafe-inline` te
  skriptet: edhe nëse dikush fut një `<script>` në faqe, shfletuesi nuk e
  ekzekuton sepse nuk e ka nonce-in e asaj kërkese.
- `frame-ancestors 'none'` dhe `X-Frame-Options: DENY` — pa clickjacking.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- `Strict-Transport-Security` (vetëm në prodhim).

`style-src` mban `'unsafe-inline'`: next/font injekton stile inline dhe nonce-t
mbi stile nuk mbulohen mirë nga shfletuesit. Rreziku është shumë më i vogël se
te skriptet.

### Sesionet dhe hyrja

- Sesioni ruhet në cookies nga `@supabase/ssr`. Këto **nuk** janë `httpOnly`:
  shfletuesi duhet t'i lexojë vetë për realtime-in dhe për thirrjet te PostgREST
  (shih më poshtë pse kjo nuk fshihet dot).
- Shkëmbimi i kodit OAuth bëhet në server te `/auth/callback`.
- `next=` pranon vetëm rrugë të brendshme; `https://evil.com`, `//evil.com` dhe
  `/\evil.com` refuzohen të treja.
- Fjalëkalimi minimum 8 karaktere.
- Çelësat e email-it janë `server-only`: një import gabimisht nga një komponent
  klienti e prish build-in, në vend që t'i dërgojë çelësat te shfletuesi.

### Pse JWT-ja duket te Network tab — dhe pse s'është problem

Token-i i sesionit shkon si `Authorization: Bearer ...` te çdo kërkesë drejt
Supabase-it. Ai **duket** te DevTools, dhe kjo nuk fshihet dot: kush e hap
DevTools-in e ka tashmë sesionin e vet të hapur. Të fshehësh token-in nga vetë
pronari i tij nuk mbron askënd.

Rreziku i vërtetë është ta vjedhë dikush **tjetër**. Kundër tij:

- **CSP me nonce, pa `unsafe-inline`** — një skript i injektuar nuk ekzekutohet
  dot, ndaj nuk arrin ta lexojë token-in. Kjo është mbrojtja kryesore.
- **TLS** — mbi rrjet nuk lexohet dot.
- **Jetëgjatësi e shkurtër** — token-i skadon dhe rifreskohet; sa më i shkurtër,
  aq më e ngushtë dritarja e një token-i të vjedhur. Rregullohet te Supabase →
  Authentication → Sessions.

Token-i NUK mund të bëhet `httpOnly`: shfletuesi duhet ta lexojë vetë për
websocket-in e realtime-it dhe për thirrjet direkte te PostgREST. Heqja e tij nga
shfletuesi do të thoshte heqja e njoftimeve live.

---

## Çfarë mbetet për ty

Këto janë rregullime te paneli i Supabase-it që unë nuk i prek dot:

1. **Ndiz “Leaked password protection”** — Authentication → Policies. Kontrollon
   fjalëkalimet kundrejt HaveIBeenPwned. Aplikacioni tashmë e përkthen gabimin
   përkatës në shqip; mbetet vetëm ta ndezësh.
2. **Vendos minimumin e fjalëkalimit në 8** — po aty. Aplikacioni e kërkon në UI,
   por kufiri i vërtetë vendoset te Supabase.
3. **Ndiz konfirmimin me email** përpara se të pranosh klientë realë, që të mos
   regjistrohet kush me adresa që nuk i zotëron.
4. **Kufizo dritaren e sesionit** nëse do — Authentication → Sessions.

Të njohura dhe të pranuara:

- `btree_gist` ndodhet në schema-n `public`. Advisor-i e paralajmëron, por
  constraint-i i mbivendosjeve varet prej tij; zhvendosja nuk ia vlen.
- Funksionet `admin_*` dhe `owner_*` janë të thirrshme nga çdo përdorues i kyçur.
  Kjo është me qëllim: secila kontrollon vetë lejen brenda, dhe `anon` i është
  hequr fare.

---

## Si ta provosh vetë

```bash
./tests/run-e2e.sh          # përfshin suitën e sigurisë
node tests/e2e/security.js  # vetëm sulmet
```

Suita krijon dy llogari — një "viktimë" me dyqan dhe një "sulmues" — dhe provon
nga këndvështrimi i sulmuesit. Nëse ndonjë mbrojtje bie, testi dështon me emrin
e saktë të asaj që rrodhi.

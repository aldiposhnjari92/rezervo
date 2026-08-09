# Rezervo.al

Sistem rezervimesh online për biznese të vogla shqiptare — berberë, sallone thonjsh,
dentistë, lavazhe. Klienti rezervon nga një link, pa llogari dhe pa aplikacion.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel
**Kosto:** $0 — çdo pjesë rri brenda free tier.

---

## Konfigurimi

### 1. Baza e të dhënave

Krijo një projekt në [supabase.com](https://supabase.com), pastaj:

1. Hap **SQL Editor → New query**
2. Ekzekuto [`supabase/schema.sql`](supabase/schema.sql) — tabelat, RLS, API-ja publike
3. Ekzekuto [`supabase/admin.sql`](supabase/admin.sql) — paneli i super-adminit

Të dy skedarët janë idempotentë — mund t'i ekzekutosh sërish pa problem.

Krijon 3 tabela, RLS policies, dhe 4 funksione `SECURITY DEFINER` që përbëjnë
API-në publike (shih [Siguria](#siguria)).

**Rëndësishme:** në **Authentication → Providers → Email**, çaktivizo
*Confirm email* nëse dëshiron që regjistrimi të hyjë direkt në panel pa
konfirmim me email.

### 2. Variablat e mjedisit

```bash
cp .env.local.example .env.local
```

Plotëso nga **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Nuk duhet `service_role` key — aplikacioni nuk e përdor kurrë.

### 3. Nisja

```bash
npm install
npm run dev
```

Hap [localhost:3000](http://localhost:3000) → *Krijo Dyqanin Tënd Falas*.

### 4. Të dhëna shembull (opsionale)

Pas regjistrimit dhe setup-it, zëvendëso email-in tënd në
[`supabase/seed.sql`](supabase/seed.sql) dhe ekzekutoje në SQL Editor.

---

## Deploy në Vercel

```bash
npx vercel
```

Shto në Vercel → Settings → Environment Variables të njëjtat dy variabla.
Pastaj në Supabase → **Authentication → URL Configuration** vendos Site URL-in
e prodhimit.

---

## Struktura

```
src/
├─ app/
│  ├─ page.tsx                    /            Landing (publik, statik)
│  ├─ login/                      /login       Hyrje / regjistrim (Supabase Auth)
│  ├─ setup/                      /setup       Wizard 2-hapësh (një herë)
│  ├─ error.tsx                   Kufi gabimi për të gjithë aplikacionin
│  ├─ global-error.tsx            Kufi gabimi edhe për root layout-in
│  ├─ [slug]/                     /dyqani-yt   ★ FAQJA PUBLIKE E REZERVIMIT
│  │  ├─ page.tsx                 Server: merr biznesin + shërbimet
│  │  ├─ booking-flow.tsx         Client: shërbim → orë → të dhëna
│  │  └─ actions.ts               Server action: krijon rezervimin
│  └─ (admin)/                    Shell: shtyllë anësore (lg) / shirit poshtë (mobile)
│     ├─ calendar/                /calendar    ★ KALENDARI — muaj / javë / ditë
│     │  ├─ calendar-view.tsx     Rrjeta e kalendarit (client)
│     │  └─ booking-dialog.tsx    Detajet + Erdhi / Nuk erdhi / Anulo
│     ├─ services/                /services    CRUD shërbimesh
│     └─ settings/                /settings    Emri, telefoni, orari i punës
├─ components/
│  ├─ ui/                         shadcn/ui
│  ├─ page-header.tsx             Kokë e përbashkët faqesh
│  └─ working-hours-editor.tsx    I përbashkët: setup + settings
├─ lib/
│  ├─ actions.ts                  Server actions (biznes, shërbime, rezervime)
│  ├─ availability.ts             ★ LOGJIKA E SLOT-EVE
│  ├─ calendar.ts                 ★ LOGJIKA E KALENDARIT (rrjeta, kolonat)
│  ├─ phone.ts                    Numra shqiptarë (+3556[789]XXXXXXX)
│  ├─ slug.ts                     Slug nga emri (trajton ë, ç)
│  ├─ notifications.ts            MOCK sendWhatsAppReminder
│  ├─ auth.ts                     requireUser / requireBusiness
│  └─ supabase/{client,server,public}.ts
└─ middleware.ts                  Rifreskon sesionin, mbron rrugët e pronarit
```

### Rrugët

| URL | Kush e sheh | Çfarë është |
|---|---|---|
| `/` | të gjithë | Faqja e prezantimit |
| `/login` | të gjithë | Hyrje dhe regjistrim |
| `/setup` | pronari | Konfigurimi fillestar (një herë) |
| `/dashboard` | pronari | Të ardhurat dhe statistikat |
| `/calendar` | pronari | Kalendari i rezervimeve |
| `/customers` | pronari | Klientët dhe historiku i tyre |
| `/services` | pronari | Shërbimet |
| `/settings` | pronari | Të dhënat dhe orari |
| `/account` | pronari | Email, fjalëkalim, fshirje llogarie |
| `/auth/callback` | — | Kthimi nga Google OAuth |
| `/admin` | super-admini | Analitika e platformës |
| `/admin/[userId]` | super-admini | Një llogari e vetme + pezullimi |
| `/[slug]` | klientët | Faqja publike e rezervimit |

Emrat e mësipërm janë të rezervuar dhe nuk mund të merren si slug biznesi —
ndryshe `/services` do të mbulonte atë biznes. Rregulli zbatohet në tri vende:
te wizard-i, te server action-i dhe si `CHECK` në bazë të të dhënave.

Linqet e vjetra `/dashboard/*` ridrejtohen te rrugët e reja.

---

## Gjuha vizuale

Faqet publike — prezantimi, hyrja, konfigurimi — ndjekin gjuhën e një faqeje
moderne SaaS: gradientë të butë si shtresë sfondi, kartela me rreze bujare dhe
hije me nuancë blu, pilula për etiketat dhe butonat, dhe pamje të vërteta të
produktit me thellësi.

Pamjet te [`landing-visual.tsx`](src/app/landing-visual.tsx) nuk janë foto — janë
komponentë të ndërtuar me të njëjtat rregulla si produkti (bosht orësh, blloqe
sipas minutave, ngjyrat e statuseve), të vendosur brenda një kornize shfletuesi
dhe me kartela që notojnë mbi to.

Ngjyrat vijnë nga të njëjtat token-a si paneli, ndaj tema e errët funksionon
kudo pa punë shtesë.

> **Dëshmitë te faqja e parë janë PLACEHOLDER.** Zëvendësoji me citime të vërteta
> (me leje nga klientët) përpara se ta publikosh, ose hiqe seksionin. Mos publiko
> dëshmi të sajuara — shih koment te `src/app/page.tsx`.

---

## Tema, njoftimet dhe hyrja me Google

**Tema** — e çelët / e errët / sipas sistemit, te shtylla anësore (ose ikona te
koka në telefon). Zgjedhja ruhet në `localStorage` dhe zbatohet nga një skript i
vogël *para* pikturimit të parë, ndaj faqja nuk xixëllon e bardhë kur rifreskohet
në temën e errët. Paleta e errët është e zgjedhur, jo një përmbysje automatike:
ngjyrat e grafikëve u rivalidhuan edhe kundër sfondit të errët.

**Njoftimet** — zilja te koka, me numërues të palexuarash dhe listë aktiviteti.
Njoftimet i shkruan një trigger në Postgres, jo aplikacioni — kështu edhe një
rezervim i futur direkt në bazë e prodhon njoftimin. Rezervimet që i shton vetë
pronari nuk njoftohen (ai sapo i shkroi). Zilja dëgjon realtime, ndaj një
rezervim i ri shfaqet pa rifreskuar faqen.

**Shtylla anësore** paloset në ikona; gjendja ruhet në `localStorage`.

### Hyrja me Google

Kodi është gati. Butoni shfaqet **vetëm** kur ofruesi është aktivizuar te
Supabase — faqja e hyrjes e pyet `/auth/v1/settings` dhe fsheh butonin ndryshe,
që askush të mos klikojë diçka që kthen gabim.

Për ta aktivizuar:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   *Create Credentials* → *OAuth client ID* → *Web application*
2. Te **Authorized redirect URIs** vendos:
   `https://<projekti>.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → Providers → Google** → ndiz dhe ngjit
   Client ID + Client Secret
4. Supabase → **Authentication → URL Configuration** → shto te *Redirect URLs*:
   `http://localhost:3000/auth/callback` dhe `https://<domeni-yt>/auth/callback`

Shkëmbimi i kodit me sesionin bëhet te [`/auth/callback`](src/app/auth/callback/route.ts)
në server, që token-at të shkojnë direkt në cookies dhe të mos kalojnë kurrë nga
JavaScript-i i faqes.

---

## Paneli i pronarit

`/dashboard` është faqja ku bie pronari pas hyrjes: të ardhurat e periudhës me
krahasim ndaj së kaluarës, rezervimet, sa është humbur nga mosardhjet, grafiku
ditor i të ardhurave, ndarja sipas statusit, shërbimet më të kërkuara, si dhe
ditët e oraret më të ngarkuara. Periudha zgjidhet 7 / 30 / 90 ditë.

Të gjitha numrat vijnë nga një thirrje e vetme (`owner_dashboard`), e cila
llogarit çdo gjë brenda Postgres-it sipas kohës së Tiranës.

---

## Veçoritë e biznesit

| Veçoria | Ku |
|---|---|
| **Rezervim me dorë / walk-in** | butoni *Rezervim* te kalendari |
| **Ditë të mbyllura** (festa, pushime) | `/settings` |
| **Pushimi i ditës** (dreka) | `/settings` |
| **Rregullat e rezervimit** | `/settings` |
| **Lista e klientëve** | `/customers` |

**Rezervimi me dorë** është për telefonatat dhe klientët që vijnë pa lajmëruar.
Pronari kalon me qëllim mbi orarin, pushimin dhe ditët e mbyllura — ai e di më
mirë se sistemi. E vetmja gjë e paprekshme mbetet mbivendosja. Telefoni është
opsional, sepse për një walk-in shpesh nuk e ke.

**Rregullat** — pushim mes takimeve (buffer), njoftim minimal dhe sa përpara
mund të rezervohet — prekin vetëm rezervimet online. Buffer-i zbatohet duke
zgjeruar rezervimet ekzistuese në të dyja anët, e njëjta logjikë në TypeScript
dhe në SQL.

**Lista e klientëve** nuk ka tabelë të vetën: ndërtohet nga vetë rezervimet,
duke grupuar sipas numrit të telefonit (ose emrit, për walk-in-et pa numër).
Kështu tregon sa herë ka ardhur secili, sa ka shpenzuar dhe sa herë nuk është
paraqitur — pa asnjë punë shtesë për pronarin.

---

## Kalendari

`/calendar` është kalendari, me tri pamje të lidhura me URL-në —
`/calendar?view=month|week|day&date=YYYY-MM-DD` — që të mund të ruash ose ndash një
pamje të caktuar.

| Pamje | Çfarë tregon |
|---|---|
| **Muaj** | Rrjetë javësh të plota, deri në 2 rezervime për ditë + "*+N më shumë*". Klikimi i një dite hap pamjen ditore. |
| **Javë** | 7 kolona me bosht kohor; në telefon rrëshqet horizontalisht. |
| **Ditë** | Një kolonë, bllok për çdo rezervim, me vijë të kuqe në orën aktuale. |

Boshti vertikal nuk është 00:00–24:00: llogaritet nga orari i punës i ditëve
të dukshme dhe zgjerohet vetëm sa duhet për të përfshirë rezervime jashtë
orarit (p.sh. pas ndryshimit të orarit). Rezervimet që mbivendosen — një i
anuluar mbi një aktiv — ndahen automatikisht në kolona.

Klikimi i një rezervimi hap dialogun me telefonin e klientit dhe butonat
*Erdhi* / *Nuk erdhi* / *Anulo*.

---

## Paneli i super-adminit

`/admin` shfaq gjithë platformën: biznese, llogari, rezervime, vlerë shërbimesh,
një grafik ditor 30-ditësh dhe ndarjen sipas statusit. `/admin/[userId]` hap një
llogari të vetme me shërbimet, rezervimet e fundit dhe butonin e pezullimit.

Adminët e shohin linkun **Paneli i platformës** te fundi i shtyllës anësore
(dhe si ikonë mburoje te koka në telefon). Për të tjerët `/admin` kthen 404.

### Si bëhesh admin

Nuk ka faqe regjistrimi — vetëm një rresht SQL:

```sql
insert into public.platform_admins (user_id, note)
select id, 'themelues' from auth.users where email = 'ti@shembull.com';
```

### Modeli i të drejtave

Admini **lexon gjithçka** dhe mund të **pezullojë** një biznes. Nuk mund të
redaktojë apo fshijë të dhënat e askujt — kështu një llogari admini e vjedhur
nuk shkatërron dot asgjë.

Leja kontrollohet në bazën e të dhënave, jo në aplikacion. `is_platform_admin()`
përdoret njëkohësisht nga RLS-ja dhe nga çdo funksion `admin_*`, të cilët ngrenë
gabim `42501` nëse thirrësi nuk është admin. Edhe nëse dikush thërret
`/rest/v1/rpc/admin_overview` direkt me token-in e vet, merr refuzim.

Kush nuk është admin merr **404** te `/admin` — jo "ndalohet", që të mos zbulohet
as ekzistenca e panelit.

Pezullimi e nxjerr faqen publike jashtë linje (404) dhe bllokon rezervimet e reja;
të dhënat nuk preken dhe veprimi kthehet mbrapsht në çdo moment.

Pronari njoftohet në tri mënyra, si për pezullimin ashtu edhe për riaktivizimin:

1. **Me email** — te pezullimi, arsyeja e adminit i përcillet fjalë për fjalë; pa
   arsye, dërgohet një njoftim i përgjithshëm. Te riaktivizimi, njoftohet që faqja
   është sërish online. Posta është "best effort": veprimi mbetet i kryer edhe nëse
   email-i dështon, dhe admini sheh qartë nëse pronari u njoftua apo jo.
2. **Te zilja e njoftimeve** — një njoftim për çdo kalim gjendjeje. E shkruan një
   trigger mbi `businesses`, jo aplikacioni, ndaj lind edhe nëse `suspended_at`
   ndryshohet direkt në bazë. Një ndryshim i zakonshëm i biznesit (emri, orari)
   nuk prodhon njoftim.
3. **Me një shirit në panel** — i vazhdueshëm, në çdo faqe, derisa llogaria të
   riaktivizohet. Shiriti mbulon *gjendjen*; zilja mbulon *ngjarjen*.

### Email-i

Provider-i nuk është i ngulitur në kod — zgjidhet nga çelësi që gjendet:

| Çelësi | Provider | Falas |
|---|---|---|
| `BREVO_API_KEY` | Brevo (serverë në BE) | 300/ditë ≈ 9.000/muaj |
| `RESEND_API_KEY` | Resend | 3.000/muaj, 100/ditë |
| asnjë | vetëm log | — |

Të dy fliten me `fetch` mbi HTTP, pa SDK. Pa çelës, email-i shkruhet në log dhe
asnjë veprim nuk bllokohet. Për një provider tjetër, shtoje te `PROVIDERS` në
[`src/lib/email.ts`](src/lib/email.ts) — asgjë tjetër nuk ndryshon.

### Ngjyrat e grafikëve

Të validuara me validatorin e paletës mbi sfond të bardhë — bandë ndriçimi,
ngopje, ndarje për daltonizëm dhe kontrast. Renditja e statuseve **nuk është
kozmetike**: bluja rri mes jeshiles dhe portokallisë, sepse pikërisht ai çift
ngatërrohet te daltonizmi i kuq-jeshil. Çdo vlerë shoqërohet nga etiketë tekst,
ndaj identiteti nuk varet kurrë vetëm nga ngjyra.

---

## Llogaria e pronarit

`/account` i lejon pronarit të ndryshojë email-in (me konfirmim), fjalëkalimin,
dhe të fshijë llogarinë. Fshirja kërkon shkrimin e fjalës `FSHIJ` dhe heq me
kaskadë biznesin, shërbimet dhe rezervimet. Llogaritë e adminit nuk fshihen dot
nga paneli.

---

## Logjika e disponueshmërisë

Zemra e produktit, në [`src/lib/availability.ts`](src/lib/availability.ts) —
funksione të pastra, pa varësi nga rrjeti:

```
orari i punës i ditës
  → gjenero slot-e çdo 30 min nga ora e hapjes
  → hiq slot-et që nuk mbarojnë brenda orarit (shërbim 90min në 17:00 → jo)
  → hiq slot-et që mbivendosen me rezervime ekzistuese
  → hiq slot-et në të shkuarën (+ 30 min kohë përgatitjeje)
```

**Zona orare.** Çdo gjë ruhet si `timestamptz` (UTC) dhe përkthehet në
`Europe/Tirane` vetëm për shfaqje dhe për gjenerimin e slot-eve. Kalimi
verë/dimër është testuar: 09:00 në Tiranë është 07:00 UTC në gusht dhe
08:00 UTC në janar.

**Pse llogaritet dy herë?** Klienti gjeneron slot-et për UI-n (i shpejtë, pa
round-trip). Serveri i validon sërish brenda `create_booking()` — klienti nuk
besohet kurrë.

---

## Siguria

**Shih [`SECURITY.md`](SECURITY.md)** për pamjen e plotë: çfarë mbrohet, si e dimë,
dhe çfarë mbetet për t'u ndezur te paneli i Supabase-it. Përmbledhje:

- `anon` nuk ka asnjë të drejtë mbi asnjë tabelë; duhen dy shtresa (grant + policy)
- CSP me nonce për çdo kërkesë, pa `unsafe-inline` te skriptet
- kufizim shpejtësie brenda `create_booking()`, ku çelësi publik nuk e anashkalon dot
- 50 kontrolle sigurie të shkruara si sulme, me llogari "viktimë" dhe "sulmues"

Faqja publike nuk lexon tabela direkt. RLS i mbyll të tri tabelat për `anon`,
dhe çdo veprim publik kalon nëpër një funksion `SECURITY DEFINER`:

| Funksion | Kthen | Pse |
|---|---|---|
| `get_public_business(slug)` | biznes + shërbime aktive | fsheh `owner_email`, `owner_id` |
| `get_taken_slots(id, from, to)` | vetëm `start_time`, `end_time` | asnjë e dhënë personale e klientëve |
| `is_slug_available(slug)` | boolean | për wizard-in |
| `create_booking(...)` | `{ok, booking}` \| `{ok, error}` | i gjithë validimi në server |

`create_booking()` verifikon: biznesi dhe shërbimi ekzistojnë dhe përputhen,
shërbimi është aktiv, ora është në të ardhmen dhe e përputhur me hapin 30-min,
i gjithë shërbimi bie brenda orarit të punës, telefoni normalizohet dhe
validohet, dhe maksimumi 3 rezervime aktive për numër.

**Rezervime të dyfishta.** Nuk mbrohen nga kodi i aplikacionit, por nga një
constraint i Postgres-it:

```sql
constraint bookings_no_overlap exclude using gist (
  business_id with =,
  tstzrange(start_time, end_time) with &&
) where (status <> 'cancelled')
```

Edhe dy klientë që shtypin *Konfirmo* në të njëjtin milisekond — vetëm një
kalon. I dyti merr mesazh shqip që ora sapo u zu, dhe lista e orëve rifreskohet
automatikisht.

---

## Çfarë nuk ka V1 (me qëllim)

| Mungon | Ku lidhet kur të vijë koha |
|---|---|
| Pagesa online | vetëm "Pagesa në dyqan" |
| WhatsApp / SMS i vërtetë | `sendWhatsAppReminder()` në `lib/notifications.ts` — tani vetëm `console.log` |
| Email notifications | — |
| Shumë biznese për një pronar | `unique index businesses_owner_id_key` |
| Ftesa adminësh nga UI-ja | shto rreshtin te `platform_admins` me SQL |

---

## Verifikimi

```bash
npm run typecheck   # tsc --noEmit
npm run build       # 8 rrugë, pa gabime
npm run lint
```

Logjika e slot-eve, normalizimi i telefonit dhe slug-et janë testuar me
53 raste (përfshirë kalimin verë/dimër). Logjika e kalendarit — rrjeta e
muajit, kufijtë e javës, ndarja në kolona e rezervimeve që mbivendosen dhe
konvertimi në kohën e Tiranës — me 49 raste të tjera.

Skema SQL është ekzekutuar dhe verifikuar kundër Postgres 16 + `btree_gist`:
mbivendosjet, orari i punës, RLS-i dhe kufizimet e telefonit sillen si duhet.

Veçoritë e reja kanë 26 teste njësi për rregullat (buffer, pushim, mbyllje,
njoftim, dritare) dhe 56 kontrolle end-to-end që provojnë se rregullat zbatohen
edhe kur thirret direkt API-ja, se walk-in-et i kalojnë me qëllim, dhe se paneli
e lista e klientëve nxjerrin numrat e duhur.

Paneli i adminit ka testin e vet (53 kontrolle), i ndarë në dy faza: e para provon
se një përdorues i zakonshëm merr 404 te `/admin` dhe refuzim nga çdo funksion
`admin_*` edhe kur i thërret direkt; e dyta se admini i vërtetë sheh analitikën,
se pezullimi e nxjerr faqen publike jashtë linje dhe se kthehet mbrapsht.

Përveç tyre, një test end-to-end (66 kontrolle) e drejton aplikacionin e ndërtuar
si të ishte shfletues — sesion i vërtetë Supabase në cookies dhe thirrje `Next-Action`
për çdo buton — duke mbuluar regjistrimin, setup-in, CRUD-in e shërbimeve,
rezervimin publik, të tria pamjet e kalendarit dhe ndryshimin e statuseve.

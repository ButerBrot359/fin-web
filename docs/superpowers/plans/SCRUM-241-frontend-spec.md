# SCRUM-241 «Тарификация» — Frontend Specification (fin-web)

> **Audience:** the fin-web team and its Claude session.
> **Backend:** webbuh-api (Spring Boot) — dev `http://localhost:8080`, **no auth** in dev, CORS `*`.
> **Frontend:** fin-web (React 19 + TypeScript + Vite).
> **Scope note (read first):** SCRUM-241 added **zero new REST endpoints**. The whole Тарификация feature is exposed through the **existing generic** document / information-register / form-event / print API plus **two new form-event command buttons**. So the frontend work is mostly *presentation*, not new HTTP integrations.

---

## 1. What the feature is

**Тарификация** = the planned monthly payroll fund (ФОТ) of every worker (including vacancies) of a budget institution for the school year. A document has a **header** (organization, date, flags) and **5 tabular sections (ТЧ)**.

**Document lifecycle:**
1. **Заполнить по всем работникам** — autofill the ТЧ from kadry registers (active employees + their planned accruals). *(⚠️ not yet usable end-to-end — see §6.)*
2. **Рассчитать всё** — compute `Результат` for each accrual (the payroll math), round to whole tenge.
3. **Провести** (post) — write 4 tariff registers always, + 5 kadry registers if a header flag is set.
4. **Печать** — print forms (one works, two are stubs).

---

## 2. Target UX — mirror the real 1C app

The reference 1C screens (1C:Enterprise «Комплекс бюджетных процессов»):

### List screen
- **Filter bar** above the grid: `Организация`, `Подразделение организации`, `Сотрудник/Вакансия`.
- **Grid columns:** `Номер`, `Дата`, `Организация`, `Подразделение`, **`Сумма документа`** (= our `ItogoSummaNachisleniy`), `Комментарий`.
- **Toolbar:** `Создать`, `Generate`, `Изменить выделенные`, `Отчёты`, search.

### Document form
- **Header:** `Номер`, `Дата`, `Организация`, `Подразделение`.
- **Toolbar:** `Провести и закрыть` · `Записать` · `Провести` · `Generate` · **`Заполнить`** · **`Рассчитать все`** · **`Очистить все`** · `Отчёты`.
- **ONE consolidated worker grid «Итоги по работникам»** with columns: `№`, `Работник`, `Должность`, `Тарифная ставка`, `Надбавки`, `Месячный ФОТ`, `Дополнительный ФОТ`, `Итого ФОТ`.
- **Footer:** `Комментарий`, `Ответственный`.

### ⚠️ Key UX gap to close
1C presents **one consolidated per-worker summary grid**. webbuh's current generic *legacy* renderer instead stacks all **5 raw ТЧ** tables (and renders the header scalar fields *below* the tables). The frontend should present a **consolidated «Итоги по работникам» grid** while keeping the raw ТЧ as the editable source of truth (see §7).

---

## 3. Backend API surface (all existing/generic)

Base `http://localhost:8080`. Response wrappers: `ApiDataResponse<T> = { data: T }`, `ApiListResponse<T> = { data: [...], total }`.

### Document type metadata — `/api/document-types`
| Method · Path | Returns |
|---|---|
| `GET /api/document-types/Tarifikatsiya` | `DocumentTypeDto` — full metadata incl. `attributes[]` and **`newView`** (decisive flag; currently `false`). |
| `GET /api/document-types/Tarifikatsiya/form-events` | `List<String>` — subscribable `eventName`s. |
| `GET /api/document-types/Tarifikatsiya/recorders` | registers this document writes. |

### Document entries — `/api/document-entries`
| Method · Path | Purpose |
|---|---|
| `GET /{typeCode}/columns` | grid column metadata (`ColumnMetaDto[]`: system fields + EAV attrs). |
| `GET /{typeCode}/paged?af=…&sortAttr=Data&sortDir=DESC` | paged list (also `POST /{typeCode}/search` filter-DSL, and `GET /{typeCode}/search?q=`). |
| `GET /{typeCode}/new?<params>` | blank entry template (prefilled defaults). |
| `GET /id/{id}` | `DocumentEntryDto` — `attributes` map; **TABLE attrs = arrays of row objects**. |
| `POST /{typeCode}` (body `DocumentEntryCreateDto`) | **create** — also carries the post intent (no separate "post" endpoint). |
| `PUT /id/{id}` (body `DocumentEntryCreateDto`) | **update** (and post). |
| `POST /{id}/unpost` | **unpost** (idempotent; 422 if blocked). |
| `GET /{id}/movements` | register movements grouped by kind (for «Движения»). |
| **`POST /{typeCode}/handle-event`** (body `FormEventRequestDto`) | **form events** — see §4. |

> **Posting** is performed via create/update (`DocumentEntryCreateDto` carries the "post" intent). There is **no** `POST /{id}/post` endpoint; only `/{id}/unpost`.

### Print — `PrintController` (same `/api/document-entries` base)
| Method · Path | Purpose |
|---|---|
| `GET /{typeCode}/print-commands` | array of `{ id, name… }` → the «Печать» menu (501 if unsupported). |
| `GET /{typeCode}/{id}/print?language=&form=` | `application/pdf` blob (`language` empty = ru, `Kz` = kazakh; `form` from print-commands). |

### Information registers (the 4 tariff + kadry register views)
- `GET /api/information-register-types/{code}` → type meta (dimensions/resources).
- `GET /api/information-register-entries/{code}/columns` → grid columns.
- `GET /api/information-register-entries/{code}/paged?af=…` (or `POST /{code}/search`) → `InformationRegisterEntryDto { period, recorderDocumentEntryId, isActive, attributes }`.
- `GET /api/information-register-entries/{code}/slice-last|slice-first?atDate=…&<dim>=…` → срез.

### Reference pickers (dictionary / calc-plan / enum cells)
- `GET /api/universaldomain-types/{domain}/{code}` → type meta (has `dependsOn` ⇒ mandatory filters).
- `GET /api/universaldomain-entries/{domain}/{typeCode}/paged?<AttrCode>=<value>&af=<AttrCode>:<id>&sortAttr=Data&sortDir=ASC&parent=…` → picker feed.
  - Search is **`GET …/{typeCode}/search?q=`** (not POST).
- **Filter-dependent dictionaries:** a type whose meta has `dependsOn: [{ sourceAttributeCode, targetAttributeCode }]` **requires** `af=<targetAttributeCode>:<id>` or returns **400** (`"…зависит от фильтров. Обязательные фильтры (af): [..]"`).
  - **Concrete example:** `PodrazdeleniyaOrganizatsiy` requires `af=Vladelets:<organizationId>`. The picker must pass the document's `Organizatsiya` id as the `Vladelets` filter. (Or pass `skipDependsOn=true` to bypass.)

---

## 4. Form-event commands — the 2 new buttons + dispatch contract

**Endpoint:** `POST /api/document-entries/Tarifikatsiya/handle-event`
**Request** `FormEventRequestDto`: `{ eventName: string, entry: DocumentEntryDto /* id + attributes */ }`
**Response** `FormEventResponseDto`: `{ attributes: Map<string, any>, formConfig: Map<string, any> }`

The server resolves `eventName → FormEvent` and runs the registered handler (read-only tx). **The frontend applies `response.data.attributes` back onto the form:** array values → replace the corresponding ТЧ rows (table-replacer); scalar values → `setValue` the field.

### Events the Тарификация handler registers
| `eventName` | kind | meaning |
|---|---|---|
| **`OnRasschitatVseClick`** | click | **«Рассчитать всё»** — compute `Результат` for all accruals (§6). |
| **`OnZapolnitPoVsemRabotnikamClick`** | click | **«Заполнить по всем работникам»** — autofill ТЧ from kadry data (⚠️ not yet usable, §6). |
| `OnItogiPoRabotnikamRasschitanStatusClick` | click | per-row recalc (same path). |
| `OnOrganizatsiyaChanged` | change | org changed → clears formConfig. |
| `OnKommentariyStartChoice` | start-choice | open multiline comment dialog. |
| `OnItogiPoRabotnikamSelection` / `…BeforeDeleteRow` | selection / before-delete | open row / delete row. |

### Rendering the command buttons — the gap & options
`newView=false` ⇒ legacy `FormRenderer`, whose layout schema has **no button/command node**, so «Рассчитать всё» / «Заполнить» / «Очистить все» can't appear from metadata today. Pick one:
- **(A) SDUI** — flip `newView=true` and ship a server view layout (`Tarifikatsiya.ФормаОбъекта`) emitting these as `BUTTON`/`COMMAND` nodes. The existing SDUI engine renders + dispatches them (and can host the consolidated grid) with no per-field frontend code. **Cleanest long-term.**
- **(B) Enhance legacy `FormRenderer`** — add a metadata/`form-events`-driven command toolbar that POSTs `handle-event` and applies the response. *(A temporary local hack did exactly this for testing — see §8.)*

### The ECHO contract (critical for «Рассчитать всё»)
The handler returns the recomputed `НачисленияРаботников` rows in the response under the key **`"NachisleniyaRabotnikov"`** (the ТЧ attribute code). Apply it via the **table-replacer** (RHF `useFieldArray.replace`) so the `Результат` cells update; the subsequent **Записать/Провести persists** them.

**Row-object shape** the table-replacer expects (same shape the initial `GET /id/{id}` returns for that ТЧ):
```jsonc
{
  "Rabotnik":    { "id": 42, "displayName": "Иванов И.И.", "nameRu": "Иванов И.И." }, // reference → object
  "VidRascheta": { "id": 7,  "nameRu": "Оклад по дням", "code": "00208" },           // reference → object
  "Razmer": 85123, "Stavka": 1.5, "Rezultat": 127685                                  // scalars → raw
}
```
- Keys = child-attribute codes.
- **Reference cells = objects `{ id, displayName|nameRu|name, … }`** — a bare id renders blank.
- Scalars (Результат, Размер, Ставка…) = raw values.
- **No top-level `id`** on the row object (RHF `keyName` collision).

---

## 5. Document model (fields to render)

### Header attributes
| code | nameRu | type | notes |
|---|---|---|---|
| `Data` | Дата | DATETIME | required (doc date) |
| `Organizatsiya` | Организация | DICTIONARY → `Organizatsii` | required |
| `PodrazdelenieOrganizatsii` | Подразделение организации | DICTIONARY | optional; **picker needs `af=Vladelets:<org id>`** |
| `SredneeKolichestvoChasov` | Среднее количество часов | DECIMAL | |
| `RuchnayaKorrektirovka` | Ручная корректировка | BOOLEAN | |
| `ItogoSummaNachisleniy` | Итого сумма начислений | DECIMAL | **derived / read-only** (see §6) |
| `Otvetstvennyy` | Ответственный | DICTIONARY | |
| `Kommentariy` | Комментарий | TEXT (multiline) | |
| `Kod` | Код | STRING | |
| **`FormirovatKadrovyeDvizheniya`** | Формировать кадровые движения | BOOLEAN | **gates kadry-register posting** |

### Tabular sections (5)
Each is a `TABLE` attribute → a child document type. Columns below; **reference pickers** are marked `→`.

**`DannyeRabotnikov`** (Данные работников):
`Rabotnik` (OBJECT composite → `Sotrudniki` ∪ `Vakansii`), `PodrazdelenieOrganizatsii` →, `Dolzhnost` →, `GrafikRaboty` → `Kalendari`, `VidRabotnika` → ENUMS `VidyDeyatelnostiSotrudnikov`, `KategoriyaSotrudnika` →, `VidStazha` → `VidyStazha`, `ZamenyayushchiySotrudnik` → ENUMS `VidShtata`, `EtoVakansiya` (BOOL), `FunktsionalnyyBlok` →, `FizicheskoeLitso` →, `Vakansiya` →.

**`NachisleniyaRabotnikov`** (Начисления работников):
`Rabotnik` (OBJECT), **`VidRascheta` → CALCULATION_PLAN `VidyNachisleniyOrganizatsii`**, `Razmer` (DEC), `Stavka` (DEC), **`Rezultat` (DEC, computed)**, `NedelnayaStavka` + 4 level variants (`…Predshkolnaya/Nachalnaya/Srednyaya/Vysshaya`), `TarifnayaStavka` + 4 level variants, `IstochnikFinansirovaniya` →, `KodPlatnykhUslug` →, `Programma` →, `Spetsifika` →, `EtoVakansiya` (BOOL), `EtoNadbavka` (BOOL), `SNedelnoyNagruzkoy` (BOOL), `RazdelyatPoShablonam` (BOOL), `Prioritet` (INT), `OsnovnoyVidNachisleniya` → CALCULATION_PLAN, `FizicheskoeLitso` →, `Vakansiya` →.

**`RaspredeleniePoNagruzkam`** (Распределение по нагрузкам):
`Rabotnik` (OBJECT), `VidNagruzki` → ENUMS `VidyNagruzok`, `Klass` → ENUMS `KlassyObucheniya`, `NedelnayaStavka` (DEC), `FizicheskoeLitso` →, `Vakansiya` →.

**`RazdeleniyaPoShablonam`** (Разделения по шаблонам):
`Rabotnik` (OBJECT), `VidRascheta` → CALCULATION_PLAN, `DolyaRazdeleniya` (DEC %), `Rezultat` (DEC), `IstochnikFinansirovaniyaNaRazdelenie` →, `ProgrammaNaRazdelenie` →, `KodPlatnykhUslugNaRazdelenie` →, `SpetsifikaNaRazdelenie` →, `EtoVakansiya` (BOOL), `EtoNadbavka` (BOOL), `EtoDopNachislenie` (BOOL), `FizicheskoeLitso` →, `Vakansiya` →.

**`DopolnitelnyeNachisleniya`** (Дополнительные начисления):
`Rabotnik` (OBJECT), `VidRascheta` → CALCULATION_PLAN, `TipNachisleniya` (STRING), `Razmer` (DEC), `Stavka` (DEC), `NedelnayaStavka` (DEC), `Rezultat` (DEC), sources (`IstochnikFinansirovaniya`/`KodPlatnykhUslug`/`Programma`/`Spetsifika` →), `EtoVakansiya` (BOOL), `RazdelyatPoShablonam` (BOOL), `RuchnayaKorrektirovka` (BOOL), `FizicheskoeLitso` →, `Vakansiya` →.

**Picker rule:** `dataType ∈ {DICTIONARY, ENUMS}` OR `domainKind ∈ {DICTIONARY, ENUMS, CALCULATION_PLAN}` → reference picker; choose the universaldomain endpoint from `allowedTypes[].domainKind` + `typeCode`. `OBJECT` (`Rabotnik`) → composite picker spanning the two dictionaries (Сотрудники ∪ Вакансии), round-trip `{type, id}` on save. Everything else = scalar input.

---

## 6. Behaviors the frontend must account for

- **«Рассчитать всё»**: two-pass over `НачисленияРаботников`, sorted by `Prioritet` — base accruals first, then надбавки as **% of the worker's rounded base sum**; 5 calc-method families; **round to whole tenge (HALF_UP, 0 decimals)**. Writes `Rezultat` per row + header `ItogoSummaNachisleniy`, and **echoes the rows** (§4). Frontend: apply echo → table updates → save persists.
- **«Заполнить по всем работникам»**: ⚠️ **not yet usable end-to-end** — clears the 5 ТЧ then tries to fill from `КадровыеДвижения`/`ПлановыеНачисления` срез, but (a) its writes don't reliably persist (read-only tx), (b) yields 0 rows / `Rezultat=0` when no kadry source data exists. Render it, but don't depend on it; «Рассчитать всё» is still required afterward.
- **Posting**: writes the **4 tariff registers always**; the **5 kadry registers only if `FormirovatKadrovyeDvizheniya = true`**. `afterSave` recomputes `ItogoSummaNachisleniy = Σ(НачисленияРаботников.Результат) + Σ(ДополнительныеНачисления.Результат)`. **⇒ the per-row `Результат` must be populated/persisted before posting** — this is why the echo matters; posting with `Результат=0` ⇒ `Итого=0`.
- **«Очистить все»**: 1C has it but there is **no backend event** — clear the 5 ТЧ client-side (or request a backend command).
- **Print**: `Результаты тарификации` (`Rezultaty`) works; **`По категориям` / `По работникам` are backend stubs** (blank — their 1C sources are СКД reports, no portable layout).
- **`VidRascheta` picker**: previously 400-ed (`/CALCULATION_PLAN/null`); **fixed backend-side** (allowed_types linked to `VidyNachisleniyOrganizatsii`).

### Registers written on post (codes — for the register views)
**Tariff (always):** `TarifikatsiyaTarifikatsiyaSotrudnikov` (1 row per worker; ФизЛицо resolved from Сотрудник), `TarifikatsiyaNachisleniyaSotrudnikov` (accruals, split+aggregate), `TarifikatsiyaDopNachisleniyaSotrudnikov`, `TarifikatsiyaRaspredeleniePoNagruzkam` (13-class pivot).
**Kadry (only under the flag):** `KadrovyeDvizheniyaSotrudnikov`, `GrafikRabotySotrudnikov`, `SostoyaniyaSotrudnikov`, `SvedeniyaOKadrovykhPrikazakh`, `PlanovyeNachisleniyaSotrudnikov` (period = start-of-month) + `ZanyatostSotrudnikov` (deactivate-only).

---

## 7. Recommendations (priority order)

1. **Decide the form path:** SDUI (`newView=true` + server view layout, option A) vs enhance the legacy `FormRenderer` (option B). SDUI is the cleaner home for the command toolbar + consolidated grid.
2. **Command toolbar** on the form: `Заполнить` · `Рассчитать всё` · `Очистить все` (+ keep `Записать`/`Провести`/`Печать`). Wire `Рассчитать всё → OnRasschitatVseClick` and `Заполнить → OnZapolnitPoVsemRabotnikamClick` via `handle-event`; apply the response (esp. the `NachisleniyaRabotnikov` echo via the table-replacer). `Очистить все` = client-side clear of the 5 ТЧ.
3. **Consolidated «Итоги по работникам» grid** (match 1C): one row per worker — `Работник`, `Должность` (from `ДанныеРаботников`) + `Тарифная ставка` / `Надбавки` / `Месячный ФОТ` / `Дополнительный ФОТ` / `Итого ФОТ` (aggregated from `НачисленияРаботников` + `ДополнительныеНачисления` per worker). Keep the raw 5 ТЧ editable (advanced view) — they remain the backend's source of truth.
4. **List page:** add the 1C filters (`Организация` / `Подразделение` / `Сотрудник-Вакансия` → `af` params) and the `Сумма документа` column (= `ItogoSummaNachisleniy`).
5. **Reference pickers:** for owner-scoped dictionaries pass the owner filter — `PodrazdelenieOrganizatsii` picker must send `af=Vladelets:<Organizatsiya id>` (fixes the 400). Generic rule: read the picked type's `dependsOn` and pass `af=<target>:<sourceValue>`.
6. **Print menu** from `print-commands` → open the `print` blob (PDF). Hide/disable or WIP-label the two stub forms.
7. **OBJECT-composite `Rabotnik`:** the picker must allow choosing from BOTH `Sotrudniki` and `Vakansii` and round-trip the composite (type + id) on save.

---

## 8. Note on the temporary local buttons (testing stopgap)

A local, **uncommitted** fin-web change added `Рассчитать всё` + `Заполнить по всем работникам` buttons to the legacy `DocumentFormToolbar` (gated to `typeCode === 'Tarifikatsiya'`), extending `use-form-events.ts` with a `triggerEvent(eventName)` that POSTs `handle-event` and reuses the existing response-applier (`setValue` + table-replacers). That is option B as a stopgap; productionizing means either generalizing it (metadata-driven command buttons) or moving to SDUI (option A).

---

## 9. End-to-end verification

1. **Create** a Тарификация; set `Организация` (a real org with employees), `Дата`. **Записать**.
2. Fill **`ДанныеРаботников`** (a `Работник` = Сотрудник, Должность, …) and **`НачисленияРаботников`** (`ВидРасчета` = «Оклад по дням», `Размер` = `85123`, `Ставка` = `1.5`).
3. **«Рассчитать всё»** → the row's `Результат` cell shows **127 685** and the header `Итого` = **127 685** (via the echo).
4. **«Провести»** → register `Tarifikatsiya_NachisleniyaSotrudnikov` has a row with `Результат = 127685`; `Tarifikatsiya_TarifikatsiyaSotrudnikov` has 1 row with `ФизическоеЛицо` auto-resolved.
5. Toggle **`Формировать кадровые движения`** ON → re-post → the 5 kadry registers populate.
6. **«Печать → Результаты»** renders a PDF.

> Picker note: leave `Подразделение организации` blank for a quick test, or wire `af=Vladelets:<org>` first (otherwise the picker 400s). Backend on `:8080` (no auth, CORS `*`).

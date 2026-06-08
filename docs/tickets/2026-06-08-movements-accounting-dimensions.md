# `/movements` не отдаёт колонки-измерения для группы ACCOUNTING (Журнал проводок госучреждения)

- **Тип:** bug / доработка backend
- **Приоритет:** medium
- **Дата:** 2026-06-08

## Где

- Эндпоинт: `GET /api/document-entries/id/{id}/movements`
- Пример: документ ABZ00-00017, `id = 27854912` (PostuplenieOtKontragenta)
- Группа в ответе: `registerKind: "ACCOUNTING"`, `registerTypeCode: "ZhurnalProvodokGosUchrezhdeniya"`

## Проблема

В экране «Движения документа» во вкладке **«Журнал проводок госучреждения
(Регистр бухгалтерии)»** не отображаются балансовые измерения (Организация,
ФКР, Специфика, Подразделение, Источник финансирования, Код платных услуг).

Причина — на стороне backend: в группе `ZhurnalProvodokGosUchrezhdeniya`
массив `columns[]` содержит **только** 4 колонки, измерений там нет (ни в
`columns[]`, ни в `entries[]`):

```json
"columns": [
  {"code":"accountDt","nameRu":"Счёт Дт","dataType":"STRING","sortOrder":1},
  {"code":"accountKt","nameRu":"Счёт Кт","dataType":"STRING","sortOrder":2},
  {"code":"summa","nameRu":"Сумма","dataType":"DECIMAL","sortOrder":3},
  {"code":"soderzhanie","nameRu":"Содержание","dataType":"STRING","sortOrder":4}
]
"entries": [
  {"_id":66,"_period":"2026-06-08T15:15:10.93","_lineNo":1,
   "accountDt":"1330","accountKt":"1330","summa":600.0000,"soderzhanie":"Поступление ТМЗ"}
]
```

Фронт рендерит ровно то, что приходит в `columns[]`, ничего не выкидывая →
раз измерений нет в ответе, их физически нечем показать.
**Фронтовых изменений не требуется.**

## Что ожидается

Для группы `registerKind: "ACCOUNTING"` в `/movements` добавить
колонки-измерения в `columns[]` и их значения в `entries[]`:
`Organizatsiya, FKR, Spetsifika, Podrazdelenie (PodrazdelenieOrganizatsii),
IstochnikFinansirovaniya, KodPlatnykhUslug`.

## Как именно (контракт уже есть в этом же ответе)

В **этом же** ответе `/movements` соседние группы
(`registerKind: "ACCUMULATION"` — `DvizheniyaTMZ`, `DvizhenieAktivovIZapasov`)
измерения **уже отдают корректно**: колонка с `dataType: "DICTIONARY"`,
`objectKind: "DIMENSION"`, а значение в строке — **разрезолвленный объект**
с `displayName`/`nameRu`. Нужно сделать так же для ACCOUNTING-группы.
Пример из рабочей группы:

```json
// columns[]
{"code":"FKR","nameRu":"ФКР","nameKz":"ФКР","dataType":"DICTIONARY","objectKind":"DIMENSION","sortOrder":5}

// entries[].FKR — уже объект, не голый ID
"FKR": {
  "id": 35598,
  "dictionaryTypeCode": "FunktsionalnayaKlassifikatsiyaRaskhodov",
  "code": "00000004823", "code1C": "355/009",
  "nameRu": "Социальная поддержка лиц с инвалидностью",
  "displayName": "Социальная поддержка лиц с инвалидностью"
}
```

Соответствие измерение → справочник (`dictionaryTypeCode`):

| Колонка | Справочник |
|---|---|
| `Organizatsiya` | `Organizatsii` |
| `FKR` | `FunktsionalnayaKlassifikatsiyaRaskhodov` |
| `Spetsifika` | `EkonomicheskayaKlassifikatsiyaRaskhodov` |
| `Podrazdelenie` / `PodrazdelenieOrganizatsii` | `PodrazdeleniyaOrganizatsiy` |
| `IstochnikFinansirovaniya` | `VidyIstochnikovFinansirovaniya` |
| `KodPlatnykhUslug` | `KlassifikatorKodovPlatnykhUslug` |

## Acceptance criteria

- `GET /api/document-entries/id/27854912/movements` → группа
  `ZhurnalProvodokGosUchrezhdeniya`:
  - `columns[]` содержит 6 колонок-измерений (помимо
    `accountDt/accountKt/summa/soderzhanie`);
  - в `entries[]` значения измерений — объекты с `displayName` (как в
    ACCUMULATION-группах), а не голые ID;
- На экране «Движения документа» во вкладке журнала появляются заполненные
  колонки Организация/ФКР/Специфика/Подразделение/Источник
  финансирования/Код платных услуг — **без доработок фронта** (текущий
  `formatMovementCell` уже берёт `displayName` из объекта).

## Примечание

Отдельный экран-список регистра
(`GET /api/accounting-register-entries/{typeCode}/columns` + `/search`)
измерения уже отдаёт корректно — фронт под него доработан в предыдущей
задаче. Задача касается **только** ручки `/movements`.

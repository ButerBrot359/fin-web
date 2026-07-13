# SCRUM-281 «Виды ОС» — спека для fin-web

Бэкенд: ветка `talgat/os-card-fields` (webbuh). Постановка аналитиков — `docs/tmp/os-card-fields/ВидОС.docx`
(два замечания по скриншотам 1С). Бэковая часть готова; фронт выкладывается независимо —
до готовности бэка поведение не меняется (оба изменения аддитивные).

---

## Часть 1 — «Группа ОС»: группы отображаются как «2360 - Машины и оборудование»

**Фронту делать, скорее всего, ничего не нужно** — проверить, что везде рендерится
`displayName`/`presentation` с бэка, а не `nameRu`.

Что изменилось на бэке: у справочника «Виды долгосрочных активов» (`VidyDolgosrochnykhAktivov`)
записи-**группы** теперь приходят с `displayName = "{код счёта учёта} - {наименование}"`,
например `"2360 - Машины и оборудование"`, `"2310 - Земля"` (дефис с пробелами, как в 1С).
Элементы — без префикса (тоже как в 1С).

Где это уже проросло автоматически (единая точка на бэке):

| Источник | Поле |
|---|---|
| `GET /api/universaldomain-entries/DICTIONARY/{typeCode}/search` и `/paged` | `DictionaryEntryDto.displayName` |
| Дропдаун `GET /api/dictionary-entries/{typeCode}/entries` | `presentation` |
| SET_VALUE-патчи форм / чип выбранного значения | `presentation` |

Чек для фронта (сверено с кодом fin-web):
- inline-автокомплит ячейки/поля уже читает `displayName` (`table-cell-renderer.tsx` label:
  `displayName ?? nameRu`) — префикс появится сам; выбранный чип через onSelect тоже ок
  (`dict-sidebar-list-view.tsx` label: `displayName ?? getLocalizedName`);
- **нужна правка**: колонка «Наименование» в таблице пикера DictSidebar
  (`dict-sidebar-list-view.tsx`, колонка id `nameRu`) строится через `getLocalizedName`
  (`nameKz`/`nameRu`) — переключить на `displayName ?? getLocalizedName(...)`,
  иначе в списке «Показать все» префикса не будет;
- SDUI-путь читает `presentation` — уже несёт префикс, правок не нужно.

Механизм generic: тип справочника несёт `group_presentation_attribute` (метаданные),
фронту матчить ничего не нужно — просто рендерить готовую строку с бэка.

---

## Часть 2 — отбор «Вид ВНА» по «Счёту учёта» строки ТЧ (новый контракт `rowFilter`)

**Документ:** «Поступление от контрагента», ТЧ «Основные средства» (и любой будущий документ
с такой же парой колонок — правило на бэке data-driven).

### Контракт — два канала, одна семантика

Бэк объявляет хинт `rowFilter: { targetAttrCode: rowColumnBinding }`:
- **ключ** — код атрибута ЦЕЛЕВОГО справочника, по которому фильтровать (`af`-ключ);
- **значение** — binding колонки ТЕКУЩЕЙ строки ТЧ, откуда взять значение фильтра.

**Канал 1 (ОСНОВНОЙ — legacy-рендер, именно им сейчас ходит ПоступлениеОтКонтрагента,
`new_view=false`):** метаданные типа-строки ТЧ, которые уже читает `use-table-columns.ts`:

```
GET /api/universaldomain-types/DOCUMENT/PostuplenieOtKontragenta_OsnovnyeSredstva
→ attributes[]:
{
  "code": "VidVNA",
  "dataType": "DICTIONARY",
  "allowedTypes": [{ "domainKind": "DICTIONARY", "typeRef": "VidyDolgosrochnykhAktivov" }],
  "rowFilter": { "SchetUcheta": "SchetUcheta" }
}
```

У атрибутов без правила ключ `rowFilter` в JSON **отсутствует вовсе** (не `null`).
Проверено вживую на dev: у `VidVNA` есть, у `SchetUcheta`/`MOL`/`OsnovnoeSredstvo` — нет.

Где встраивать на фронте: в `table-field.tsx`/`DictCell` уже есть три фильтр-механизма
(`useCellDependency`/dependsOn, серверные `fieldFilters`, `synthesizeReferenceFilter`) —
все читают ШАПКУ; `rowFilter` — четвёртый, читающий сестринскую ячейку той же строки
(доступна через `useWatch({name: '<КодТЧ>.<idx>.<binding>'})` или `row` контекст).

**Канал 2 (форвард — SDUI, когда TableCellEditor научится ссылочным ячейкам):**
тот же map в props узла TABLE_COLUMN:

```json
{
  "type": "TABLE_COLUMN",
  "props": {
    "binding": "VidVNA",
    "targetTypeCode": "VidyDolgosrochnykhAktivov",
    "domain": "DICTIONARY",
    "rowFilter": { "SchetUcheta": "SchetUcheta" }
  }
}
```

Оба канала считаются одним резолвером на бэке (`RowAccountFilterResolver`) — расхождений
не будет.

### Что делает фронт при открытии пикера/дропдауна колонки с `rowFilter`

Для каждой пары из `rowFilter`:
1. Прочитать ячейку текущей строки: `row[rowColumnBinding]`. Shape ссылочной ячейки —
   `{ id, presentation }` либо `null`.
2. Если ячейка заполнена — добавить фильтр со значением `row[rowColumnBinding].id`:
   - `/search` и `/paged` («Показать все»): query-параметр `af={targetAttrCode}:{id}`
     (формат `AttrCode:EntryId`, как существующий af);
   - дропдаун `optionsSource`: плоский параметр `{targetAttrCode}={id}` в params
     (поверх `optionsSource.params` с бэка).
3. Если ячейка пуста (`null`) — фильтр по этому ключу **не отправлять** (полный список).
4. Значение строки меняется (пользователь сменил «Счёт учёта») — при следующем открытии
   пикера фильтр берётся заново из строки; кэш выдачи с другим af использовать нельзя.

Отбор «мягкий», как в 1С (ПараметрыВыбора): фильтруется только пикер этого поля;
общий список справочника в других местах интерфейса не ограничивается.

### Пример (данные dev-стенда)

Строка ТЧ: «Счёт учёта» = 2360 (id счёта в плане счетов, напр. `{id: 4711}`):

```
GET /api/universaldomain-entries/DICTIONARY/VidyDolgosrochnykhAktivov/search?q=&size=100&af=SchetUcheta:4711
→ только виды со счётом учёта 2360 (Компьютерное оборудование, Офисное оборудование, …)
```

Счёт учёта пуст → без `af` → все 51 запись (текущее поведение).

Серверная фильтрация уже работает (в т.ч. `groupsOnly`+`af` вместе); у всех 51 элементов
`VidyDolgosrochnykhAktivov` реквизит `SchetUcheta` на стенде заполнен.

### Generic-поведение

`rowFilter` появится у ЛЮБОЙ ссылочной колонки ТЧ, чей целевой справочник имеет реквизит
`SchetUcheta` (ACCOUNT_PLAN) и в той же ТЧ есть колонка `SchetUcheta` (ACCOUNT_PLAN) —
например, СписаниеОС и другие ОС-документы получат отбор автоматически. Фронту стоит
реализовать обработку prop универсально (map, возможно >1 ключа), не хардкодить под VidVNA.

`rowFilter` из layout-override (если когда-то появится) приоритетен — бэк ставит через putIfAbsent.

---

## Как проверить руками (dev)

1. Карточка ОС → поле «Группа ОС» → выпадающий список и «Показать все»:
   группы вида «2310 - Земля» … «2600 - Биологические активы» (10 групп с префиксом,
   3 группы без префикса — у них счёт учёта не подтверждён аналитиками, это ок).
2. «Поступление от контрагента» → ТЧ «Основные средства» → строка со «Счётом учёта» 2360 →
   пикер «Вид ВНА» показывает только виды 2360; очистить счёт → полный список.

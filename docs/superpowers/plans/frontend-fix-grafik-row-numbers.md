# SDUI: фронт-правка (fin-web) — колонка «N» (нумерация строк) в табличной части

> **Дата:** 2026-06-30
> **Контекст:** баг 5 батча по `ZayavkaNaRegistratsiyuGPSdelki`. В ТЧ «График платежей»
> нет ведущей колонки «N» (порядковый номер строки), как в табличной части 1С.

---

## Что готов бэк

На TABLE-узле `table.grafik` теперь выставлен проп **`showRowNumbers: true`**
(миграция `migration_2026-06-30_grafik_show_row_numbers.sql`; константа
[`NodeProps.SHOW_ROW_NUMBERS`](../../../webbuh-contract/src/main/java/kz/asiaservis/constants/NodeProps.java)).

Так выглядит узел на проводе:
```jsonc
{ "id": "table.grafik", "type": "TABLE",
  "props": { "editable": true, "allowAdd": true, "allowDelete": true,
             "allowReorder": true, "showRowNumbers": true },   // ← НОВОЕ
  "binding": "GrafikPlatezhey",
  "children": [ /* TABLE_COLUMN: naznachenie, dataOplaty, protsent, summa */ ] }
```

## Почему это фронт

Порядковый номер строки — **презентационное** значение, выводимое из позиции строки
в массиве; в данных строк (`GrafikPlatezhey`) его нет и не должно быть (иначе он ломался бы
при добавлении/удалении/переупорядочивании). Поэтому бэк лишь сигналит намерение флагом,
а рисует колонку грид.

## Что сделать (фронт)

В компоненте таблицы (`table-node.tsx` / грид редактируемой ТЧ): если
`node.props.showRowNumbers === true`, рендерить **ведущую (первую) колонку «N»** с 1-based
индексом строки (`rowIndex + 1`).

- Колонка только для чтения, не входит в `children`/`binding` — чисто визуальная.
- Заголовок: «N» (или «№»).
- Узкая фиксированная ширина (≈48px), выравнивание по правому краю/центру.
- Номер пересчитывается при add/delete/reorder (т.к. это просто индекс позиции).

Эскиз:
```tsx
const showRowNumbers = node.props?.showRowNumbers === true
// ...в рендере строки, перед колонками из children:
{showRowNumbers && <td className="row-number">{rowIndex + 1}</td>}
// ...в шапке:
{showRowNumbers && <th className="row-number">N</th>}
```

Для таблиц без `showRowNumbers` (например read-only `dtkt.rows`) поведение не меняется —
колонка не рисуется.

## Сводка

| # | Что | Где правка (фронт) | Бэк |
|---|-----|-----------|-----|
| 5 | Колонка «N» в ТЧ | `table-node.tsx`: рендер ведущей колонки-индекса при `props.showRowNumbers` | ✅ готово (флаг `showRowNumbers=true` на `table.grafik`) |

> Баги 4 (статус «Заявка исполнена на X из Y») и 6 (кнопки после проведения) — **полностью
> на бэке**, фронт-правок не требуют: статус приходит обычным `LABEL`-узлом `label.ispolneno`,
> кнопка «Отменить проведение» — обычным `BUTTON`-узлом `btn.unpost`; оба рендерятся
> существующими компонентами реестра.

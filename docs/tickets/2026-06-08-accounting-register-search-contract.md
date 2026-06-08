# `/search` журнала проводок: нет `totalElements` и пустые `Kod`/`Kolichestvo`/`ValyutnayaSumma`

- **Тип:** bug / доработка backend
- **Приоритет:** medium
- **Дата:** 2026-06-08
- **Регистр:** `ZhurnalProvodokGosUchrezhdeniya` (домен `ACCOUNTING_REGISTER`)

## Контекст

Грид журнала проводок переведён на построение колонок строго по
`GET /api/accounting-register-entries/{typeCode}/columns`, значения —
из строк `POST …/{typeCode}/search`. При сверке live-ответов вскрылись
два несоответствия контракта на стороне backend.

---

## Проблема 1 — `/search` не отдаёт `totalElements`

`POST /api/accounting-register-entries/ZhurnalProvodokGosUchrezhdeniya/search`
возвращает paged-объект **без поля `totalElements`** (похоже на Spring
`Slice`, а не `Page`):

```json
{
  "content": [ /* 22 строки */ ],
  "empty": false, "first": true, "last": true,
  "number": 0, "numberOfElements": 22, "size": 25,
  "pageable": { "offset": 0, "pageNumber": 0, "pageSize": 25, ... }
  // totalElements ОТСУТСТВУЕТ
}
```

Фронт показывает счётчик «Загружено N из {totalElements}». Без поля
получается «Загружено 22 из 0».

**Фронт-митигейшн уже сделан:** при отсутствии `totalElements` берём число
загруженных строк (косметически). Но истинный total (для корректной
пагинации при >25 строк и точного счётчика) знает только backend.

### Ожидается
- `/search` возвращает `totalElements` (полноценный `Page`), как остальные
  paged-эндпоинты проекта.

---

## Проблема 2 — колонки `Kod` / `Kolichestvo` / `ValyutnayaSumma` пустые

В `/columns` присутствуют:

```json
{"code":"ValyutnayaSumma","nameRu":"Вал. сумма","dataType":"DECIMAL","isSystem":false}
{"code":"Kolichestvo","nameRu":"Количество","dataType":"DECIMAL","isSystem":false}
{"code":"Kod","nameRu":"Код","dataType":"STRING","isSystem":false}
```

Но в строках `/search` **нет ключей** `Kod` / `Kolichestvo` /
`ValyutnayaSumma`. Вместо них приходят раздельные Дт/Кт-поля:

```json
"kolichestvoDt": null, "kolichestvoKt": null,
"valyutnayaSummaDt": null, "valyutnayaSummaKt": null
// поля "Kod" в строке нет вовсе
```

Фронт читает значение колонки по её `code` (`row["Kolichestvo"]` и т.д.) →
`undefined` → ячейка пустая. Сейчас у всех строк эти значения `null`,
поэтому визуально некритично, но контракт рассогласован: колонка объявлена,
а значения под её кодом не приходят.

### Ожидается (на выбор)
- либо backend кладёт значения под теми же кодами, что в `/columns`
  (`Kod`, `Kolichestvo`, `ValyutnayaSumma`) — «схлопнутая» сторона, как
  сделано для измерений (`fkr`, `spetsifika`, … рядом с `fkrDtId/fkrKtId`);
- либо в `/columns` для этих колонок задаётся, какую сторону показывать
  (или они убираются из списка, если не нужны в журнале).

Аналогия уже работает для измерений: в строке есть и `fkrDtId/fkrKtId`,
и «схлопнутое» `fkr` — фронт берёт `fkr`. Нужно сделать так же для
`Kolichestvo`/`ValyutnayaSumma` (и определить источник для `Kod`).

---

## Приёмка

- `/search` возвращает `totalElements`; счётчик грида показывает реальное
  число (не «из 0»).
- Колонки `Количество` / `Вал. сумма` / `Код` заполняются из строк
  (значение приходит под кодом колонки), либо их состав в `/columns`
  согласован с тем, что реально есть в строке.

## Примечание

Субконто (`subkontosDt`/`subkontosKt`) и измерения резолвятся на фронте по
ID — доработок backend по ним не требуется.

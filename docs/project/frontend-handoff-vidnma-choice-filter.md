# Наряд фронт-агенту: серверный отбор поля ВидНМА (карточка «Нематериальные активы»)

## Контекст
Поле ВидНМА (ссылка на `ВидыДолгосрочныхАктивов`) в карточке справочника
`НематериальныеАктивы` открывало весь справочник. Бэкенд теперь отдаёт готовый
серверный отбор через `formConfig.fieldFilters` (эталон КБП — Отбор.Ссылка).
Ключ поля = фактический `attribute.code` реквизита ВидНМА (брать из ответа как
есть, транслит не использовать).

## Контракт бэка (3 случая)

1. Отбор по набору id:
```json
{ "formConfig": { "fieldFilters": {
  "<кодПоля>": { "domain": "DICTIONARY", "typeCode": "VidyDolgosrochnykhAktivov",
                 "attributeIn": { "id": [101,102,103,104,105] } } } } }
```
2. Fail-closed (группа не настроена): пустой набор + readOnly + сообщение:
```json
{ "formConfig": { "fieldFilters": {
  "<кодПоля>": { "domain":"DICTIONARY","typeCode":"VidyDolgosrochnykhAktivov",
                 "attributeIn": { "id": [] }, "message": "Отбор видов НМА не настроен: ..." },
  "<кодПоля>.readOnly": true } } }
```
3. Реквизит ВидНМА отсутствует: `formConfig.configError` (fieldFilters нет — полный справочник НЕ подставлять):
```json
{ "formConfig": { "configError": {
  "attributeCode1C":"ВидНМА","typeCode":"NematerialnyeAktivy","message":"Не найден реквизит «ВидНМА» ..." } } }
```

## Применение `attributeIn.id` в пикере
POST `/api/dictionaries/entries/VidyDolgosrochnykhAktivov/search`, тело `FilterRequest`:
```json
{ "filters": [
    { "field": "id",       "op": "in",        "value": [101,102,103,104,105] },
    { "field": "parentId", "op": "isNotNull", "value": null } ],
  "logic": "AND" }
```
`data.content[]` — допустимые виды НМА.

⚠️ **Обязательно:** query `?parent` НЕ передавать (перезапишет отбор), а в теле
ОБЯЗАТЕЛЬНО оставить условие по `parentId` (`isNotNull`). Иначе бэкенд подмешает
`parentId IS NULL` (вернутся только корни — виды пропадут). Наличие условия
parentId включает escape-hatch → тело берётся как есть: `id IN […] AND parentId IS NOT NULL`.

## Пустой `attributeIn.id: []`
Не удалять условие, не искать неограниченно — показать 0 вариантов. Оптимизация:
при пустом массиве вообще не слать запрос, сразу пустой список.

## Fail-closed / ошибки
- `"<код>.readOnly": true` → поле нельзя открыть/очистить/изменить (блокировать и кнопку выбора).
- `formConfig.configError` → не открывать полный справочник; показать сообщение; прочие поля (в т.ч. КодКОФ) оставить доступными.

## Тесты
Unit: (1) attributeIn.id → FilterCondition(id, in, […]) в теле POST /search, ?parent нет, добавлено parentId isNotNull; (2) все id доходят; (3) []→пусто без неограниченного поиска; (4) readOnly→поле и кнопка заблокированы; (5) configError→полный справочник не открывается, сообщение, прочие поля доступны.
E2E: карточка НМА → выбор ВидНМА: есть 000000054–058, нет 000000001/2/3 (Земля/Здания/Сооружения), групп нет, вложенные подгруппы доступны (id раскрыты рекурсивно на сервере), выбор→сохранение→переоткрытие.

## Справочно (бэк, не менять)
id = все негрупповые потомки предопределённой группы `ВидыДолгосрочныхАктивов.НематериальныеАктивы`
(`predefinedName='НематериальныеАктивы'`, резерв `code1C='000000012'`), рекурсивно.
Бэк-тесты: `NematerialnyeAktivyItemFormHandlerTest` (5/5), `NematerialnyeAktivyVidNmaChoiceFilterIT` (3/3, PostgreSQL).

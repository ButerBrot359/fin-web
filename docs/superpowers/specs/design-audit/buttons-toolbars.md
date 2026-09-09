# Ф3 аудит дизайн-системы — группа «Кнопки и тулбары»

Figma fileKey `8RxAFhNubquQ1bz912H2wB`. Ноды: `40:601` (button sheet), `772:24370` («Заполнено» — регистрация заявления по вычетам), `167:5013` (ПКО список), `22:1215` (ПКО оплата от покупателя).
Скриншоты: `figma/button-sheet.png`, `figma/toolbar-zapolneno-top.png`, `figma/toolbar-zapolneno-lower.png`, `figma/toolbar-pko-list.png`, `figma/toolbar-pko-oplata.png`.
Цвета сняты не «на глаз», а сэмплингом пикселей `button-sheet.png` (Pillow) по координатам из `get_metadata` — картинка 1239×1144 = локальные координаты фрейма 1:1, сдвига/скейла нет.

## §1. Спека Figma

### 1.1. Геометрия (общая для всех вариантов)

| Параметр           | Default                                                                                                                  | Small                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Высота (icon-only) | 40px                                                                                                                     | 28px                                                          |
| Высота (текст)     | 40px                                                                                                                     | 30px                                                          |
| Радиус угла        | ≈8px (замер: на краю fill начинается через ~8px по вертикали/диагонали от угла; совпадает с токеном `radii.md=8` в коде) | то же                                                         |
| Шрифт              | Body 2 — Google Sans Medium 14px, line-height 100%, letter-spacing 0. Регистр **обычный**, никакого uppercase            | то же                                                         |
| Гэп иконка↔текст   | 8px                                                                                                                      | не измерялся отдельно (small icon-only не имеет текста рядом) |
| Бордер             | **нет ни у одного варианта/состояния** — outlined-кнопок в Figma не существует вообще                                    | —                                                             |

Паддинги (вычислены из разницы координат icon/text внутри символа):

| Форма кнопки          | Default (40px)                                                          | Small                                                    |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| icon-only             | 10px со всех сторон (40×40, иконка 20×20 по центру)                     | 4px со всех сторон (28×28, иконка 20×20 в (4,4))         |
| текст без иконки      | 16px слева/справа, 10px сверху/снизу (134×40, текст 102px)              | 12px слева/справа, 6px сверху/снизу (113×30, текст 89px) |
| текст + иконка слева  | pad-left 8 → icon 20 → gap 8 → текст → pad-right 16 (154×40)            | не снимался                                              |
| текст + иконка справа | pad-left 16 → текст → gap 8 → icon 20 → pad-right 8 (154×40, зеркально) | не снимался                                              |

### 1.2. Цвета по вариантам/состояниям (bg / текст+иконка)

Из `get_variable_defs(40:601)`: `Accent 01=#DAF449`, `Accent 01/hover=#DAFE10`, `Accent 01/pressed=#C0E10B`, `Accent 02=#2A75F4`, `UI 01=#FFFFFF`, `UI 04=#DBE7FD`, `UI 05=#9FA9BA`, `UI 06=#222124`, `UI 08=#C4D6F5`. Пиксельный сэмплинг всех вариантов подтвердил именно эти значения (расхождение `DBE7FD` vs сэмплинг `DBE7FC` — 1 бит, шум рендера).

| Вариант                                               | Default                                                                            | Hover                        | Pressed                  | Disabled                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------ | ---------------------------------- |
| **Primary** (salatovy)                                | bg `#DAF449` / текст+иконка `#222124`                                              | bg `#DAFE10` / `#222124`     | bg `#C0E10B` / `#222124` | bg `#9FA9BA` / текст **`#FFFFFF`** |
| **Secondary** (белый)                                 | bg `#FFFFFF` / `#222124`                                                           | bg `#DBE7FD` / **`#2A75F4`** | bg `#C4D6F5` / `#2A75F4` | bg `#FFFFFF` / `#9FA9BA`           |
| **Tertiary, icon-only**                               | bg прозрачный / `#222124` (чёрная иконка!)                                         | bg `#DBE7FD` / `#2A75F4`     | bg `#C4D6F5` / `#2A75F4` | bg прозрачный / `#9FA9BA`          |
| **Tertiary, текст/текст+иконка** («ссылочная» кнопка) | bg прозрачный / **`#2A75F4`** (синий текст по умолчанию — в отличие от icon-only!) | bg `#DBE7FD` / `#2A75F4`     | bg `#C4D6F5` / `#2A75F4` | bg прозрачный / `#9FA9BA`          |
| **Text-кнопки** (`Type=Tetriary`, `Property 1=Text*`) | совпадают со строкой выше — это один и тот же тип `Tetriary`, просто без иконки    |                              |                          |                                    |

Важный нюанс: у Tertiary есть **два разных дефолтных состояния текста** в зависимости от формы — icon-only дефолт чёрный (`#222124`), текстовые/иконка+текст варианты дефолт синий (`#2A75F4`). Hover/Pressed у всех форм Tertiary одинаковы.

### 1.3. Тулбары — состав, порядок, интервалы

Во всех трёх тулбарах (список/форма/секция) гэп между кнопками **8px**, высота ряда **40px**. Определяющий признак — Primary только у самой левой/главной кнопки, остальные — Secondary (белые), dropdown-кнопки — Secondary text-icon-right с шевроном.

**«Заполнено» (772:24370), верхний тулбар документа (`Buttons` 772:24390, y=172):**
`[Провести и закрыть]` Primary 189px → `[Записать]` Secondary 105px → `[Провести]` Secondary 108px → `[АТ КТ]` Secondary icon-only 40px → `[Печать ⌄]` Secondary text-icon-right 107px → `[Отчёты ⌄]` Secondary text-icon-right 110px.
Вертикальный ритм: заголовок документа заканчивается на y=140 → тулбар y=172 (**гэп 32px**) → тулбар заканчивается y=212 → поля формы y=236 (**гэп 24px**).

**Вложенный тулбар секции «Вычеты ИПН» (772:24420, y=429):**
`[+ Добавить]` Primary text-icon-left 127px → `[▲]` 40px → `[▼]` 40px → `[Подбор]` Secondary 92px; справа (flex justify-between): `[Search]` 374px → `[Ещё ⌄]` Secondary text-icon-right 84px.
Заголовок секции «Вычеты ИПН» y=384 → тулбар y=429 (**гэп 20px** — уже, чем гэп 32px у тулбара уровня страницы).

**ПКО список (167:5013), тулбар списка (`Buttons` 167:5026, y=164):**
`[Создать]` Primary 96px → 3× icon-only Secondary по 40px → `[Изменить выделенные…]` Secondary 223px → `[Печать ⌄]` 107px → `[Отчёты ⌄]` 110px; справа `[Search]` 374px → `[Ещё ⌄]` 84px.
Заголовок y=100 (h40, конец 140) → тулбар y=164 (**гэп 24px**, не 32px как в «Заполнено»).

**ПКО оплата от покупателя (22:1215), тулбар формы (`Buttons` 42:905, y=164):**
`[Провести и закрыть]` Primary 189px → `[Записать]` 105px → `[Провести]` 108px → `[Печать ⌄]` 107px → 3× icon-only 40px → `[Отчёты ⌄]` 110px; отдельно справа (без search на этом экране) `[Ещё ⌄]` 84px.
Заголовок→тулбар гэп тоже **24px** (не 32).

⚠️ Несогласованность в самой Figma-спеке: гэп «заголовок→тулбар» на уровне страницы документа — то 32px («Заполнено»), то 24px (ПКО список/ПКО оплата). Не код-баг, а вопрос к дизайнеру — фиксирую как наблюдение, не как P1/P2 расхождение кода.

## §2. Текущее состояние кода (ветка `feature/design-system`)

### 2.1. Токены — уже канонизированы и совпадают с Figma 1:1

`src/shared/design/tokens.ts`:

- `palette.accent01/accent01Hover/accent01Pressed` = `#daf449`/`#dafe10`/`#c0e10b` (строки 24-26) — точное совпадение с Primary bg по всем состояниям.
- `palette.accent02` = `#2a75f4` (строка 27) — точное совпадение с синим текстом Secondary/Tertiary hover-pressed.
- `palette.ui01/ui04/ui05/ui06/ui08` (строки 16-23) — точное совпадение с белым/светло-голубым/серым/чёрным из спеки.
- `shadows.primaryHover` = `rgba(218,244,73,0.8)` (строка 71) = `#DAF449` — токен уже существует, просто нигде не применён к MUI-кнопке.
- `radii.md = 8` (строка 89) — совпадает с замером радиуса.
- `tailwind.config.ts:27-31` — `borderRadius.md = '8px'`, все цвета проброшены в Tailwind (`bg-accent-01`, `text-ui-06`, `bg-ui-04` и т.д., строки 37-58).

### 2.2. `src/shared/ui/buttons/button.tsx` — уже соответствует Figma почти идеально

`variantClasses` (строки 15-22):

```
primary:   bg-accent-01 text-ui-06 hover:bg-accent-01-hover hover:shadow-primary-hover active:bg-accent-01-pressed ... disabled:bg-ui-05 disabled:text-white
secondary: bg-ui-01 text-ui-06 hover:bg-ui-04 hover:text-accent-02 hover:shadow-secondary-hover active:bg-ui-08 active:text-accent-02 ... disabled:bg-ui-01 disabled:text-ui-05
tertiary:  text-accent-02 hover:bg-ui-04 hover:shadow-secondary-hover active:bg-ui-08 ... disabled:text-ui-05 disabled:bg-transparent
```

Паддинги (строки 36-57): icon-only `p-2.5`(10px)/small `p-1`; текст `py-2.5`(10px) + `pl-4/pr-4`(16px) без иконки, `pl-2 gap-2`(8px) с иконкой слева — практически один в один с замерами §1.1. `rounded-md` (строка 65) = 8px. Никакого uppercase.

Используется сегодня **только** во «вложенных» тулбарах табличных частей:

- `src/features/sdui/ui/nodes/composite/table-toolbar.tsx` (SDUI, ТЧ-тулбар) — `gap-2` (строка 81, 8px) ✓ совпадает с Figma.
- `src/features/form-renderer/ui/table-field-toolbar.tsx` (легаси, аналогичный ТЧ-тулбар) — `gap-2` (строка 30) ✓.

### 2.3. Главный тулбар документа/списка — раздельная, нестилизованная реализация

`src/features/sdui/ui/nodes/action/button-node.tsx:122-131` — рендерит **сырой** `<Button>` из `@mui/material`, без токенов:

```tsx
<Button
  variant={muiVariant}
  disabled={disabled}
  onClick={handleClick}
  aria-label={ariaLabel}
  sx={isIconOnly ? { minWidth: 0, px: 1 } : undefined}
>
  {content}
</Button>
```

`src/features/sdui/ui/nodes/action/button-presentation.ts:11-26` — маппинг варианта с бэка на MUI:

```ts
const muiVariant =
  variant === 'contained' || variant === 'primary'
    ? 'contained'
    : variant === 'text' || variant === 'text-dropdown'
      ? 'text'
      : 'outlined' // ⚠ ловит и 'secondary', И 'tertiary'
```

Secondary и Tertiary визуально **неразличимы** — оба превращаются в `outlined`.

`src/app/theme/theme.ts` — в блоке `components` (строки 27-306) **нет ключа `MuiButton`**. Значит для `<Button>` из `button-node.tsx` действуют чистые дефолты MUI v7 Button: `textTransform: uppercase`, `borderRadius: theme.shape.borderRadius` (4px, не переопределён), паддинг `6px 16px`, высота ≈36.5px, `outlined` border `1px solid rgba(primary.main, 0.5)`.

Плюс `palette.primary.main = semantic.primary.value = palette.accent02.value = #2a75f4` (`theme.ts:20`, `tokens.ts:65`) — то есть MUI `contained` красится в **синий**, не в лаймовый, а `outlined` получает **синюю рамку** — это и есть симптом «сейчас кнопки — MUI contained/outlined с UPPERCASE и синими рамками» из постановки задачи.

`src/features/sdui/ui/nodes/layout/toolbar-node.tsx:72` — контейнер тулбара: `className="flex items-center gap-1${...}"` → `gap-1` = **4px**, а не 8px как в Figma.

Легаси `pages/documents/document-list/` прямых использований `Button` не найдено — тулбар списка уже рендерится через SDUI `ToolbarNode`/`ButtonNode` (см. §2.3), т.е. попадает под ту же нестилизованную реализацию.

## §3. Расхождения

| Что                                             | Сейчас                                                                                                                                                                                                     | По Figma                                                                                     | Где чинить                                                                                                                                     | Приоритет                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Цвет Primary/Contained                          | Синий фон (`palette.primary.main = accent02`), т.к. `MuiButton` не переопределён и берёт `theme.palette.primary`                                                                                           | Лаймовый `#DAF449`/hover `#DAFE10`/pressed `#C0E10B`, текст `#222124`                        | `src/app/theme/theme.ts` (добавить `MuiButton.styleOverrides`) либо перевести `button-node.tsx` на `@/shared/ui/buttons`                       | **P1**                          |
| Регистр текста кнопок                           | `textTransform: uppercase` (дефолт MUI Button, не переопределён)                                                                                                                                           | Обычный регистр, без transform                                                               | `src/app/theme/theme.ts` / `button-node.tsx`                                                                                                   | **P1**                          |
| Secondary vs Tertiary                           | Обе мапятся в один MUI-вариант `outlined` (`button-presentation.ts:23`) — визуально неразличимы, у обеих синяя рамка от `primary.main`                                                                     | Secondary = белый фон/чёрный текст; Tertiary = прозрачный фон/синий текст, без рамки у обеих | `src/features/sdui/ui/nodes/action/button-presentation.ts` (реализовать 3 разных ветки)                                                        | **P1**                          |
| Наличие рамки (border)                          | `outlined` даёт видимую синюю рамку `1px solid rgba(primary.main,0.5)`                                                                                                                                     | Рамки нет ни у одного варианта/состояния кнопки                                              | Тот же `MuiButton`/переход на shared Button                                                                                                    | **P1**                          |
| Высота кнопки                                   | MUI default ≈36.5px (паддинг `6px 16px` + line-height)                                                                                                                                                     | 40px (Default) / 30-28px (Small)                                                             | `theme.ts` `MuiButton.styleOverrides` или `shared/ui/buttons` (уже 40px через `py-2.5`+line-height)                                            | **P2**                          |
| Радиус угла                                     | MUI default `theme.shape.borderRadius` = 4px                                                                                                                                                               | ≈8px (= токен `radii.md`)                                                                    | `theme.ts`                                                                                                                                     | **P2**                          |
| Гэп между кнопками тулбара                      | `toolbar-node.tsx:72` — `gap-1` = 4px                                                                                                                                                                      | 8px везде (замерено во всех 3 тулбарах)                                                      | `src/features/sdui/ui/nodes/layout/toolbar-node.tsx` (заменить на `gap-2`)                                                                     | **P2**                          |
| Паддинг icon-only кнопки в SDUI                 | Ad hoc `sx={{ minWidth: 0, px: 1 }}` (8px по x, без вертикального контроля) — не токенизировано                                                                                                            | 10px со всех сторон (Default)                                                                | `button-node.tsx:128`                                                                                                                          | **P2**                          |
| Disabled-текст Primary                          | Не определён (наследует MUI disabled-стили, обычно серый/полупрозрачный)                                                                                                                                   | Белый `#FFFFFF` текст на сером `#9FA9BA` фоне                                                | `theme.ts` / shared Button (уже верно: `disabled:bg-ui-05 disabled:text-white`)                                                                | **P3**                          |
| Готовая альтернатива уже в кодовой базе         | `src/shared/ui/buttons/button.tsx` реализует все 3 варианта корректно (токены, паддинги, радиус, регистр) и уже используется в ТЧ-тулбарах (`table-toolbar.tsx`, `table-field-toolbar.tsx`, `gap-2`=8px ✓) | —                                                                                            | Рекомендация: `button-node.tsx` перевести на `@/shared/ui/buttons` вместо `@mui/material` Button — закрывает разом почти все P1/P2 пункты выше | **P1** (рекомендация к решению) |
| Заголовок→тулбар гэп несогласован в самой Figma | —                                                                                                                                                                                                          | «Заполнено»: 32px; ПКО список/ПКО оплата: 24px                                               | Не код-баг — уточнить у дизайнера, какое значение канонично                                                                                    | **P3**                          |

## Файлы (абсолютные пути)

- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/app/theme/theme.ts`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/shared/design/tokens.ts`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/tailwind.config.ts`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/shared/ui/buttons/button.tsx`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/shared/ui/buttons/dropdown-button.tsx`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/features/sdui/ui/nodes/action/button-node.tsx`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/features/sdui/ui/nodes/action/button-presentation.ts`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/features/sdui/ui/nodes/layout/toolbar-node.tsx`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/features/sdui/ui/nodes/composite/table-toolbar.tsx`
- `/Users/buterbrot359/Development/MishaWeb/fin-web/src/features/form-renderer/ui/table-field-toolbar.tsx`

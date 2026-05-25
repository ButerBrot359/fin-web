# Sidebar Navigation API — Design Spec

**Дата:** 2026-05-25
**Задача:** Перенести навигацию сайдбара с захардкоженного списка на фронте на API-endpoint бэкенда.

---

## Контекст

Сейчас 10 навигационных элементов сайдбара захардкожены в `src/widgets/sidebar/lib/consts/navigation-items.ts`. Из них 4 активных (Главная, Банк и касса, Зарплата и кадры, Администрирование), остальные 6 — disabled-заглушки нереализованных модулей.

Endpoint `GET /api/settings/modules/{moduleCode}` уже существует и возвращает содержимое конкретного модуля (секции, элементы). Не хватает list-endpoint'а для получения всех доступных модулей.

## Решения

- **Подход:** новый endpoint `GET /api/settings/modules` возвращает список реализованных модулей
- **Нереализованные модули** не возвращаются (нет поля `disabled` — если модуля нет в ответе, он не существует для фронта)
- **"Главная"** остаётся на фронте — это не модуль, а root-страница
- **Иконки** хранятся на фронте в виде SVG-компонентов, маппятся по строковому `iconCode` из ответа бэка
- **Авторизация/права** — пока без них, все модули для всех пользователей
- **Хранение на бэке** — фиксированный список в коде сервиса, в будущем переносится в БД

---

## 1. Backend API

### Endpoint

```
GET /api/settings/modules
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "code": "BankiIKassy",
      "nameRu": "Банк и касса",
      "nameKz": "Банк және касса",
      "iconCode": "bank",
      "sortOrder": 1
    },
    {
      "code": "ZarplatiIKadri",
      "nameRu": "Зарплата и кадры",
      "nameKz": "Жалақы және кадрлар",
      "iconCode": "salary",
      "sortOrder": 2
    },
    {
      "code": "Administrirovanie",
      "nameRu": "Администрирование",
      "nameKz": "Әкімшілік",
      "iconCode": "admin",
      "sortOrder": 3
    }
  ]
}
```

### Поля ответа

| Поле | Тип | Описание |
|---|---|---|
| `code` | `string` | Уникальный код модуля. Используется в роуте `/modules/{code}` и для вызова `GET /api/settings/modules/{code}` |
| `nameRu` | `string` | Название на русском |
| `nameKz` | `string` | Название на казахском |
| `iconCode` | `string` | Строковый ключ иконки. Фронт маппит на SVG-компонент |
| `sortOrder` | `int` | Порядок отображения в сайдбаре |

### Коды иконок

| `iconCode` | Описание |
|---|---|
| `bank` | Банк и касса |
| `warehouse` | Склад |
| `actives` | Основные средства и НМА |
| `tariffs` | Тарификация |
| `salary` | Зарплата и кадры |
| `reports` | Отчёты |
| `our-company` | Наше учреждение |
| `flk` | ФЛК |
| `regulated-fin-report` | Регламентированная отчётность |
| `admin` | Администрирование |

При добавлении нового модуля с новым `iconCode` — фронт должен добавить соответствующий SVG в реестр. Если `iconCode` неизвестен фронту — показывается fallback-иконка.

---

## 2. Backend реализация

### Модель

```java
public class ModuleNavItem {
    private String code;       // "BankiIKassy"
    private String nameRu;     // "Банк и касса"
    private String nameKz;     // "Банк және касса"
    private String iconCode;   // "bank"
    private int sortOrder;     // 1
}
```

### Сервис

```java
@Service
public class ModuleNavigationService {

    private final List<ModuleNavItem> modules = List.of(
        new ModuleNavItem("BankiIKassy", "Банк и касса", "Банк және касса", "bank", 1),
        new ModuleNavItem("ZarplatiIKadri", "Зарплата и кадры", "Жалақы және кадрлар", "salary", 2),
        new ModuleNavItem("Administrirovanie", "Администрирование", "Әкімшілік", "admin", 3)
    );

    public List<ModuleNavItem> getAll() {
        return modules;
    }
}
```

### Контроллер

Добавить метод в существующий контроллер, обслуживающий `/api/settings`:

```java
@GetMapping("/api/settings/modules")
public ApiResponse<List<ModuleNavItem>> getModules() {
    return ApiResponse.success(moduleNavigationService.getAll());
}
```

### Совместимость

`GET /api/settings/modules/{code}` — существующий endpoint, возвращает содержимое модуля. Новый `GET /api/settings/modules` (без path variable) — другой маршрут, конфликта нет.

### Путь миграции в БД (будущее)

Когда понадобится CRUD:
1. Создать entity `ModuleNavItem` с `@Entity` и таблицу `module_nav_items`
2. Создать `ModuleNavItemRepository`
3. В сервисе заменить `List.of(...)` на `repository.findAllByIsActiveTrue(Sort.by("sortOrder"))`
4. Добавить CRUD-эндпоинты

---

## 3. Frontend изменения

### Реестр иконок

В `src/widgets/sidebar/lib/consts/navigation-items.ts`:

```typescript
const ICON_MAP: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  bank: BankIcon,
  warehouse: WarehouseIcon,
  actives: ActivesIcon,
  tariffs: TarifsIcon,
  salary: SalaryIcon,
  reports: ReportIcon,
  'our-company': OurCompanyIcon,
  flk: FlkIcon,
  'regulated-fin-report': RegulatedFinReportIcon,
  admin: RegulatedFinReportIcon,
}
```

### API-вызов

В `src/widgets/sidebar/api/fetch-navigation-items.ts`:

```typescript
export const fetchNavigationItems = async (): Promise<NavigationItem[]> => {
  const response = await apiService.get<ModuleNavItem[]>({
    url: '/api/settings/modules',
  })
  const modules = response.data.data.map((m) => ({
    id: m.code,
    label: i18n.language === 'kz' ? m.nameKz : m.nameRu,
    icon: ICON_MAP[m.iconCode] ?? MainIcon,
    path: `/modules/${m.code}`,
  }))
  return [MAIN_NAV_ITEM, ...modules]
}
```

### Изменения в типе NavigationItem

```typescript
interface NavigationItem {
  id: string
  label: string       // было labelKey (i18n ключ) → теперь реальное название с бэка
  icon: FC<SVGProps<SVGSVGElement>>
  path: string        // было опциональное → теперь всегда есть (disabled убрано)
}
```

### Что удаляется

- Константа `NAVIGATION_ITEMS` из `navigation-items.ts`
- Ключи `sidebar.nav.*` из `common.json` (кроме `sidebar.nav.main` и `sidebar.appName`)
- Поле `disabled` из `NavigationItem`

### Что остаётся на фронте

- `MAIN_NAV_ITEM` — элемент "Главная" (не модуль)
- `ICON_MAP` — маппинг иконок
- SVG-файлы в `src/shared/assets/navigation/`

---

## 4. Локализация

Бэкенд возвращает оба названия (`nameRu`, `nameKz`). Фронт выбирает по текущему языку:

```typescript
const label = i18n.language === 'kz' ? m.nameKz : m.nameRu
```

Консистентно с `getLocalizedName()`, который уже используется по всему проекту.

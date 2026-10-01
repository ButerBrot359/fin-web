# SCRUM-426: Конструктор меню — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Настройка состава и порядка бокового меню и разделов модулей по слоям (глобально / роль / пользователь / личное) с фильтрацией по правам, по образцу конструктора дизайна.

**Architecture:** Бэк (webbuh) хранит патчи `{hidden, order}` по стабильным ключам пунктов в трёх таблицах-слоях и применяет их (плюс фильтр по правам) в точках сборки меню — `ShellComposer`, `ModuleWorkspaceComposer.resolveColumns`, легаси `/api/settings/modules*`. Фронт (fin-web) ничего не мержит: рендерит готовое меню, а для редактирования получает полную структуру отдельным эндпоинтом.

**Tech Stack:** Java 17 + Spring Boot (webbuh-api, пакет `kz.asiaservis.menusettings`), React 19 + TS + TanStack Query (fin-web, `src/features/sdui` + `src/pages/admin/menu-settings`).

**Spec:** `docs/superpowers/specs/2026-09-24-scrum-426-menu-settings-design.md` (fin-web repo)

## Global Constraints

- Репы: бэк `/Users/buterbrot359/Development/MishaWeb/webbuh`, фронт `/Users/buterbrot359/Development/MishaWeb/fin-web`; обе на ветке `feature/SCRUM-426-menu-settings`. Все пути Java-файлов ниже даны относительно `webbuh/webbuh-api/src/`, фронтовые — относительно `fin-web/`.
- Коммиты: формат `feat: SCRUM-426 — <что>` (commit-msg hook требует `feat|fix|add|refactor: `). Пуш и Jira — ТОЛЬКО по явной команде пользователя.
- Фронт: тексты через `useTranslation` + ключи в `src/app/config/i18n/locales/{ru,kz}/common.json`; `<Typography>` из `@mui/material`; кнопки только `@/shared/ui/buttons`; иконки только `@/shared/ui/icons`; цвета только токенами (tailwind-классы `text-ui-05`, `border-divider`, `bg-ui-01`, `border-interactive-01`, `bg-selection` — как в design-constructor-page); файлы ≤300 строк; НЕ запускать `tsc --noEmit`/`npm run lint`/`npm run build` после каждого изменения — только финальная проверка.
- Новые npm/maven зависимости НЕ добавлять (в проекте нет dnd-библиотеки — перестановка кнопками ↑/↓).
- Изоляция SDUI/легаси: новый фронт-код живёт в `src/features/sdui/` и `src/pages/admin/menu-settings/` (SDUI-зона); легаси-файлы не трогаем, кроме нулевых изменений.
- Бэк: имена SDUI-иконок только из `SduiIconNames`; post-genesis-дельты БД — идемпотентные SQL в `webbuh-api/src/main/resources/db/` (constraints НЕ в `@Table` — гейт запрещает, см. комментарий в `ProfileViewSettings`).
- Юнит-тесты бэка: JUnit5 + Mockito + AssertJ (`@ExtendWith(MockitoExtension.class)`), как `viewsettings/service/UserViewSettingsServiceTest`.

## Review Focus

1. Пользователь с двумя профилями, где один скрывает пункт, а второй его не упоминает → пункт ВИДЕН (объединение ролей поверх глобального) — тест в Task 5.
2. Пользователь без единой строки в `role_permissions` (движок прав не досеян) → меню НЕ пустеет (fail-open фильтра прав) — тест в Task 6.
3. Скрытие/перестановка элементов модуля не ломает `commandForItem`: клик по видимой ссылке резолвится в тот же элемент, который построен в дереве — тест в Task 7.
4. Битый/устаревший патч (JSON мусор, ключ переименованной секции) → слой молча игнорируется/лишний ключ не применяется, меню отдаётся — тесты в Task 4 (битый JSON) и Task 5 (устаревший ключ).
5. Обладатель права скрыл модуль «Администрирование» на глобальном уровне → сам он продолжает видеть модуль, секцию и пункт «Настройка меню» (защита от самоотстрела) — тест в Task 7.

---

# Часть А — Бэкенд (webbuh)

### Task 1: Коды секций модулей

Секции (`ModuleItemDto`) получают стабильный `code`: если в JSON-сиде кода нет — детерминированный слаг из `nameRu` (транслитерация, при коллизии внутри модуля — суффикс `-2`, `-3`…). Миграций данных НЕ нужно: код вычисляется на чтении. Контрибьюторы (`Otchety`, `Analitika`) получают коды тем же пост-процессингом, т.к. он делается в `ModuleItemsSettingsService` после опроса контрибьюторов.

**Files:**

- Create: `main/java/kz/asiaservis/settings/service/SectionCodes.java`
- Modify: `main/java/kz/asiaservis/settings/ModuleItemDto.java` (поле `code`)
- Modify: `main/java/kz/asiaservis/settings/service/ModuleItemsSettingsService.java` (пост-процессинг)
- Test: `test/java/kz/asiaservis/settings/service/SectionCodesTest.java`

**Interfaces:**

- Produces: `ModuleItemDto.getCode(): String` (после `getModuleItemsSettings` всегда непустой); `SectionCodes.assign(List<List<ModuleItemDto>> columns): void` — мутирует, проставляя отсутствующие коды; `SectionCodes.slug(String nameRu): String`.

- [ ] **Step 1: Написать падающий тест**

```java
package kz.asiaservis.settings.service;

import kz.asiaservis.settings.ModuleItemDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SectionCodesTest {

    @Test
    @DisplayName("слаг: транслитерация русского названия, без пробелов и спецсимволов")
    void slugTransliterates() {
        assertThat(SectionCodes.slug("Касса")).isEqualTo("kassa");
        assertThat(SectionCodes.slug("Движение денежных средств"))
                .isEqualTo("dvizhenie-denezhnykh-sredstv");
        assertThat(SectionCodes.slug("Форма 4-09 (детали)")).isEqualTo("forma-4-09-detali");
    }

    @Test
    @DisplayName("assign: код из JSON сохраняется, отсутствующий — вычисляется, коллизия — суффикс")
    void assignFillsMissingCodes() {
        ModuleItemDto explicit = ModuleItemDto.builder().nameRu("Банк").code("custom").build();
        ModuleItemDto computed = ModuleItemDto.builder().nameRu("Касса").build();
        ModuleItemDto duplicate = ModuleItemDto.builder().nameRu("Касса").build();
        SectionCodes.assign(List.of(List.of(explicit, computed), List.of(duplicate)));
        assertThat(explicit.getCode()).isEqualTo("custom");
        assertThat(computed.getCode()).isEqualTo("kassa");
        assertThat(duplicate.getCode()).isEqualTo("kassa-2");
    }

    @Test
    @DisplayName("assign: пустое/null имя не роняет — код section-<колонка>-<индекс>")
    void assignToleratesBlankNames() {
        ModuleItemDto blank = ModuleItemDto.builder().nameRu("  ").build();
        SectionCodes.assign(List.of(List.of(blank)));
        assertThat(blank.getCode()).isEqualTo("section-0-0");
    }
}
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd /Users/buterbrot359/Development/MishaWeb/webbuh && ./mvnw -q -pl webbuh-api test -Dtest=SectionCodesTest`
Expected: COMPILATION ERROR (нет `SectionCodes` и поля `code`).

- [ ] **Step 3: Реализация**

В `ModuleItemDto` добавить поле (после `nameKz`):

```java
    @Schema(description = "Стабильный код секции для настроек меню; отсутствует в сиде — вычисляется из nameRu")
    private String code;
```

`SectionCodes.java` — utility-класс (private конструктор), таблица транслитерации ГОСТ-подобная (а→a, б→b, … ж→zh, х→kh, ц→ts, ч→ch, ш→sh, щ→shch, ю→yu, я→ya, ы→y, э→e, ъ/ь→пусто), lower-case, все не-[a-z0-9] → `-`, схлопывание повторных `-`, обрезка по краям. `assign` идёт по колонкам/секциям, держит `Set<String> used` на модуль; blank-слаг → `section-<col>-<idx>`; коллизия → суффикс `-N` (N с 2).

В `ModuleItemsSettingsService.getModuleItemsSettings` перед `return` (оба пути — контрибьютор и JSON):

```java
        ModuleItemsSettingsDto dto = ...; // существующий результат
        SectionCodes.assign(dto.getItems());
        return dto;
```

(`getItems()` возвращает `List<List<ModuleItemDto>>` — см. `ModuleItemsSettingsDto`.)

- [ ] **Step 4: Тест зелёный**

Run: `./mvnw -q -pl webbuh-api test -Dtest=SectionCodesTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/buterbrot359/Development/MishaWeb/webbuh && git add -A && git commit -m "feat: SCRUM-426 — стабильные коды секций модулей (слаг из nameRu)"
```

### Task 2: Таблицы и сущности menusettings + право MENU_SETTINGS

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/domain/DefaultMenuSettings.java`
- Create: `main/java/kz/asiaservis/menusettings/domain/ProfileMenuSettings.java`
- Create: `main/java/kz/asiaservis/menusettings/domain/UserMenuSettings.java`
- Create: `main/java/kz/asiaservis/menusettings/repository/DefaultMenuSettingsRepository.java`
- Create: `main/java/kz/asiaservis/menusettings/repository/ProfileMenuSettingsRepository.java`
- Create: `main/java/kz/asiaservis/menusettings/repository/UserMenuSettingsRepository.java`
- Create: `main/resources/db/migration_2026-12-70_menu_settings_tables.sql` (перед созданием проверить `ls main/resources/db | sort | tail` — номер не должен конфликтовать; занять следующий свободный)
- Modify: `main/java/kz/asiaservis/access/RightKind.java` (+`MENU_SETTINGS`)
- Modify: `main/java/kz/asiaservis/access/RightApplicability.java` (в `GLOBAL_ONLY` EnumSet)

**Interfaces:**

- Produces: сущности с полями по образцу `viewsettings` (`patchJson: String` JSONB); репозитории: `DefaultMenuSettingsRepository.findFirstByOrderByIdAsc(): Optional<DefaultMenuSettings>`, `ProfileMenuSettingsRepository.findAll()`, `findByProfileKey(String): Optional<ProfileMenuSettings>`, `deleteByProfileKey(String)`, `UserMenuSettingsRepository.findByUserEntryId(Long): Optional<UserMenuSettings>`, `deleteByUserEntryId(Long)`. `RightKind.MENU_SETTINGS`.

- [ ] **Step 1: Сущности и репозитории**

Скопировать структуру с `viewsettings/domain/ProfileViewSettings.java` (Lombok `@Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor @Entity`, `@PrePersist/@PreUpdate` для `createdAt/updatedAt`, `patch_json` c `columnDefinition = "jsonb"`, БЕЗ constraints в `@Table`):

- `DefaultMenuSettings` → `@Table(name = "default_menu_settings")`: `id`, `patchJson`, `updatedByEntryId`, `createdAt`, `updatedAt` (без ключа — одна строка).
- `ProfileMenuSettings` → `@Table(name = "profile_menu_settings")`: + `profileKey` (`@Column(name = "profile_key", nullable = false, length = 128)`).
- `UserMenuSettings` → `@Table(name = "user_menu_settings")`: + `userEntryId` (`@Column(name = "user_entry_id", nullable = false)`).

Репозитории — `extends JpaRepository<..., Long>` с методами из Interfaces.

- [ ] **Step 2: Миграция**

По образцу `migration_2026-12-01_design_constructor_tables.sql`:

```sql
-- SCRUM-426 Конструктор меню: слои настроек бокового меню и разделов модулей.
-- В dev таблицы создаёт Hibernate ddl-auto=update; здесь — идемпотентные CREATE
-- для production (ddl-auto=validate).

CREATE TABLE IF NOT EXISTS default_menu_settings (
    id BIGSERIAL PRIMARY KEY,
    patch_json JSONB NOT NULL,
    updated_by_entry_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_menu_settings (
    id BIGSERIAL PRIMARY KEY,
    profile_key VARCHAR(128) NOT NULL,
    patch_json JSONB NOT NULL,
    updated_by_entry_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_profile_menu_settings_profile UNIQUE (profile_key)
);

CREATE TABLE IF NOT EXISTS user_menu_settings (
    id BIGSERIAL PRIMARY KEY,
    user_entry_id BIGINT NOT NULL,
    patch_json JSONB NOT NULL,
    updated_by_entry_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_user_menu_settings_user UNIQUE (user_entry_id)
);
```

- [ ] **Step 3: Право**

`RightKind` — в блок «Глобальные права» добавить:

```java
    @Schema(description = "Настройка меню: правка глобального/ролевых/пользовательских слоёв меню (SCRUM-426)")
    MENU_SETTINGS
```

`RightApplicability.GLOBAL_ONLY` — добавить `RightKind.MENU_SETTINGS` в EnumSet (`RightApplicability.java:102`).

- [ ] **Step 4: Компиляция**

Run: `./mvnw -q -pl webbuh-api compile`
Expected: BUILD SUCCESS. Если существует catch-all тест полноты `RightApplicability` (запустить `./mvnw -q -pl webbuh-api test -Dtest='*RightApplicability*,*RightKind*'`) — починить по его сообщению.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: SCRUM-426 — таблицы слоёв настроек меню и глобальное право MENU_SETTINGS"
```

### Task 3: DTO патча и валидатор

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/MenuPatchEntryDto.java`
- Create: `main/java/kz/asiaservis/menusettings/MenuSettingsDto.java`
- Create: `main/java/kz/asiaservis/menusettings/service/MenuSettingsPatchValidator.java`
- Test: `test/java/kz/asiaservis/menusettings/service/MenuSettingsPatchValidatorTest.java`

**Interfaces:**

- Produces: `MenuPatchEntryDto { Boolean hidden; Integer order; }` (Lombok `@Data @Builder @AllArgsConstructor @NoArgsConstructor`); `MenuSettingsDto { Map<String, MenuPatchEntryDto> patch; }`; `MenuSettingsPatchValidator.validateAndNormalize(MenuSettingsDto body): Map<String, MenuPatchEntryDto>` (static); константа `MenuSettingsPatchValidator.MENU_SETTINGS_ELEMENT_KEY_PREFIX`.
- Ключи патча: `module:<code>` | `section:<moduleCode>/<sectionCode>` | `element:<moduleCode>/<sectionCode>/<elementCode>`.

- [ ] **Step 1: Падающий тест**

```java
package kz.asiaservis.menusettings.service;

import kz.asiaservis.menusettings.MenuPatchEntryDto;
import kz.asiaservis.menusettings.MenuSettingsDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MenuSettingsPatchValidatorTest {

    @Test
    @DisplayName("валидный патч нормализуется как есть")
    void keepsValidEntries() {
        MenuSettingsDto body = new MenuSettingsDto(Map.of(
                "module:Sklad", new MenuPatchEntryDto(true, null),
                "section:BankiIKassy/kassa", new MenuPatchEntryDto(null, 2),
                "element:BankiIKassy/kassa/AvansovyyOtchet", new MenuPatchEntryDto(false, 0)));
        Map<String, MenuPatchEntryDto> out = MenuSettingsPatchValidator.validateAndNormalize(body);
        assertThat(out).hasSize(3);
        assertThat(out.get("module:Sklad").getHidden()).isTrue();
    }

    @Test
    @DisplayName("ключ с неизвестным префиксом отвергается с понятной ошибкой")
    void rejectsUnknownPrefix() {
        MenuSettingsDto body = new MenuSettingsDto(
                Map.of("page:Main", new MenuPatchEntryDto(true, null)));
        assertThatThrownBy(() -> MenuSettingsPatchValidator.validateAndNormalize(body))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("page:Main");
    }

    @Test
    @DisplayName("пустая запись (оба поля null) выбрасывается из патча, а не хранится мусором")
    void dropsEmptyEntries() {
        MenuSettingsDto body = new MenuSettingsDto(
                Map.of("module:Sklad", new MenuPatchEntryDto(null, null)));
        assertThat(MenuSettingsPatchValidator.validateAndNormalize(body)).isEmpty();
    }

    @Test
    @DisplayName("защита от самоотстрела: ключ пункта «Настройка меню» молча игнорируется")
    void stripsMenuSettingsElementKey() {
        Map<String, MenuPatchEntryDto> patch = new HashMap<>();
        patch.put("element:Administrirovanie/bezopasnost/NastroykaMenyu",
                new MenuPatchEntryDto(true, null));
        patch.put("module:Sklad", new MenuPatchEntryDto(true, null));
        Map<String, MenuPatchEntryDto> out =
                MenuSettingsPatchValidator.validateAndNormalize(new MenuSettingsDto(patch));
        assertThat(out).containsOnlyKeys("module:Sklad");
    }

    @Test
    @DisplayName("null-body и null-map → пустой патч")
    void toleratesNulls() {
        assertThat(MenuSettingsPatchValidator.validateAndNormalize(null)).isEmpty();
        assertThat(MenuSettingsPatchValidator.validateAndNormalize(new MenuSettingsDto(null))).isEmpty();
    }
}
```

- [ ] **Step 2: Убедиться, что падает** — `./mvnw -q -pl webbuh-api test -Dtest=MenuSettingsPatchValidatorTest` → COMPILATION ERROR.

- [ ] **Step 3: Реализация**

```java
public final class MenuSettingsPatchValidator {

    /** Код элемента «Настройка меню» — его скрытие запрещено на любом слое (спека §3.5). */
    public static final String MENU_SETTINGS_ELEMENT_CODE = "NastroykaMenyu";

    private static final List<String> KEY_PREFIXES = List.of("module:", "section:", "element:");

    private MenuSettingsPatchValidator() {
    }

    public static Map<String, MenuPatchEntryDto> validateAndNormalize(MenuSettingsDto body) {
        if (body == null || body.getPatch() == null) {
            return Map.of();
        }
        Map<String, MenuPatchEntryDto> out = new LinkedHashMap<>();
        for (Map.Entry<String, MenuPatchEntryDto> e : body.getPatch().entrySet()) {
            String key = e.getKey();
            MenuPatchEntryDto value = e.getValue();
            if (key == null || KEY_PREFIXES.stream().noneMatch(key::startsWith)) {
                throw new IllegalArgumentException("Неизвестный ключ патча меню: " + key);
            }
            if (isMenuSettingsElement(key)) {
                continue; // защита от самоотстрела — молча игнорируем
            }
            if (value == null || (value.getHidden() == null && value.getOrder() == null)) {
                continue;
            }
            out.put(key, value);
        }
        return out;
    }

    /** element:*/.../NastroykaMenyu — пункт входа в настройку меню. */
    public static boolean isMenuSettingsElement(String key) {
        return key.startsWith("element:") && key.endsWith("/" + MENU_SETTINGS_ELEMENT_CODE);
    }
}
```

- [ ] **Step 4: Зелёный** — `./mvnw -q -pl webbuh-api test -Dtest=MenuSettingsPatchValidatorTest` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — DTO и валидатор патча меню"`

### Task 4: CRUD-сервисы слоёв

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/service/DefaultMenuSettingsService.java`
- Create: `main/java/kz/asiaservis/menusettings/service/ProfileMenuSettingsService.java`
- Create: `main/java/kz/asiaservis/menusettings/service/UserMenuSettingsService.java`
- Test: `test/java/kz/asiaservis/menusettings/service/UserMenuSettingsServiceTest.java`

**Interfaces:**

- Produces (каждый сервис, по образцу `viewsettings`, JSON — `ObjectMapper`, тип `TypeReference<Map<String, MenuPatchEntryDto>>`, чтение толерантно к битому JSON → `Map.of()` + warn):
  - `DefaultMenuSettingsService`: `load(): Map<String, MenuPatchEntryDto>`, `put(MenuSettingsDto, Long updatedBy)`, `delete()`.
  - `ProfileMenuSettingsService`: `load(String profileKey): Map<...>`, `put(String profileKey, MenuSettingsDto, Long)`, `delete(String profileKey)`, `loadFor(Set<String> profileKeys): List<Map.Entry<String, Map<String, MenuPatchEntryDto>>>` — отсортировано по profileKey по возрастанию, только непустые; `activeProfiles(): List<ViewSettingsProfileDto>` — скопировать запрос из `ProfileViewSettingsService.activeProfiles` (тот же `DictionaryEntryRepository` + `AccessCodes.PROFILI_GRUPP_DOSTUPA_TYPE`; переиспользуем существующий DTO `kz.asiaservis.viewsettings.ViewSettingsProfileDto`).
  - `UserMenuSettingsService`: `load(Long userEntryId): Map<...>`, `put(Long userEntryId, MenuSettingsDto, Long updatedBy)`, `delete(Long userEntryId)`.
- Consumes: Task 2 репозитории, Task 3 валидатор (`put` всегда через `validateAndNormalize`, полная замена).

- [ ] **Step 1: Падающий тест** (образец — `UserViewSettingsServiceTest`; мокаются репозиторий, реальный `ObjectMapper`):

```java
@ExtendWith(MockitoExtension.class)
class UserMenuSettingsServiceTest {

    @Mock
    private UserMenuSettingsRepository repository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("put: полная замена — сохраняется нормализованный JSON")
    void putReplacesPatch() throws Exception {
        UserMenuSettingsService service = new UserMenuSettingsService(repository, objectMapper);
        when(repository.findByUserEntryId(7L)).thenReturn(Optional.empty());
        service.put(7L, new MenuSettingsDto(Map.of(
                "module:Sklad", new MenuPatchEntryDto(true, null))), 7L);
        ArgumentCaptor<UserMenuSettings> captor = ArgumentCaptor.forClass(UserMenuSettings.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getUserEntryId()).isEqualTo(7L);
        assertThat(captor.getValue().getPatchJson()).contains("module:Sklad");
    }

    @Test
    @DisplayName("load: битый JSON → пустой патч, не исключение")
    void loadToleratesBrokenJson() {
        UserMenuSettingsService service = new UserMenuSettingsService(repository, objectMapper);
        when(repository.findByUserEntryId(7L)).thenReturn(Optional.of(
                UserMenuSettings.builder().userEntryId(7L).patchJson("{oops").build()));
        assertThat(service.load(7L)).isEmpty();
    }

    @Test
    @DisplayName("load: нет записи → пустой патч")
    void loadEmptyWhenAbsent() {
        UserMenuSettingsService service = new UserMenuSettingsService(repository, objectMapper);
        when(repository.findByUserEntryId(7L)).thenReturn(Optional.empty());
        assertThat(service.load(7L)).isEmpty();
    }
}
```

- [ ] **Step 2: Падает** — `./mvnw -q -pl webbuh-api test -Dtest=UserMenuSettingsServiceTest` → COMPILATION ERROR.
- [ ] **Step 3: Реализовать все три сервиса** (`@Service @RequiredArgsConstructor @Slf4j`, `@Transactional` на мутациях, `@Transactional(readOnly = true)` на чтении — зеркально `ProfileViewSettingsService`; `DefaultMenuSettingsService.load` берёт `findFirstByOrderByIdAsc`).
- [ ] **Step 4: Зелёный** — PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — CRUD-сервисы слоёв настроек меню"`

### Task 5: MenuSettingsResolver — эффективный патч пользователя

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/service/MenuSettingsResolver.java`
- Create: `main/java/kz/asiaservis/menusettings/service/EffectiveMenuSettings.java`
- Test: `test/java/kz/asiaservis/menusettings/service/MenuSettingsResolverTest.java`

**Interfaces:**

- Produces: `MenuSettingsResolver.resolveFor(Long userEntryId): EffectiveMenuSettings` (null userEntryId → только глобальный слой); `EffectiveMenuSettings.isHidden(String key): boolean`, `orderOf(String key): Integer` (null — нет переопределения), `static EffectiveMenuSettings empty()`.
- Consumes: Task 4 сервисы, `UserFullRightsResolver.profileKeys(Long)`.
- Семантика (спека §3.3): глобальный слой → слой ролей (видимость: пункт виден, если `visibleInRole_p = patch_p[key].hidden != null ? !hidden : !globalHidden(key)` истинно хотя бы для одного профиля p; профилей нет — глобальное решение; order: последний по алфавиту profileKey, у кого задан, иначе глобальный) → пользовательский слой (переопределяет hidden и order поkrólевски).

- [ ] **Step 1: Падающий тест**

```java
@ExtendWith(MockitoExtension.class)
class MenuSettingsResolverTest {

    @Mock private DefaultMenuSettingsService defaultService;
    @Mock private ProfileMenuSettingsService profileService;
    @Mock private UserMenuSettingsService userService;
    @Mock private UserFullRightsResolver fullRightsResolver;

    private MenuSettingsResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new MenuSettingsResolver(defaultService, profileService, userService, fullRightsResolver);
    }

    private static Map.Entry<String, Map<String, MenuPatchEntryDto>> layer(
            String profileKey, Map<String, MenuPatchEntryDto> patch) {
        return Map.entry(profileKey, patch);
    }

    @Test
    @DisplayName("объединение ролей: один профиль скрывает, второй молчит → виден")
    void roleUnionKeepsVisible() {
        when(defaultService.load()).thenReturn(Map.of());
        when(fullRightsResolver.profileKeys(7L)).thenReturn(Set.of("p1", "p2"));
        when(profileService.loadFor(Set.of("p1", "p2"))).thenReturn(List.of(
                layer("p1", Map.of("module:Sklad", new MenuPatchEntryDto(true, null))),
                layer("p2", Map.of())));
        when(userService.load(7L)).thenReturn(Map.of());
        assertThat(resolver.resolveFor(7L).isHidden("module:Sklad")).isFalse();
    }

    @Test
    @DisplayName("глобально скрыт, одна из ролей явно показывает → виден (hidden:false в роли)")
    void roleCanReveal() {
        when(defaultService.load()).thenReturn(
                Map.of("module:Sklad", new MenuPatchEntryDto(true, null)));
        when(fullRightsResolver.profileKeys(7L)).thenReturn(Set.of("p1"));
        when(profileService.loadFor(Set.of("p1"))).thenReturn(List.of(
                layer("p1", Map.of("module:Sklad", new MenuPatchEntryDto(false, null)))));
        when(userService.load(7L)).thenReturn(Map.of());
        assertThat(resolver.resolveFor(7L).isHidden("module:Sklad")).isFalse();
    }

    @Test
    @DisplayName("глобально скрыт, роли молчат → скрыт; все роли скрывают → скрыт")
    void hiddenWhenAllRolesHideOrInheritHidden() {
        when(defaultService.load()).thenReturn(
                Map.of("module:Sklad", new MenuPatchEntryDto(true, null)));
        when(fullRightsResolver.profileKeys(7L)).thenReturn(Set.of("p1"));
        when(profileService.loadFor(Set.of("p1"))).thenReturn(List.of(layer("p1", Map.of())));
        when(userService.load(7L)).thenReturn(Map.of());
        assertThat(resolver.resolveFor(7L).isHidden("module:Sklad")).isTrue();
    }

    @Test
    @DisplayName("order: побеждает последний профиль по алфавиту, у которого order задан")
    void orderLastProfileWins() {
        when(defaultService.load()).thenReturn(Map.of());
        when(fullRightsResolver.profileKeys(7L)).thenReturn(Set.of("p1", "p2"));
        when(profileService.loadFor(Set.of("p1", "p2"))).thenReturn(List.of(
                layer("p1", Map.of("module:Sklad", new MenuPatchEntryDto(null, 5))),
                layer("p2", Map.of("module:Sklad", new MenuPatchEntryDto(null, 9)))));
        when(userService.load(7L)).thenReturn(Map.of());
        assertThat(resolver.resolveFor(7L).orderOf("module:Sklad")).isEqualTo(9);
    }

    @Test
    @DisplayName("пользовательский слой поверх всего: скрывает видимое и переставляет")
    void userLayerWinsOverall() {
        when(defaultService.load()).thenReturn(Map.of());
        when(fullRightsResolver.profileKeys(7L)).thenReturn(Set.of());
        when(userService.load(7L)).thenReturn(
                Map.of("module:Sklad", new MenuPatchEntryDto(true, 1)));
        EffectiveMenuSettings effective = resolver.resolveFor(7L);
        assertThat(effective.isHidden("module:Sklad")).isTrue();
        assertThat(effective.orderOf("module:Sklad")).isEqualTo(1);
    }

    @Test
    @DisplayName("аноним (null): только глобальный слой, сервисы пользователя не трогаются")
    void anonymousGetsGlobalOnly() {
        when(defaultService.load()).thenReturn(
                Map.of("module:Sklad", new MenuPatchEntryDto(true, null)));
        assertThat(resolver.resolveFor(null).isHidden("module:Sklad")).isTrue();
    }

    @Test
    @DisplayName("устаревший ключ в патче никого не роняет — просто не находит пункт")
    void staleKeysAreHarmless() {
        when(defaultService.load()).thenReturn(
                Map.of("section:BankiIKassy/pereimenovannaya", new MenuPatchEntryDto(true, null)));
        assertThat(resolver.resolveFor(null).isHidden("section:BankiIKassy/kassa")).isFalse();
    }
}
```

- [ ] **Step 2: Падает** — COMPILATION ERROR.
- [ ] **Step 3: Реализация**

```java
@Service
@RequiredArgsConstructor
public class MenuSettingsResolver {

    private final DefaultMenuSettingsService defaultService;
    private final ProfileMenuSettingsService profileService;
    private final UserMenuSettingsService userService;
    private final UserFullRightsResolver fullRightsResolver;

    public EffectiveMenuSettings resolveFor(Long userEntryId) {
        Map<String, MenuPatchEntryDto> global = defaultService.load();
        Map<String, MenuPatchEntryDto> effective = new HashMap<>();
        global.forEach((k, v) -> effective.put(k,
                new MenuPatchEntryDto(v.getHidden(), v.getOrder())));

        if (userEntryId != null) {
            applyProfiles(effective, global, fullRightsResolver.profileKeys(userEntryId));
            applyUser(effective, userService.load(userEntryId));
        }
        return new EffectiveMenuSettings(effective);
    }

    /** Слой ролей: видимость — объединение (виден хотя бы в одной), order — последний по алфавиту. */
    private void applyProfiles(Map<String, MenuPatchEntryDto> effective,
                               Map<String, MenuPatchEntryDto> global,
                               Set<String> profileKeys) {
        List<Map.Entry<String, Map<String, MenuPatchEntryDto>>> layers =
                profileService.loadFor(profileKeys);
        if (layers.isEmpty()) {
            return;
        }
        Set<String> keys = new HashSet<>(effective.keySet());
        layers.forEach(l -> keys.addAll(l.getValue().keySet()));

        for (String key : keys) {
            boolean globallyHidden = hiddenOf(global.get(key));
            boolean visibleSomewhere = false;
            Integer order = orderOf(effective.get(key));
            for (var layer : layers) { // уже отсортированы по profileKey
                MenuPatchEntryDto entry = layer.getValue().get(key);
                Boolean roleHidden = entry != null ? entry.getHidden() : null;
                boolean visibleInRole = roleHidden != null ? !roleHidden : !globallyHidden;
                visibleSomewhere = visibleSomewhere || visibleInRole;
                if (entry != null && entry.getOrder() != null) {
                    order = entry.getOrder();
                }
            }
            upsert(effective, key, !visibleSomewhere, order);
        }
    }

    private void applyUser(Map<String, MenuPatchEntryDto> effective,
                           Map<String, MenuPatchEntryDto> userPatch) {
        userPatch.forEach((key, entry) -> {
            MenuPatchEntryDto current = effective.get(key);
            Boolean hidden = entry.getHidden() != null ? entry.getHidden()
                    : current != null ? current.getHidden() : null;
            Integer order = entry.getOrder() != null ? entry.getOrder()
                    : current != null ? current.getOrder() : null;
            upsert(effective, key, Boolean.TRUE.equals(hidden), order);
        });
    }

    private static void upsert(Map<String, MenuPatchEntryDto> map, String key,
                               boolean hidden, Integer order) {
        if (!hidden && order == null) {
            map.remove(key);
            return;
        }
        map.put(key, new MenuPatchEntryDto(hidden ? Boolean.TRUE : null, order));
    }

    private static boolean hiddenOf(MenuPatchEntryDto e) {
        return e != null && Boolean.TRUE.equals(e.getHidden());
    }

    private static Integer orderOf(MenuPatchEntryDto e) {
        return e != null ? e.getOrder() : null;
    }
}
```

`EffectiveMenuSettings` — immutable-обёртка над map:

```java
public final class EffectiveMenuSettings {
    private final Map<String, MenuPatchEntryDto> entries;

    public EffectiveMenuSettings(Map<String, MenuPatchEntryDto> entries) {
        this.entries = Map.copyOf(entries);
    }

    public static EffectiveMenuSettings empty() {
        return new EffectiveMenuSettings(Map.of());
    }

    public boolean isHidden(String key) {
        MenuPatchEntryDto e = entries.get(key);
        return e != null && Boolean.TRUE.equals(e.getHidden());
    }

    public Integer orderOf(String key) {
        MenuPatchEntryDto e = entries.get(key);
        return e != null ? e.getOrder() : null;
    }
}
```

- [ ] **Step 4: Зелёный** — PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — резолвер эффективного патча меню (глобально→роли→пользователь)"`

### Task 6: Фильтр по правам + canManage

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/service/MenuSettingsAccess.java`
- Create: `main/java/kz/asiaservis/menusettings/service/MenuRightsFilter.java`
- Test: `test/java/kz/asiaservis/menusettings/service/MenuRightsFilterTest.java`

**Interfaces:**

- Produces: `MenuSettingsAccess.canManage(Long userEntryId): boolean` = `userEntryId != null && (fullRightsResolver.hasFullRights(id) || permissionService.hasGlobalRight(id, RightKind.MENU_SETTINGS))`; `MenuRightsFilter.visibleElement(ModuleItemElementDto element, RightsContext ctx): boolean`; `MenuRightsFilter.contextFor(Long userEntryId): RightsContext` (внутренний record: `fullRights`, `canManage`, `Set<PermissionKey> permissions`, резолвится ОДИН раз).
- Правила видимости элемента:
  1. `fullRights` → всё видно.
  2. Элемент с route `/admin/menu-settings` (или `code == NastroykaMenyu`) → виден ⇔ `canManage`.
  3. `permissions` пуст (движок прав не досеян — dark-ship safety) → fail-open, видно всё.
  4. `element.domainKind == null` (отчёты, спец-страницы) → fail-open, видно.
  5. Иначе → видно ⇔ есть `PermissionKey(domain, code, VIEW)` или wildcard `(domain, "*", VIEW)`; маппинг `DomainKind → ObjectDomain` — по имени (`ObjectDomain.valueOf(domainKind.name())`, с try/catch → fail-open).
- Consumes: `PermissionService.resolveEffectivePermissions(Long)`, `PermissionService.PermissionKey` (проверить фактическое имя/пакет класса ключа в `PermissionService.java` и использовать его), `UserFullRightsResolver`.

- [ ] **Step 1: Падающий тест** — покрыть все 5 правил + правило «canManage не видит NastroykaMenyu → false для не-обладателя»:

```java
@ExtendWith(MockitoExtension.class)
class MenuRightsFilterTest {

    @Mock private PermissionService permissionService;
    @Mock private UserFullRightsResolver fullRightsResolver;

    private MenuRightsFilter filter;
    private MenuSettingsAccess access;

    @BeforeEach
    void setUp() {
        access = new MenuSettingsAccess(fullRightsResolver, permissionService);
        filter = new MenuRightsFilter(permissionService, fullRightsResolver, access);
    }

    private static ModuleItemElementDto doc(String code) {
        return ModuleItemElementDto.builder().code(code).type("Document")
                .domainKind(DomainKind.DOCUMENT).build();
    }

    @Test
    @DisplayName("полные права → видно всё, включая пункт настройки меню")
    void fullRightsSeeEverything() {
        when(fullRightsResolver.hasFullRights(7L)).thenReturn(true);
        var ctx = filter.contextFor(7L);
        assertThat(filter.visibleElement(doc("PKO"), ctx)).isTrue();
    }

    @Test
    @DisplayName("пустой набор прав (движок не досеян) → fail-open")
    void emptyPermissionsFailOpen() {
        when(fullRightsResolver.hasFullRights(7L)).thenReturn(false);
        when(permissionService.resolveEffectivePermissions(7L)).thenReturn(Set.of());
        var ctx = filter.contextFor(7L);
        assertThat(filter.visibleElement(doc("PKO"), ctx)).isTrue();
    }

    @Test
    @DisplayName("права есть, VIEW на объект нет → элемент скрыт; wildcard домена → виден")
    void filtersByViewRight() {
        when(fullRightsResolver.hasFullRights(7L)).thenReturn(false);
        when(permissionService.resolveEffectivePermissions(7L)).thenReturn(Set.of(
                new PermissionService.PermissionKey(ObjectDomain.DOCUMENT, "Kassy", RightKind.VIEW)));
        var ctx = filter.contextFor(7L);
        assertThat(filter.visibleElement(doc("PKO"), ctx)).isFalse();
        assertThat(filter.visibleElement(doc("Kassy"), ctx)).isTrue();
    }

    @Test
    @DisplayName("элемент без domainKind (отчёт) не фильтруется")
    void nullDomainKindFailOpen() {
        when(fullRightsResolver.hasFullRights(7L)).thenReturn(false);
        when(permissionService.resolveEffectivePermissions(7L)).thenReturn(Set.of(
                new PermissionService.PermissionKey(ObjectDomain.DOCUMENT, "X", RightKind.VIEW)));
        var ctx = filter.contextFor(7L);
        ModuleItemElementDto report = ModuleItemElementDto.builder()
                .code("Forma409").type("Report").build();
        assertThat(filter.visibleElement(report, ctx)).isTrue();
    }

    @Test
    @DisplayName("пункт «Настройка меню» виден только обладателю права MENU_SETTINGS")
    void menuSettingsEntryGatedByRight() {
        when(fullRightsResolver.hasFullRights(7L)).thenReturn(false);
        when(permissionService.resolveEffectivePermissions(7L)).thenReturn(Set.of(
                new PermissionService.PermissionKey(ObjectDomain.DOCUMENT, "X", RightKind.VIEW)));
        when(permissionService.hasGlobalRight(7L, RightKind.MENU_SETTINGS)).thenReturn(false);
        var ctx = filter.contextFor(7L);
        ModuleItemElementDto entry = ModuleItemElementDto.builder()
                .code("NastroykaMenyu").type("Report").route("/admin/menu-settings").build();
        assertThat(filter.visibleElement(entry, ctx)).isFalse();
    }
}
```

(Если `PermissionKey` — отдельный класс/record с другим конструктором — поправить тест и реализацию по факту, семантика та же.)

- [ ] **Step 2: Падает.** — COMPILATION ERROR.
- [ ] **Step 3: Реализация** — по правилам из Interfaces; `RightsContext` — вложенный record `(boolean fullRights, boolean canManage, Set<PermissionKey> permissions)`; `contextFor` вызывает резолверы по одному разу; `MenuSettingsAccess` — `@Service` из двух зависимостей.
- [ ] **Step 4: Зелёный.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — фильтр меню по правам и признак canManage"`

### Task 7: Применение в точках сборки меню + пункт «Настройка меню» в сиде

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/service/MenuSettingsApplier.java`
- Modify: `main/java/kz/asiaservis/view/composer/ShellComposer.java` (навлинки через applier)
- Modify: `main/java/kz/asiaservis/view/composer/ModuleWorkspaceComposer.java` (`resolveColumns` через applier)
- Modify: `main/java/kz/asiaservis/settings/controller/SettingsController.java` (оба GET через applier)
- Create: `main/resources/db/migration_2026-12-71_menyu_punkt_nastroyka_menyu.sql`
- Test: `test/java/kz/asiaservis/menusettings/service/MenuSettingsApplierTest.java`

**Interfaces:**

- Produces (`MenuSettingsApplier`, `@Service`, зависимости: `MenuSettingsResolver`, `MenuRightsFilter`, `MenuSettingsAccess`, `UserContext`):
  - `applyToModules(List<ModuleNavItemDto> modules): List<ModuleNavItemDto>` — фильтр `module:<code>` + сортировка `(orderOf ?? sortOrder, sortOrder)`; модуль `Administrirovanie` принудительно видим при `canManage`; пустые модули НЕ вычисляются здесь (сайдбар не знает содержимого — осознанное упрощение: скрытие пустых по правам модулей выполняется только если модуль скрыт патчем).
  - `applyToColumns(String moduleCode, List<List<ModuleItemDto>> columns): List<List<ModuleItemDto>>` — right-фильтр элементов → фильтр/сортировка секций по `section:<module>/<code>` → фильтр/сортировка элементов по `element:<module>/<sectionCode>/<code>`; секция без элементов после фильтров удаляется; для `canManage` элемент `NastroykaMenyu`, его секция и модуль не скрываются.
  - Правило сортировки везде: элементы с заданным `order` — по возрастанию первыми, без order — следом в базовом порядке.
  - Текущий пользователь — `userContext.currentUserEntryId().orElse(null)`; резолв и права — один раз на вызов.
- Consumes: Tasks 5–6.

- [ ] **Step 1: Падающий тест** — на чистом `MenuSettingsApplier` с моками резолвера/фильтра:

```java
@ExtendWith(MockitoExtension.class)
class MenuSettingsApplierTest {

    @Mock private MenuSettingsResolver resolver;
    @Mock private MenuRightsFilter rightsFilter;
    @Mock private MenuSettingsAccess access;
    @Mock private UserContext userContext;

    private MenuSettingsApplier applier;

    @BeforeEach
    void setUp() {
        applier = new MenuSettingsApplier(resolver, rightsFilter, access, userContext);
        when(userContext.currentUserEntryId()).thenReturn(Optional.of(7L));
    }

    @Test
    @DisplayName("модули: скрытие патчем + перестановка order; без order — базовый порядок следом")
    void modulesFilteredAndOrdered() {
        var m1 = new ModuleNavItemDto("A", "А", "А", "admin", 1);
        var m2 = new ModuleNavItemDto("B", "Б", "Б", "bank", 2);
        var m3 = new ModuleNavItemDto("C", "В", "В", "bank", 3);
        EffectiveMenuSettings eff = new EffectiveMenuSettings(Map.of(
                "module:B", new MenuPatchEntryDto(true, null),
                "module:C", new MenuPatchEntryDto(null, 0)));
        when(resolver.resolveFor(7L)).thenReturn(eff);
        when(access.canManage(7L)).thenReturn(false);
        List<ModuleNavItemDto> out = applier.applyToModules(List.of(m1, m2, m3));
        assertThat(out).extracting(ModuleNavItemDto::getCode).containsExactly("C", "A");
    }

    @Test
    @DisplayName("колонки: right-фильтр элементов, скрытие секции патчем, пустая секция удаляется")
    void columnsFiltered() {
        ModuleItemElementDto e1 = ModuleItemElementDto.builder().code("E1").type("Document").build();
        ModuleItemElementDto e2 = ModuleItemElementDto.builder().code("E2").type("Document").build();
        ModuleItemDto s1 = ModuleItemDto.builder().nameRu("Секция 1").code("s1")
                .elements(new ArrayList<>(List.of(e1))).build();
        ModuleItemDto s2 = ModuleItemDto.builder().nameRu("Секция 2").code("s2")
                .elements(new ArrayList<>(List.of(e2))).build();
        when(resolver.resolveFor(7L)).thenReturn(new EffectiveMenuSettings(Map.of(
                "section:M/s1", new MenuPatchEntryDto(true, null))));
        when(access.canManage(7L)).thenReturn(false);
        when(rightsFilter.contextFor(7L)).thenReturn(null);
        when(rightsFilter.visibleElement(eq(e2), any())).thenReturn(false);
        List<List<ModuleItemDto>> out =
                applier.applyToColumns("M", List.of(new ArrayList<>(List.of(s1, s2))));
        // s1 скрыта патчем, s2 опустела после right-фильтра → колонка пуста
        assertThat(out.get(0)).isEmpty();
    }

    @Test
    @DisplayName("самоотстрел: canManage видит Администрирование/секцию/пункт настройки даже при hidden")
    void selfLockoutProtection() {
        ModuleItemElementDto entry = ModuleItemElementDto.builder()
                .code("NastroykaMenyu").type("Report").route("/admin/menu-settings").build();
        ModuleItemDto section = ModuleItemDto.builder().nameRu("Безопасность").code("bezopasnost")
                .elements(new ArrayList<>(List.of(entry))).build();
        when(resolver.resolveFor(7L)).thenReturn(new EffectiveMenuSettings(Map.of(
                "section:Administrirovanie/bezopasnost", new MenuPatchEntryDto(true, null))));
        when(access.canManage(7L)).thenReturn(true);
        when(rightsFilter.contextFor(7L)).thenReturn(null);
        when(rightsFilter.visibleElement(any(), any())).thenReturn(true);
        List<List<ModuleItemDto>> out = applier.applyToColumns(
                "Administrirovanie", List.of(new ArrayList<>(List.of(section))));
        assertThat(out.get(0)).extracting(ModuleItemDto::getCode).containsExactly("bezopasnost");
    }
}
```

- [ ] **Step 2: Падает.**
- [ ] **Step 3: Реализовать applier и встроить:**
  - `ShellComposer`: инжект `MenuSettingsApplier`; в `buildNavLinks` вместо `moduleNavigationService.getAll().stream().sorted(...)` — `menuSettingsApplier.applyToModules(moduleNavigationService.getAll())` (сортировку внутри applier; javadoc-абзац «Роли отложены» в шапке класса обновить — фильтрация появилась).
  - `ModuleWorkspaceComposer.resolveColumns` (`ModuleWorkspaceComposer.java:99`): результат обернуть `menuSettingsApplier.applyToColumns(moduleCode, columns)` ПОСЛЕ добавления «Готовых отчётов» — это сохраняет консистентность `compose`/`commandForItem`, оба зовут `resolveColumns`.
  - `SettingsController`: `getModules()` → `applier.applyToModules(...)`; `getSettings()` → построить DTO как раньше и пропустить `items` через `applier.applyToColumns(moduleCode, dto.getItems())`.
- [ ] **Step 4: Зелёные тесты** + существующие тесты композеров: `./mvnw -q -pl webbuh-api test -Dtest='*ShellComposer*,*ModuleWorkspace*,MenuSettingsApplierTest'` (найти фактические имена: `grep -rl "ShellComposer\|ModuleWorkspaceComposer" webbuh-api/src/test --include=*.java`; их моки дополнить новым бином — по умолчанию отдающим вход без изменений).
- [ ] **Step 4a: Тест консистентности commandForItem** — в существующий тест-файл `ModuleWorkspaceComposer` добавить кейс: модуль с одной секцией и элементами [E1(command="cmd1"), E2(command="cmd2")], applier застаблен так, что E1 скрыт (возвращает колонки без E1). Ожидание: в дереве `compose` первый пункт — E2, и `commandForItem(module, "module.M.item.0.0.0", RU)` возвращает `"cmd2"` (обе стороны видят ОДНУ отфильтрованную раскладку — Review Focus №3):

```java
    @Test
    @DisplayName("SCRUM-426: скрытие элемента настройками меню не сдвигает адресацию commandForItem")
    void commandForItemSeesFilteredLayout() {
        // given: applier скрывает первый элемент секции (мок menuSettingsApplier
        // возвращает колонки без него) — собрать по образцу соседних тестов файла
        // expect: compose() отдаёт единственный LINK с command="cmd2"
        //         и commandForItem(moduleCode, "module.<code>.item.0.0.0", Language.RU)
        //         == Optional.of("cmd2")
    }
```

- [ ] **Step 5: Миграция пункта меню** — по образцу `migration_2026-09-08a_menyu_administrirovanie_bezopasnost.sql`: добавить в модуль `Administrirovanie`, раздел «Безопасность» (если раздела нет — предупреждение и выход), элемент:

```json
{
  "code": "NastroykaMenyu",
  "type": "Report",
  "nameRu": "Настройка меню",
  "nameKz": "Мәзірді баптау",
  "route": "/admin/menu-settings",
  "availability": "READY"
}
```

Идемпотентность: пропуск, если элемент с `code == 'NastroykaMenyu'` уже есть в JSON.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — применение настроек меню в сайдбаре, модулях и легаси-API + пункт «Настройка меню»"`

### Task 8: REST — структура и слои

**Files:**

- Create: `main/java/kz/asiaservis/menusettings/MenuStructureDto.java` (+вложенные `MenuStructureModuleDto`, `MenuStructureSectionDto`, `MenuStructureElementDto` — отдельными файлами в том же пакете)
- Create: `main/java/kz/asiaservis/menusettings/MenuSettingsUserDto.java` (`{ String key; String name; }` — key = userEntryId строкой)
- Create: `main/java/kz/asiaservis/menusettings/service/MenuStructureService.java`
- Create: `main/java/kz/asiaservis/menusettings/controller/MenuSettingsController.java`
- Test: `test/java/kz/asiaservis/menusettings/controller/MenuSettingsControllerTest.java`

**Interfaces:**

- REST (все под `@RequestMapping("/api/menu-settings")`, ответы в `ApiDataResponse<>`):
  - `GET /me` → `Map.of("canManage", access.canManage(currentUser))` — аутентифицированному.
  - `GET /structure?scope=my|global|profile|user&profileKey=&userEntryId=` → `MenuStructureDto { List<MenuStructureModuleDto> modules; Map<String, MenuPatchEntryDto> patch; }`; scope=my — любой аутентифицированный (target = current user), остальные — `requireManage()`; scope=user — target = userEntryId. Структура: полный список модулей/секций/элементов (право-фильтр по target-пользователю применён, патчи НЕ применены), у каждого узла `key` (итемки `module:…` и т.д.), `nameRu`, `nameKz`, у модуля `iconCode`, у каждого узла `effectiveHidden` (по resolveFor(target)); `patch` — патч запрошенного слоя.
  - `GET/PUT/DELETE /my` — личный слой текущего пользователя (`UserMenuSettingsService` c current id); PUT: `MenuSettingsDto` → нормализация валидатором; GET возвращает `MenuSettingsDto`.
  - `GET/PUT/DELETE /global`, `GET/PUT/DELETE /profiles/{profileKey}`, `GET/PUT/DELETE /users/{userEntryId}` — `requireManage()`.
  - `GET /profiles` → `ProfileMenuSettingsService.activeProfiles()` — `requireManage()`.
  - `GET /users` → список пользователей `MenuSettingsUserDto` из справочника «Пользователи»: тем же приёмом, что `activeProfiles`, но c type-code пользователей (найти константу: `grep -rn "Polzovateli" main/java/kz/asiaservis/constants/`) — `requireManage()`.
  - `requireUser()`/`requireManage()` — по образцу `ProfileViewSettingsController` (`AccessDeniedException` из `org.springframework.security.access`).
- `MenuStructureService.structureFor(Long targetUserEntryId): List<MenuStructureModuleDto>` — собирает из `ModuleNavigationService.getAll()` + `ModuleItemsSettingsService.getModuleItemsSettings(code)` (try/catch `EntityNotFoundException` → модуль без секций) + `MenuRightsFilter` + `MenuSettingsResolver` (для `effectiveHidden`).
- Consumes: Tasks 4–7.

- [ ] **Step 1: Падающий тест** — юнит на контроллер прямыми вызовами (сверить манеру с существующими: `find webbuh-api/src/test -name "*ControllerTest.java" | head -3`; при расхождении стиль важнее этого скелета):

```java
@ExtendWith(MockitoExtension.class)
class MenuSettingsControllerTest {

    @Mock private MenuStructureService structureService;
    @Mock private DefaultMenuSettingsService defaultService;
    @Mock private ProfileMenuSettingsService profileService;
    @Mock private UserMenuSettingsService userService;
    @Mock private MenuSettingsAccess access;
    @Mock private UserContext userContext;

    private MenuSettingsController controller;

    @BeforeEach
    void setUp() {
        controller = new MenuSettingsController(structureService, defaultService,
                profileService, userService, access, userContext);
    }

    @Test
    @DisplayName("me: аноним → canManage=false; с правом → true")
    void meReflectsRight() {
        when(userContext.currentUserEntryId()).thenReturn(Optional.empty());
        assertThat(controller.me().getData()).containsEntry("canManage", false);
        when(userContext.currentUserEntryId()).thenReturn(Optional.of(7L));
        when(access.canManage(7L)).thenReturn(true);
        assertThat(controller.me().getData()).containsEntry("canManage", true);
    }

    @Test
    @DisplayName("PUT /global без права → AccessDeniedException, сервис не тронут")
    void putGlobalRequiresRight() {
        when(userContext.currentUserEntryId()).thenReturn(Optional.of(7L));
        when(access.canManage(7L)).thenReturn(false);
        assertThatThrownBy(() -> controller.putGlobal(new MenuSettingsDto(Map.of())))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(defaultService);
    }

    @Test
    @DisplayName("PUT /global с правом → полная замена через сервис")
    void putGlobalReplacesLayer() {
        when(userContext.currentUserEntryId()).thenReturn(Optional.of(7L));
        when(access.canManage(7L)).thenReturn(true);
        MenuSettingsDto body = new MenuSettingsDto(
                Map.of("module:Sklad", new MenuPatchEntryDto(true, null)));
        controller.putGlobal(body);
        verify(defaultService).put(body, 7L);
    }

    @Test
    @DisplayName("GET /my отдаёт личный слой текущего пользователя")
    void getMyReturnsOwnLayer() {
        when(userContext.currentUserEntryId()).thenReturn(Optional.of(7L));
        when(userService.load(7L)).thenReturn(
                Map.of("module:Sklad", new MenuPatchEntryDto(true, null)));
        assertThat(controller.getMy().getData().getPatch()).containsKey("module:Sklad");
    }

    @Test
    @DisplayName("structure scope=global без права → AccessDeniedException")
    void structureGlobalRequiresRight() {
        when(userContext.currentUserEntryId()).thenReturn(Optional.of(7L));
        when(access.canManage(7L)).thenReturn(false);
        assertThatThrownBy(() -> controller.structure("global", null, null))
                .isInstanceOf(AccessDeniedException.class);
    }
}
```

- [ ] **Step 2: Падает.**
- [ ] **Step 3: Реализация** контроллера и `MenuStructureService`.
- [ ] **Step 4: Зелёный.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — REST конструктора меню (/api/menu-settings)"`

### Task 9: Полная сборка и прогон тестов бэка

- [ ] **Step 1:** `cd /Users/buterbrot359/Development/MishaWeb/webbuh && ./mvnw -q -pl webbuh-api -am compile`
- [ ] **Step 2:** `./mvnw -q -pl webbuh-api test -Dtest='kz.asiaservis.menusettings.**,*ShellComposer*,*ModuleWorkspace*,*Settings*'` — все зелёные; при падениях чужих тестов — чинить интеграцию, не тесты.
- [ ] **Step 3:** Полный `./mvnw -q -pl webbuh-api test` (долгий — допустимо один раз перед завершением бэка). Expected: BUILD SUCCESS.
- [ ] **Step 4: Commit** (если были правки) — `git add -A && git commit -m "fix: SCRUM-426 — зелёная сборка webbuh-api после интеграции конструктора меню"`

# Часть Б — Фронтенд (fin-web)

### Task 10: API-слой menu-settings

**Files:**

- Create: `src/features/sdui/api/menu-settings-api.ts`
- Modify: `src/features/sdui/index.ts` (экспорт api и типов)

**Interfaces:**

- Produces:

```ts
export interface MenuPatchEntry {
  hidden?: boolean
  order?: number
}
export type MenuSettingsPatch = Record<string, MenuPatchEntry>
export interface MenuStructureElement {
  key: string
  nameRu: string
  nameKz: string | null
  effectiveHidden: boolean
}
export interface MenuStructureSection {
  key: string
  nameRu: string
  nameKz: string | null
  effectiveHidden: boolean
  elements: MenuStructureElement[]
}
export interface MenuStructureModule {
  key: string
  code: string
  nameRu: string
  nameKz: string | null
  iconCode: string | null
  effectiveHidden: boolean
  sections: MenuStructureSection[]
}
export interface MenuStructure {
  modules: MenuStructureModule[]
  patch: MenuSettingsPatch
}
export type MenuScope =
  | { kind: 'my' }
  | { kind: 'global' }
  | { kind: 'profile'; profileKey: string }
  | { kind: 'user'; userKey: string }
export interface MenuSettingsOption {
  key: string
  name: string
}
export const menuSettingsApi = {
  me: (signal?) => Promise<{ canManage: boolean }>,
  structure: (scope: MenuScope, signal?) => Promise<MenuStructure>,
  getPatch: (scope: MenuScope, signal?) => Promise<MenuSettingsPatch>,
  putPatch: (scope: MenuScope, patch: MenuSettingsPatch) => Promise<void>,
  resetPatch: (scope: MenuScope) => Promise<void>,
  profiles: (signal?) => Promise<MenuSettingsOption[]>,
  users: (signal?) => Promise<MenuSettingsOption[]>,
}
```

- Стиль — как `view-settings-api.ts` (`apiService` из `@/shared/api/api`, `ApiResponse`, `unwrap`); маппинг scope→URL: `my`→`/api/menu-settings/my`, `global`→`/global`, `profile`→`/profiles/{profileKey}`, `user`→`/users/{userKey}`; structure — `/api/menu-settings/structure?scope=...&profileKey=...&userEntryId=...`.

- [ ] **Step 1:** Написать файл; экспортировать из `src/features/sdui/index.ts` рядом с `viewSettingsAdminApi`.
- [ ] **Step 2:** Commit — `git add -A && git commit -m "feat: SCRUM-426 — API-слой настроек меню"`

### Task 11: Логика редактора (чистые функции) + тесты

**Files:**

- Create: `src/features/sdui/lib/menu-settings/menu-editor-state.ts`
- Test: `src/features/sdui/lib/menu-settings/menu-editor-state.test.ts`

**Interfaces:**

- Produces:

```ts
export interface MenuDraft {
  hidden: Set<string> // ключи, скрытые В ЭТОМ слое (hidden:true)
  revealed: Set<string> // ключи с явным hidden:false (показать поверх нижних слоёв)
  orderByParent: Map<string, string[]> // parentKey ('' для модулей) -> упорядоченные ключи детей
}
export function seedDraft(structure: MenuStructure): MenuDraft
export function toggleHidden(
  draft: MenuDraft,
  key: string,
  effectiveHiddenBelow: boolean
): MenuDraft
export function moveItem(
  draft: MenuDraft,
  parentKey: string,
  key: string,
  dir: -1 | 1
): MenuDraft
export function buildPatch(
  structure: MenuStructure,
  draft: MenuDraft
): MenuSettingsPatch
```

- Семантика `toggleHidden`: цикл «нет записи → hidden:true → (если ниже слоями скрыт) hidden:false → нет записи»; проще: если сейчас скрыт в драфте → снять (и если `effectiveHiddenBelow` без нашего слоя — поставить revealed), иначе скрыть. `buildPatch`: для каждого родителя — если порядок детей отличается от порядка в structure, писать `order: index` каждому ребёнку этого родителя; `hidden:true` из `hidden`, `hidden:false` из `revealed`; ничего не изменилось → `{}`.

- [ ] **Step 1: Падающий тест** (vitest):

```ts
import { describe, expect, it } from 'vitest'
import {
  buildPatch,
  moveItem,
  seedDraft,
  toggleHidden,
} from './menu-editor-state'
import type { MenuStructure } from '../../api/menu-settings-api'

const structure: MenuStructure = {
  patch: {},
  modules: [
    {
      key: 'module:A',
      code: 'A',
      nameRu: 'А',
      nameKz: null,
      iconCode: null,
      effectiveHidden: false,
      sections: [
        {
          key: 'section:A/s1',
          nameRu: 'С1',
          nameKz: null,
          effectiveHidden: false,
          elements: [
            {
              key: 'element:A/s1/e1',
              nameRu: 'Э1',
              nameKz: null,
              effectiveHidden: false,
            },
            {
              key: 'element:A/s1/e2',
              nameRu: 'Э2',
              nameKz: null,
              effectiveHidden: false,
            },
          ],
        },
      ],
    },
    {
      key: 'module:B',
      code: 'B',
      nameRu: 'Б',
      nameKz: null,
      iconCode: null,
      effectiveHidden: false,
      sections: [],
    },
  ],
}

describe('menu-editor-state', () => {
  it('без изменений buildPatch пуст', () => {
    expect(buildPatch(structure, seedDraft(structure))).toEqual({})
  })

  it('скрытие пишет hidden:true, повторный тумблер убирает запись', () => {
    let draft = toggleHidden(seedDraft(structure), 'module:B', false)
    expect(buildPatch(structure, draft)).toEqual({
      'module:B': { hidden: true },
    })
    draft = toggleHidden(draft, 'module:B', false)
    expect(buildPatch(structure, draft)).toEqual({})
  })

  it('показ пункта, скрытого нижним слоем, пишет hidden:false', () => {
    const draft = toggleHidden(seedDraft(structure), 'module:B', true)
    // B скрыт ниже: первый тумблер = показать
    expect(buildPatch(structure, draft)).toEqual({
      'module:B': { hidden: false },
    })
  })

  it('перестановка пишет order всем детям родителя', () => {
    const draft = moveItem(seedDraft(structure), '', 'module:B', -1)
    expect(buildPatch(structure, draft)).toEqual({
      'module:B': { order: 0 },
      'module:A': { order: 1 },
    })
  })

  it('seedDraft восстанавливает существующий патч слоя (hidden и order)', () => {
    const withPatch: MenuStructure = {
      ...structure,
      patch: { 'module:B': { hidden: true }, 'module:A': { order: 1 } },
    }
    const draft = seedDraft(withPatch)
    expect(buildPatch(withPatch, draft)).toEqual({
      'module:B': { hidden: true },
      'module:A': { order: 1 },
    })
  })
})
```

- [ ] **Step 2:** `npx vitest run src/features/sdui/lib/menu-settings/menu-editor-state.test.ts` → FAIL (модуля нет).
- [ ] **Step 3:** Реализовать функции (иммутабельно: новые Set/Map на каждое изменение). В `seedDraft` порядок детей: ключи с `order` из патча по возрастанию первыми, прочие следом в порядке структуры (то же правило, что на бэке в Task 7). `buildPatch` при неизменном относительном порядке order не пишет, но существующие order из патча сохраняет (см. последний тест).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — состояние редактора меню (draft/patch)"`

### Task 12: UI редактора (диалог, дерево, выбор уровня)

**Files:**

- Create: `src/features/sdui/ui/menu-settings/menu-settings-dialog.tsx` (диалог-оверлей: заголовок, scope-селектор, дерево, кнопки Сохранить/Сбросить слой/Закрыть)
- Create: `src/features/sdui/ui/menu-settings/menu-scope-select.tsx` (уровень: Моё меню / Для всех / Роль+select / Пользователь+select; видим при canManage, иначе фиксирован «Моё меню» — по образцу `customize-form-scope-select.tsx`)
- Create: `src/features/sdui/ui/menu-settings/menu-structure-tree.tsx` (дерево модули→секции→ссылки: имя (ru/kz по i18n.language), глазик-тумблер из `@/shared/ui/icons`, кнопки ↑/↓; скрытые — приглушённо `text-ui-05` + перечёркнутый глазик; `effectiveHidden` нижних слоёв — бейдж «скрыт уровнем ниже»)
- Create: `src/features/sdui/lib/menu-settings/use-menu-settings-editor.ts` (хук: query structure по scope, draft-состояние из Task 11, мутации save/reset через `useMutation`, после успеха — `queryClient.invalidateQueries({ queryKey: ['app-shell'] })`, `invalidateQueries({ queryKey: ['navigation-items'] })`, `notifyViewSettingsChanged()` из `@/shared/lib/design-settings/design-settings-events`, invalidate `['menu-structure']`)
- Modify: `src/features/sdui/index.ts` (экспорт `MenuSettingsDialog`)
- Modify: `src/app/config/i18n/locales/ru/common.json` и `kz/common.json` — ключи `sdui.menuSettings.*`: `title`, `scopeMy`, `scopeGlobal`, `scopeProfile`, `scopeUser`, `save`, `resetLayer`, `close`, `hiddenBelow`, `moveUp`, `moveDown`, `toggleVisibility`, `saved`, `resetConfirm`, `forbidden`, `loading`, `entryButton` («Настроить меню»)

**Interfaces:**

- Consumes: Task 10 api, Task 11 state; `useMutation` (без `useCallback`/`useMemo` — правило проекта).
- Produces: `MenuSettingsDialog: FC<{ open: boolean; onClose: () => void; initialScope?: MenuScope }>`; `useMenuSettingsEditor(scope: MenuScope)`.
- Каждый файл ≤300 строк; данные API в `api/`-слое, никаких fetch в компонентах.

- [ ] **Step 1:** Реализовать хук + три компонента + i18n-ключи (ru и kz; kz — перевести аккуратно, по образцу соседних ключей).
- [ ] **Step 2:** Точечная проверка типов: `npx tsc -b --dry 2>/dev/null || npx vitest run src/features/sdui/lib/menu-settings/` (полный build — в Task 14).
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — редактор меню: диалог, дерево, выбор уровня"`

### Task 13: Админ-страница + роут + кнопка у сайдбара

**Files:**

- Create: `src/pages/admin/menu-settings/ui/menu-settings-page.tsx` (страница: заголовок + `MenuSettingsDialog`-контент инлайн (передать `variant="page"` или отрендерить те же scope-select+tree без Dialog-обёртки; при `me.canManage === false` — заглушка `t('sdui.menuSettings.forbidden')` как в design-constructor-page)
- Create: `src/pages/admin/menu-settings/index.ts` (barrel слайса: `export { MenuSettingsPage } from './ui/menu-settings-page'`)
- Modify: `src/app/routes.tsx` — lazy `MenuSettingsPage` + `<Route path="/admin/menu-settings" element={<MenuSettingsPage />} />` рядом с design-constructor
- Create: `src/features/sdui/ui/menu-settings/menu-settings-entry-button.tsx` — небольшая кнопка «Настроить меню» (иконка-шестерёнка из реестра + текст `t('sdui.menuSettings.entryButton')`), открывает `MenuSettingsDialog` со scope `{ kind: 'my' }`; видна всем
- Modify: `src/features/sdui/ui/shell-sidebar-host.tsx` — обернуть: `<div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1 overflow-y-auto"><NodeRenderer …/></div><MenuSettingsEntryButton /></div>`; фолбэк-ветку не трогать (легаси-сайдбар остаётся как есть)

**Interfaces:**

- Consumes: Task 12 компоненты; `lazyNamed` из `@/shared/lib/utils/lazy-named`.

- [ ] **Step 1:** Реализовать страницу, роут, кнопку.
- [ ] **Step 2:** Commit — `git add -A && git commit -m "feat: SCRUM-426 — страница «Настройка меню», роут и вход из сайдбара"`

### Task 14: Финальная проверка фронта

- [ ] **Step 1:** `cd /Users/buterbrot359/Development/MishaWeb/fin-web && npx vitest run src/features/sdui/lib/menu-settings/` → PASS.
- [ ] **Step 2:** `npm run build` → успех (tsc -b + vite). Чинить всё, что упало.
- [ ] **Step 3:** Если менялся видимый сайдбар (кнопка внизу) — `npm run test:visual`; при осознанных диффах `npm run test:visual:update` в том же коммите.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: SCRUM-426 — зелёная сборка фронта конструктора меню"`

# Часть В — Сквозная проверка

### Task 15: e2e на дев-стенде (после выката бэка) + отчёт

Прогоняется, когда бэк-ветка попадёт на dev-стенд (или локально поднятым бэком). Через браузер (Playwright MCP, `https://dev.qazyna.ai/`):

- [ ] Под админом: открыть «Администрирование» → пункт «Настройка меню» виден; открыть страницу.
- [ ] Глобальный уровень: скрыть модуль «Склад», сохранить → сайдбар обновился без «Склада»; вернуть.
- [ ] Уровень роли: скрыть секцию у роли, проверить под пользователем этой роли (или через structure scope=user превью).
- [ ] Личный уровень: под обычным пользователем кнопка «Настроить меню» у сайдбара → скрыть ссылку, сохранить, проверить страницу модуля; сбросить слой.
- [ ] Защита: попытаться скрыть «Настройка меню» — пункт не скрываем (нет тумблера/сервер игнорирует).
- [ ] Отчёт пользователю: что проверено, скрины; ветки НЕ пушить и Jira НЕ трогать без команды.

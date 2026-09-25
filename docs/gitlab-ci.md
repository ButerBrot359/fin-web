# CI/CD в GitLab (`.gitlab-ci.yml`)

**Что это.** С 22.09.2026 репозиторий живёт на self-hosted GitLab (`https://gitlab.qazyna.ai`,
проект `qazyna/fin-web`, GitLab CE 19.4). `.gitlab-ci.yml` в корне репозитория — замена
`.github/workflows/deploy.yml` + `deploy-demo.yml`. GitHub-workflow'ы **не удалены и не
правились** — GitHub пока живёт параллельно, решение владельца. Прямой аналог для
backend — `webbuh/.gitlab-ci.yml` и `webbuh/docs/project/runbooks/gitlab-ci.md`, структура
и решения повторены 1:1 там, где применимо.

**Раннер.** Тот же shared docker-executor, что у backend — один на оба репозитория:
`concurrent = 2` на весь инстанс, на job ≤ 6 CPU / 8 ГБ, `privileged = false` →
docker-in-docker недоступен. Образы — **kaniko**, не `docker build`.

**Ключевое отличие от backend.** У backend один образ конфигурируется в рантайме (env в
k8s manifest). У fin-web `VITE_*` переменные **запекаются в бандл на этапе `vite build`
внутри Dockerfile** — сменить их на работающем поде нельзя, нужен новый образ. Поэтому prod
и demo собираются **двумя разными job'ами** (`image:prod` / `image:demo`) с разными
build-args — так же, как было устроено в GitHub (`deploy.yml` и `deploy-demo.yml` каждый
собирал образ сам, с разными build-args). У backend же `WEBBUH_*`-тумблеры применяются к
уже собранному образу через ConfigMap.

---

## 1. Схема пайплайна

```
check → test → build → image → deploy
```

| Stage  | Job                             | Когда бежит                                                        | Что делает                                                                                                                                                                                             |
| ------ | ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| check  | `check:lint`                    | **каждый пуш** (любая ветка, MR, теги)                             | `npm run lint` (eslint)                                                                                                                                                                                |
| test   | `test:unit`                     | **каждый пуш**                                                     | `npm run test` (`vitest run`)                                                                                                                                                                          |
| test   | `test:visual`                   | MR в main, push в main — **`when: manual`, `allow_failure: true`** | Playwright-снимки (`tests/visual/`); образ `mcr.microsoft.com/playwright` с предустановленными браузерами — тяжело для shared-раннера concurrent=2, поэтому не в обязательном наборе                   |
| build  | `build:dist`                    | **каждый пуш**                                                     | `npm run build` (`tsc -b && vite build`) → `dist/` артефактом (3 дня); чисто компиляционный гейт, в `image:*` этот `dist/` НЕ передаётся — Dockerfile сам собирает свой `dist` внутри kaniko-контекста |
| image  | `image:prod`                    | push в main (авто)                                                 | kaniko → `$CI_REGISTRY_IMAGE:sha-<sha>` и `:latest`, build-args из scope `prod`                                                                                                                        |
| image  | `image:demo`                    | **`when: manual`** — ветка не назначена                            | kaniko → `$CI_REGISTRY_IMAGE:demo-sha-<sha>` (без `:latest`), build-args из scope `demo`                                                                                                               |
| image  | `image:smoke`                   | MR, только если менялись `Dockerfile`/`.dockerignore`              | kaniko `--no-push` — проверка, что образ вообще собирается                                                                                                                                             |
| deploy | `deploy:prod`                   | push в main, **автоматически** (с 25.09.2026)                      | Секрет `fin-web-secret` + `k8s/*.yaml` (namespace `default`), `rollout restart`                                                                                                                        |
| deploy | `deploy:demo`                   | **`when: manual`** — ветка не назначена                            | Секрет `fin-web-secret` + `k8s/demo/*.yaml` (namespace `demo`)                                                                                                                                         |
| image  | `image:highload`                | **`when: manual`** — ветка не назначена (SCRUM-423)                | kaniko → `$CI_REGISTRY_IMAGE:highload-sha-<sha>` (без `:latest`); build-args со scope-фолбэком на `https://highload-api.qazyna.ai`/`https://highload.qazyna.ai`, если переменные ещё не заведены |
| deploy | `deploy:highload`               | **`when: manual`** — ветка не назначена (SCRUM-423)                | Секрет `fin-web-secret` + `k8s/highload/*.yaml` (namespace `highload`) — фронт нагрузочного контура backend'а, см. `webbuh/docs/project/runbooks/highload-clone-prod-metadata.md` |
| deploy | `deploy:dev`                    | **`when: manual`** — заглушка                                      | `k8s/dev/` ещё не существует, job только печатает инструкцию и падает; своего `image:dev` тоже нет                                                                   |

**Предотвращение дублей пайплайна** (MR + push): та же схема `workflow:rules`, что у backend.

**Как назначить ветку среде demo/dev/highload**, когда владелец решит: у нужного job'а
(`image:demo`/`deploy:demo` и т.п.) заменить `rules: - when: manual` на

```yaml
rules:
  - if: '$CI_COMMIT_BRANCH == "demo"'
```

`image:prod` и `deploy:prod` устроены так (`main → прод`, без `when: manual`) — это и есть образец.

**Автодеплой main (с 25.09.2026).** Первым в пайплайне main стартует `main:guard`
(`interruptible: false`): начавшийся пайплайн main не отменяется следующим мержем, ещё не
начавшиеся схлопываются в самый свежий. `deploy:prod` сериализован (`resource_group: prod`) и
выкатывает только коммит, который всё ещё HEAD main. С 24.09 по 25.09.2026 деплой был ручным:
GitHub `ButerBrot359/fin-web` тоже выкатывает прод на push в main, и 23.09 автодеплой отсюда
перезаписал прод отстающей сборкой. Отключение GitHub-деплоя — решение команды фронта; пока он
включён, прод получает последнюю из выкатившихся сборок.

---

## 2. Переменные CI/CD (Settings → CI/CD → Variables)

**Правило именования (то же решение владельца 22.09.2026, что для backend): без префиксов
`PROD_/DEMO_`.** Одно имя переменной заводится несколько раз с разным **Environment scope**
(`prod`/`demo`), либо один раз со scope `*`, если значение общее.

**Важная особенность для этого файла**: `image:prod` и `image:demo` — НЕ deploy-job'ы, но
им нужно объявление `environment:.name`, иначе GitLab не подставит нужное scope-значение
build-arg'а (`VITE_API_BASE_URL` и т.п.). Из-за этого оба job'а видны на вкладке
Environments/Deployments как деплойные события — побочный эффект, не ошибка.

В GitHub было наоборот — одно имя секрета/переменной на среду (`DEMO_FORM_CONFIGS_URL` рядом
с `DEV_FORM_CONFIGS_URL` захардкоженными прямо в workflow, или `vars.VITE_AUTH_ENABLED` общий
на обе среды). Колонка «Откуда в GitHub» показывает соответствие.

**HIGHLOAD (SCRUM-423) — переменные со scope `highload` пока НЕ заведены.** В отличие от
`image:prod`/`image:demo` (переменная ОБЯЗАНА существовать, пустое значение — сигнал «забыли
завести»), `image:highload` **фолбэчит** на дефолты прямо в `.gitlab-ci.yml`, если переменная
со scope=highload не задана:

| Переменная | Дефолт в `image:highload`, если не задана |
|---|---|
| `VITE_API_BASE_URL` | `https://highload-api.qazyna.ai` |
| `VITE_FORM_CONFIGS_URL` | `https://highload.qazyna.ai` |
| `DOCUMENT_TYPES_API_BASE_URL` | `https://highload-api.qazyna.ai` |
| `VITE_AUTH_ENABLED` | `false` (тот же дефолт, что у prod/demo) |
| `VITE_FACE_FLASH_DISABLED` | `false` (тот же дефолт, что у prod/demo) |

Так `image:highload` можно запустить сразу после пуша, не дожидаясь, пока владелец заведёт
переменные в GitLab. Когда переменные со scope=highload появятся — дефолты просто перестанут
использоваться, без правки файла. `ANTHROPIC_API_KEY` (scope `*`, уже покрывает highload) и
`KUBECONFIG_DATA` (scope `*`) заводить не нужно — общие на все среды.
`deploy:highload` без явного значения `ANTHROPIC_API_KEY` (scope=highload или `*`) **упадёт**
(та же явная проверка, что у `deploy:prod`/`deploy:demo` — секрет обязателен, фолбэка нет).

### 2.1. Обязательные переменные

| Переменная                    | Scope                                                                                        | Type                                           | Masked                  | Protected      | Откуда в GitHub                                                                                                                                          | Обязательна для                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `KUBECONFIG_DATA`             | `*` (один кластер на prod+demo)                                                              | **File** (готовый kubeconfig YAML, без base64) | — (File не маскируется) | ✅             | `secrets.KUBE_CONFIG` (deploy.yml, deploy-demo.yml — было base64; **имя переименовано** в GitLab на `KUBECONFIG_DATA`, единое с backend, значение то же) | deploy:prod, deploy:demo                                               |
| `ANTHROPIC_API_KEY`           | `*` (в GitHub — один `secrets.ANTHROPIC_API_KEY` на обе среды, без `DEMO_`-префикса уже там) | Variable                                       | ✅                      | ✅             | `secrets.ANTHROPIC_API_KEY` (deploy.yml и deploy-demo.yml — тот же секрет)                                                                               | deploy:prod, deploy:demo (уходит рантайм-секретом в под, НЕ build-arg) |
| `VITE_API_BASE_URL`           | `prod` = `https://dev-api.qazyna.ai`, `demo` = `https://demo-api.qazyna.ai`                  | Variable                                       | нет (URL, не тайна)     | по возможности | `env.DEV_API_URL` (deploy.yml, хардкод) / `env.DEMO_API_URL` (deploy-demo.yml, хардкод)                                                                  | image:prod, image:demo (build-arg, запекается в бандл)                 |
| `VITE_FORM_CONFIGS_URL`       | `prod` = `https://dev.qazyna.ai`, `demo` = `https://demo.qazyna.ai`                          | Variable                                       | нет                     | по возможности | `env.DEV_FORM_CONFIGS_URL` / `env.DEMO_FORM_CONFIGS_URL` (хардкод в workflow'ах)                                                                         | image:prod, image:demo (build-arg)                                     |
| `DOCUMENT_TYPES_API_BASE_URL` | `prod` = `https://dev-api.qazyna.ai`, `demo` = `https://demo-api.qazyna.ai`                  | Variable                                       | нет                     | по возможности | `env.DEV_API_URL` / `env.DEMO_API_URL` (тот же URL, отдельный build-arg для `form-configs-server`)                                                       | image:prod, image:demo (build-arg)                                     |

### 2.2. Опциональные (feature-тумблеры, есть дефолт в CI-скрипте)

| Переменная                 | Scope                                                                        | Type     | Masked | Откуда в GitHub                                     | Обязательна для                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------- | -------- | ------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `VITE_AUTH_ENABLED`        | `*` (пока одно значение на все среды; можно развести по `prod`/`demo` позже) | Variable | нет    | `vars.VITE_AUTH_ENABLED` (repo variable, не secret) | image:prod, image:demo (build-arg, дефолт `false` в скрипте job'а — `${VITE_AUTH_ENABLED:-false}`) |
| `VITE_FACE_FLASH_DISABLED` | `*`                                                                          | Variable | нет    | `vars.VITE_FACE_FLASH_DISABLED`                     | image:prod, image:demo (build-arg, дефолт `false`)                                                 |

### 2.3. Ничего заводить не нужно (встроено в GitLab)

`CI_REGISTRY`, `CI_REGISTRY_IMAGE`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD` — встроенный
GitLab Container Registry (`registry.qazyna.ai/qazyna/fin-web`), доступен job'ам автоматически
(замена `secrets.GITHUB_TOKEN` + `ghcr.io` из GitHub workflow'ов).

### 2.4. Тестовые стадии (check/test/build) — переменных не требуют

Ни одна переменная выше не нужна для `check:lint`/`test:unit`/`build:dist` — они не ходят ни
в кластер, ни во внешние сервисы, и не собирают финальный образ (сборка в стадии `build` —
чисто компиляционная проверка, реальные `VITE_*` в неё не подставляются). `test:visual`
(manual) тоже не требует переменных — поднимает свой `vite preview` локально в job'е.

---

## 3. Что не перенесено

У fin-web в GitHub не было ops-`workflow_dispatch`-сценариев (в отличие от backend, где
`demo-db-user.yml`, `runtime-config.yml` и т.п. остались за скобками переноса) — переносить
нечего.

---

## 4. Известные допущения и расхождения (проверить на первом реальном прогоне)

- **`VITE_FORM_CONFIGS_URL` для demo**: `docs/DEMO_DEPLOY.md` (существующая документация
  репозитория) указывает значение `https://demo.qazyna.ai/api`, а действующий
  `.github/workflows/deploy-demo.yml` — `https://demo.qazyna.ai` (без `/api`). За основу
  взят **действующий workflow** (источник истины — то, что реально исполняется), значение
  `/api` в `DEMO_DEPLOY.md`, похоже, устарело. Если это не так — поправить
  `VITE_FORM_CONFIGS_URL` (scope `demo`) при заведении переменной.
- **`image:prod`/`image:demo` с `environment:`, но без деплоя** — см. §2 выше: сознательное
  решение ради scope-переменных без префиксов; если это неприемлемо для отчётности
  Environments — альтернатива № обсуждена, но не выбрана: завести отдельные пары переменных
  `VITE_API_BASE_URL_PROD`/`VITE_API_BASE_URL_DEMO` без `environment:` на build-job'ах
  (тогда нарушится правило «без префиксов»).
- **`KUBECONFIG_DATA` дублируется в двух проектах** (`qazyna/webbuh` и `qazyna/fin-web`) —
  оба проекта в одной GitLab-группе `webbuh`, поэтому переменную можно завести **один раз на
  уровне группы** (Group `webbuh` → Settings → CI/CD → Variables) вместо дублирования в двух
  проектах. Не сделано в рамках этой задачи — решение владельца/платформенной команды.
- **`basic-auth` secret в namespace `demo`**: `docs/DEMO_DEPLOY.md` описывает ручное
  создание secret'а `basic-auth` и упоминает его в `k8s/demo/ingress.yaml` — в текущем
  `k8s/demo/ingress.yaml` таких аннотаций уже нет, действующий `deploy-demo.yml` тоже не
  проверяет этот secret. Похоже, basic-auth на demo отключили раньше и `DEMO_DEPLOY.md` не
  обновили — `.gitlab-ci.yml` его тоже не трогает.
- **`image:smoke`** не подставляет build-args вовсе (только проверяет собираемость
  Dockerfile) — как и smoke-job у backend.
- Образ `node:20-alpine` для `check`/`test`/`build` — версия взята из `FROM node:20-alpine`
  в `Dockerfile` (в репозитории нет `.nvmrc` и `engines` в `package.json`). Если Dockerfile
  обновят на другую мажорную версию Node — обновить и здесь вручную, синхронизации нет.
- `test:visual` (Playwright) требует реальный прогон на раннере, чтобы понять, укладывается
  ли `webServer` (`npm run build && vite preview`) в лимит 6 CPU / 8 ГБ вместе с браузером —
  не проверялось живьём.

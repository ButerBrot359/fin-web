# DEMO-фронт (demo.qazyna.ai)

Изолированная копия `fin-web` в namespace `demo` на том же сервере, что и dev.

| Параметр   | DEV (main)             | DEMO                     |
| ---------- | ---------------------- | ------------------------ |
| Namespace  | `default`              | `demo`                   |
| Frontend   | `dev.qazyna.ai`        | `demo.qazyna.ai`         |
| Бэкенд API | `dev-api.qazyna.ai`    | `demo-api.qazyna.ai`     |
| Деплой     | автомат на push в main | вручную, любой коммит    |
| Image tag  | `:latest` / `sha-...`  | `:demo-sha-<полный-SHA>` |

## Ключевая особенность

`VITE_API_BASE_URL` и прочие `VITE_*` переменные **вшиваются в bundle на этапе
`docker build`** (см. `Dockerfile`). Поэтому для demo собирается **отдельный
образ** с build-args:

```
VITE_API_BASE_URL          = https://demo-api.qazyna.ai
VITE_FORM_CONFIGS_URL      = https://demo.qazyna.ai/api
DOCUMENT_TYPES_API_BASE_URL= https://demo-api.qazyna.ai
ANTHROPIC_API_KEY          = (из GitHub Secret)
```

## Файлы

```
k8s/demo/
  namespace.yaml
  deployment.yaml    # ${IMAGE_NAME} подставляется workflow'ом
  service.yaml
  ingress.yaml       # demo.qazyna.ai + Let's Encrypt + basic-auth
.github/workflows/deploy-demo.yml
```

## Подготовка (один раз)

DNS A-запись `demo.qazyna.ai` → IP сервера.

GitHub Secrets/Variables (Settings → Secrets and variables → Actions):

- `KUBE_CONFIG` — уже есть, переиспользуется.
- `ANTHROPIC_API_KEY` — уже есть, переиспользуется.

Secret `basic-auth` создаётся **вручную на сервере** в namespace `demo`
(так же, как на dev):

```bash
htpasswd -cb auth user <PASSWORD>
kubectl -n demo create secret generic basic-auth --from-file=auth
rm auth
```

Workflow только проверяет, что секрет существует, и падает с подсказкой,
если его нет. Если basic-auth не нужен — удали 3 строки `auth-*` из
`k8s/demo/ingress.yaml` и шаг **Verify basic-auth secret exists** в workflow.

## Запуск

### UI

Actions → **Deploy DEMO (any commit)** → **Run workflow** → ввести `ref`
(ветка/тег/SHA) → Run.

### CLI

```bash
gh workflow run "Deploy DEMO (any commit)" -f ref=abc1234
gh run watch
```

## Что делает workflow

1. Checkout указанного `ref`.
2. Build Docker-образа с **demo build-args** (URL backend'а зашит в bundle).
3. Push в GHCR с тегом `demo-sha-<полный-SHA>`.
4. Apply namespace, обновляет k8s-Secret'ы (`fin-web-secret`, `basic-auth`),
   apply service+ingress.
5. `envsubst` → `deployment.yaml`, apply, `rollout restart`, `rollout status`.
6. В аннотацию `fin-web.io/deployed-commit` пишется тег — видно, что задеплоено:
   ```bash
   kubectl -n demo get deploy fin-web \
     -o jsonpath='{.metadata.annotations.fin-web\.io/deployed-commit}'
   ```

## Диагностика

```bash
kubectl -n demo get pods,svc,ingress
kubectl -n demo logs -l app=fin-web --tail=200 -f
kubectl -n demo describe pod -l app=fin-web
kubectl -n demo get certificate    # TLS от Let's Encrypt
```

## Полный сброс

```bash
kubectl delete namespace demo
# затем заново прогнать workflow Deploy DEMO
```

## Связь с backend'ом

Demo-фронт жёстко стучится в `demo-api.qazyna.ai`, который разворачивается
отдельным workflow'ом в репо `webbuh` (см. `docs/DEMO_DEPLOY.md` там).
Деплои фронта и бэка независимы — можно крутить разные коммиты, главное чтобы
API-контракт совпадал.

//

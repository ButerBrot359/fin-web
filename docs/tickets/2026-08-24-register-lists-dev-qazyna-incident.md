# Инцидент: исчезли списки регистров на dev.qazyna.ai

Дата расследования: 2026-08-24.

## Симптом

Пользовательский URL
`/modules/Administrirovanie/informationregister/ParametryUchetaVNA?domain=INFORMATION_REGISTER`
на `https://dev.qazyna.ai` показывает «Страница не найдена». Аналогично риску подвержены списки регистров накопления и бухгалтерии.

Это не означает удаления регистра «ПараметрыУчетаВНА» или его записей: страница останавливается во frontend-маршрутизации до загрузки метаданных и записей через API.

## Установленная причина

1. В frontend-коммите [`0ee0842`](https://github.com/ButerBrot359/fin-web/commit/0ee0842f822078e556d9c4c72c6ecae752fc3b8c) от 2026-08-12 автор `buterbrot359` удалил явные list-маршруты, включая:
   - `/modules/:pageCode/informationregister/:moduleCode`;
   - `/modules/:pageCode/accumulationregister/:moduleCode`;
   - `/modules/:pageCode/accountingregister/:moduleCode`.
2. После удаления URL передаётся в SDUI catch-all. Контракт предусматривал: backend отвечает `422 SCREEN_NOT_SDUI` c `kind`, а frontend возвращается на legacy-страницу.
3. На dev.qazyna.ai отображается именно экран NotFound. В frontend он выставляется только для backend-ответа `404 ROUTE_UNKNOWN`; следовательно, фактически развёрнутый API не отдаёт ожидаемый fallback-контракт для этого маршрута.

Таким образом, непосредственная строка регресса — frontend-change автора `buterbrot359`; первопричина инцидента — несогласованный релиз frontend и backend SDUI-route contract. Метаданные ВНА и данные регистров не являются доказанной причиной.

## Связанный backend-контекст

В `webbuh` поддержка SDUI-списков регистров была добавлена позднее в коммите [`ddcef222`](https://github.com/nmuldashev/webbuh/commit/ddcef222d0c51e692fff14b6642f9afdf3a8c01d) от 2026-08-18, автор Alisher Abdraimov. Он вводит `REGISTER_LIST` и обработку маршрута регистра в `ScreenRouteResolver`.

Нужно отдельно сверить SHA реально работающего `webbuh-api` pod с этим commit: текущий production-симптом показывает, что совместимый контракт API в доступной среде не работает.

## Что требуется проверить владельцам

1. Сверить SHA работающего `webbuh-api` pod с commit `ddcef222` или более новым образом, содержащим этот change.
2. Вызвать `POST /api/view` для исходного URL и сохранить статус и тело ответа. Ожидается SDUI-дерево либо `422 SCREEN_NOT_SDUI`; `404 ROUTE_UNKNOWN` подтверждает backend/release defect.
3. Проверить, должен ли данный список по текущему продуктового решению открываться через SDUI или legacy-страницу. Если требуется legacy-путь, frontend-изменение должно быть оформлено отдельной задачей и синхронизировано с владельцем `fin-web`.

## Статус

Этот документ содержит только результаты read-only расследования. Код, конфигурация, данные, Kubernetes-развёртывания и Jira не изменялись.

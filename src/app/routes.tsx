import { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { MainPage } from '@/pages/main'

import { lazyNamed } from '@/shared/lib/utils/lazy-named'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { ErrorBoundary } from '@/shared/ui/error-boundary/error-boundary'

// Реестр ленивых страниц: каждая уезжает в свой чанк, главный чанк их не тянет.
const ModulePage = lazyNamed(() => import('@/pages/module'), 'ModulePage')
const InformationRegisterRedirect = lazyNamed(
  () => import('@/pages/information-register/information-register-redirect'),
  'InformationRegisterRedirect'
)
const AccountPlanEntryPage = lazyNamed(
  () => import('@/pages/account-plan/account-plan-entry'),
  'AccountPlanEntryPage'
)
const AccountCardPage = lazyNamed(
  () => import('@/pages/account-card'),
  'AccountCardPage'
)
const UniversalDomainEntryPage = lazyNamed(
  () => import('@/pages/universal-domain/universal-domain-entry'),
  'UniversalDomainEntryPage'
)
const TreasuryExportPage = lazyNamed(
  () => import('@/features/treasury-export'),
  'TreasuryExportPage'
)
const SwiftExportPage = lazyNamed(
  () => import('@/features/swift-export'),
  'SwiftExportPage'
)
const AuditLogPage = lazyNamed(
  () => import('@/pages/audit-log'),
  'AuditLogPage'
)
const DesignConstructorPage = lazyNamed(
  () => import('@/pages/admin/design-constructor'),
  'DesignConstructorPage'
)
const InactivityLocksPage = lazyNamed(
  () => import('@/pages/inactivity-locks'),
  'InactivityLocksPage'
)
const SduiCatchAllPage = lazyNamed(
  () => import('@/pages/sdui-catch-all'),
  'SduiCatchAllPage'
)
const AnalyticsRouterPage = lazyNamed(
  () => import('@/pages/analytics/analytics-router'),
  'AnalyticsRouterPage'
)
const AiAssistantHistoryPage = lazyNamed(
  () => import('@/pages/ai-assistant-history'),
  'AiAssistantHistoryPage'
)
const FaceIdUserPage = lazyNamed(
  () => import('@/pages/face-id-management'),
  'FaceIdUserPage'
)
const FaceIdSettingsPage = lazyNamed(
  () => import('@/pages/face-id-management'),
  'FaceIdSettingsPage'
)
const FaceIdSelfPage = lazyNamed(
  () => import('@/pages/face-id-management'),
  'FaceIdSelfPage'
)

export const AppRoutes = () => {
  const location = useLocation()

  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          {/*
            Снятие блокировок по бездействию (ТЗ §А4). Обычная страница под Layout, а не экран
            входа: её открывает уже вошедший администратор, чтобы вернуть доступ другому.
          */}
          <Route
            path="/admin/inactivity-locks"
            element={<InactivityLocksPage />}
          />
          {/* Журнал регистрации действий (приказ МФ РК № 254, п. 27) — только чтение. */}
          <Route path="/admin/audit" element={<AuditLogPage />} />
          <Route
            path="/admin/users/:userEntryId/face-id"
            element={<FaceIdUserPage />}
          />
          <Route
            path="/admin/face-id-settings"
            element={<FaceIdSettingsPage />}
          />
          <Route path="/profile/face-id" element={<FaceIdSelfPage />} />
          {/* Админка конструктора дизайна: стандарты форм для всех и по ролям. */}
          <Route
            path="/admin/design-constructor"
            element={<DesignConstructorPage />}
          />
          {/* Конструктор меню (SCRUM-426) живёт вкладкой в конструкторе дизайна;
              старый адрес (и пункт меню «Настройка меню» из сида бэка) ведёт туда. */}
          <Route
            path="/admin/menu-settings"
            element={
              <Navigate to="/admin/design-constructor?tab=menu" replace />
            }
          />
          {/*
            Выгрузка документов в казначейство (SCRUM-265): SDUI-эффект
            navigate ведёт сюда с ?typeCode&id — легаси-страница вне SDUI.
          */}
          <Route path="/treasury-export" element={<TreasuryExportPage />} />
          <Route path="/swift-export" element={<SwiftExportPage />} />
          <Route path="/modules/:pageCode" element={<ModulePage />} />
          {/*
            SCRUM-45: плоские ссылки с бэка /information-registers/:typeCode…
            (navigate из list.rowOpen, list.create, «Записать и закрыть»).
            Порядок важен: /new раньше /:entryId.
          */}
          <Route
            path="/information-registers/:typeCode"
            element={<InformationRegisterRedirect mode="list" />}
          />
          <Route
            path="/information-registers/:typeCode/new"
            element={<InformationRegisterRedirect mode="new" />}
          />
          <Route
            path="/information-registers/:typeCode/:entryId"
            element={<InformationRegisterRedirect mode="entry" />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode/new"
            element={<AccountPlanEntryPage />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode/:entryId"
            element={<AccountPlanEntryPage />}
          />
          {/* Карточка счёта — drill-down из ОСВ (двойной клик по строке). */}
          <Route
            path="/modules/:pageCode/account-card"
            element={<AccountCardPage />}
          />
          {/* SCRUM-388: SDUI-карточка записи универсального домена (ПВР).
              Список остаётся на catch-all (422 → легаси UniversalDomainPage). */}
          <Route
            path="/modules/:pageCode/calculationplan/:moduleCode/:entryId"
            element={<UniversalDomainEntryPage />}
          />
          {/*
            Аналитика: пункт меню type="Analytics" → сегмент "analytics".
            Маршрут один на весь раздел — дашборды и отчёты заводит пользователь
            в рантайме, их коды заранее неизвестны. Что рендерить (ассистент,
            настройки, дашборд или отчёт), решает диспетчер по `:code`.
            Идёт до catch-all: тот подхватывает всё неизвестное и увёл бы раздел
            в SDUI-экран.
          */}
          <Route
            path="/modules/:pageCode/ai-history"
            element={<AiAssistantHistoryPage />}
          />
          <Route
            path="/modules/:pageCode/analytics/:code"
            element={<AnalyticsRouterPage />}
          />
          <Route path="/analytics/:code" element={<AnalyticsRouterPage />} />
          <Route path="*" element={<SduiCatchAllPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

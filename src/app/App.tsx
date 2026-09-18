import { Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { LoginPage } from '@/pages/login'
import { ChangePasswordPage } from '@/pages/change-password'
import { FaceIdCallbackPage } from '@/pages/face-id-callback'

import { TopBar } from '@/widgets/top-bar'
import { Sidebar } from '@/widgets/sidebar'
import { WorkspaceTabSync } from '@/widgets/workspace-tab-bar'

import { AuthGuard, CHANGE_PASSWORD_ROUTE, LOGIN_ROUTE } from '@/features/auth'
import { useApplyInterfaceScale } from '@/features/interface-scale'
import { ShellSidebarHost } from '@/features/sdui'

import { connectToastHistory } from '@/entities/notification-history'
import { ServerThemeApplier } from '@/entities/theme'
import { lazyNamed } from '@/shared/lib/utils/lazy-named'
import { Toaster } from '@/shared/ui/toast/toast'

import { Layout } from './layout/layout'
import { AppRoutes } from './routes'
import { useWorkspaceTabGatewayBinding } from './providers/workspace-tab-binding'
import { useSduiGateways } from './providers/use-sdui-gateways'

// Дровер легаси-справочников: всегда смонтирован, но тянет form-renderer и
// компанию — лениво, чтобы не грузить их в главном чанке. Чанк докачивается
// сразу после старта приложения, вне критического пути.
const DictSidebarDrawer = lazyNamed(
  () => import('@/features/dict-sidebar'),
  'DictSidebarDrawer'
)

function App() {
  useWorkspaceTabGatewayBinding()
  useSduiGateways()
  useApplyInterfaceScale()

  // SCRUM-317 канал №8: центр оповещений копит всё показанное всплывашками
  useEffect(() => connectToastHistory(), [])

  return (
    <BrowserRouter>
      <WorkspaceTabSync />
      <Routes>
        {/*
          Экран входа рендерится ВНЕ Layout: боковое меню и верхняя панель на нём
          не нужны и наполняются данными, которых у невошедшего пользователя нет.
          Остальное приложение живёт под splat-маршрутом — вложенный <Routes> в
          AppRoutes матчится относительно «/», то есть дерево маршрутов не меняется.
        */}
        <Route path={LOGIN_ROUTE} element={<LoginPage />} />
        <Route path="/auth/face-id/callback" element={<FaceIdCallbackPage />} />
        {/*
          Смена пароля — тоже вне Layout и вне AuthGuard: сюда приводит требование сменить
          пароль, при котором сервер отвечает 403 на всё остальное, включая данные меню и
          верхней панели. Гвард здесь и не нужен — своё «не вошёл» страница проверяет сама.
        */}
        <Route path={CHANGE_PASSWORD_ROUTE} element={<ChangePasswordPage />} />
        <Route
          path="*"
          element={
            <AuthGuard>
              <ServerThemeApplier />
              <Layout
                sidebar={<ShellSidebarHost fallback={<Sidebar />} />}
                header={<TopBar />}
              >
                <AppRoutes />
              </Layout>
              <Suspense fallback={null}>
                <DictSidebarDrawer />
              </Suspense>
            </AuthGuard>
          }
        />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App

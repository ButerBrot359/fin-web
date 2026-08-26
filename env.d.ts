/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_FORM_CONFIGS_URL: string
  /**
   * Требовать вход для защищённых маршрутов. Строка 'true' включает; всё остальное,
   * включая отсутствие переменной, — выключено. Поднимать только вместе с серверным
   * webbuh.auth.enabled: см. features/auth/lib/consts/auth-config.ts.
   */
  readonly VITE_AUTH_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

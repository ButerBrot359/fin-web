/**
 * Звено сетевой цепочки запроса (SCRUM-371, контракт журнала регистрации).
 *
 * Роль — место адреса в пути «компьютер → роутер → сервер»:
 * `LOCAL` — компьютер пользователя в локальной сети (со слов браузера), `PROXY` — промежуточный
 * прокси, `PUBLIC` — внешний адрес (роутер/NAT), `EDGE` — шлюз прямо перед сервером.
 * Источник — откуда сервер взял адрес: `CLIENT` (заголовок браузера) или сетевые заголовки
 * и адрес соединения. Значения приходят с сервера и могут пополниться — поэтому `string`.
 */
export interface NetworkHop {
  ip: string
  role: string
  source?: string | null
}

/**
 * Поля записи журнала, из которых строится цепочка. Всё необязательно: бэкенд отдаёт их не
 * сразу, а у старых записей их нет вовсе — тогда остаётся хотя бы `clientAddress`.
 */
export interface NetworkChainSource {
  networkChain?: NetworkHop[] | null
  clientLocalIp?: string | null
  clientPublicIp?: string | null
  clientAddress?: string | null
}

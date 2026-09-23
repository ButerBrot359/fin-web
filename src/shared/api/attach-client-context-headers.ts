import type { AxiosInstance } from 'axios'

import { getClientContextHeaders } from '@/shared/lib/client-context'

/**
 * Навешивает на инстанс axios заголовки рабочего места для журнала регистрации (SCRUM-371):
 * `X-Client-Device-Id`, `X-Client-Local-Ip`, `X-Client-Device-Name`.
 *
 * Подключается к КАЖДОМУ инстансу, который ходит в webbuh, — в том числе к «голым» инстансам
 * входа (`auth-endpoints`, вход по лицу): событие входа — главное событие журнала, и без этих
 * заголовков у него не было бы ни компьютера, ни локального адреса.
 *
 * <b>`shared/api/form-configs-api.ts` сюда НЕ подключать</b> — по той же причине, что и
 * Bearer-токен: это другой хост (form-configs-server), а метка рабочего места и адреса локальной
 * сети — данные для журнала webbuh, не для чужих логов.
 *
 * Значения читаются на каждом запросе, а не один раз при создании инстанса: локальные адреса
 * появляются через ~1,5 с после старта, имя компьютера пользователь может задать в любой момент.
 */
export const attachClientContextHeaders = (instance: AxiosInstance): void => {
  instance.interceptors.request.use((config) => {
    for (const [name, value] of Object.entries(getClientContextHeaders())) {
      config.headers.set(name, value)
    }
    return config
  })
}

import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { mapVerifyError } from './face-auth-endpoints'

const httpError = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('request failed', 'ERR_BAD_RESPONSE')
  error.response = {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('mapVerifyError', () => {
  it('401 не несёт причины отказа', () => {
    // Сервер намеренно не различает в ответе живость и несовпадение личности — иначе подбор
    // получал бы обратную связь. Показать здесь причину значит выдумать её за сервер.
    expect(mapVerifyError(httpError(401, { reason: 'NO_FACE' }))).toEqual({
      kind: 'rejected',
    })
  })

  it('422 отдаёт причину качества из фиксированного перечня', () => {
    expect(mapVerifyError(httpError(422, { reason: 'LOW_SIGNAL' }))).toEqual({
      kind: 'quality',
      reason: 'LOW_SIGNAL',
    })
  })

  it('422 с причиной вне перечня схлопывается в обезличенный отказ', () => {
    // Перечень §D11 фиксирован. Пропустив произвольную строку дальше, мы бы показали
    // пользователю текст, происхождение которого не контролируем, — и завели бы канал,
    // по которому сервер (или тот, кто выдаёт себя за него) диктует UI произвольные подсказки.
    expect(
      mapVerifyError(httpError(422, { reason: 'SOMETHING_INVENTED' }))
    ).toEqual({ kind: 'rejected' })
  })

  it('422 без тела не падает', () => {
    expect(mapVerifyError(httpError(422))).toEqual({ kind: 'rejected' })
  })

  it('429 — исчерпан лимит попыток', () => {
    expect(mapVerifyError(httpError(429))).toEqual({ kind: 'rateLimited' })
  })

  it('503 — движок недоступен, попытка не израсходована', () => {
    expect(mapVerifyError(httpError(503))).toEqual({ kind: 'unavailable' })
  })

  it('неизвестный статус не притворяется отказом по существу', () => {
    // 500 это наша неисправность, а не «лицо не подошло». Схлопнув его в `rejected`, мы
    // сказали бы пользователю «вы не прошли» там, где сломался сервер.
    const outcome = mapVerifyError(httpError(500))

    expect(outcome.kind).toBe('clientError')
  })

  it('не-axios ошибка не теряется', () => {
    const outcome = mapVerifyError(new Error('camera exploded'))

    expect(outcome.kind).toBe('clientError')
  })
})

import type { AxiosInstance } from 'axios'
import i18n from 'i18next'

export const attachLanguageHeader = (instance: AxiosInstance): void => {
  instance.interceptors.request.use((config) => {
    config.headers.set('Accept-Language', i18n.language)
    return config
  })
}

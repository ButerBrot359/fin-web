import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useAuthStore } from '@/features/auth'
import {
  finishFaceIdRedirect,
  parseFaceIdCallback,
} from '@/features/face-id-service'
import { Button } from '@/shared/ui/buttons'

export function FaceIdCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const completeSignIn = useAuthStore((state) => state.completeSignIn)
  const [callback] = useState(() => parseFaceIdCallback(window.location.search))
  const [failed, setFailed] = useState(false)
  const attempt = useRef<ReturnType<typeof finishFaceIdRedirect> | null>(null)

  useEffect(() => {
    // Код не попадает в последующую навигацию/историю. index.html дополнительно
    // запрещает Referer ещё до загрузки JS и внешних шрифтов.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname
    )
    let active = true
    // React StrictMode повторяет setup эффекта. Обмен одноразовый: оба setup
    // подписываются на ОДИН promise, без повторного POST и без автоматического retry.
    attempt.current ??= finishFaceIdRedirect(callback)
    void attempt.current
      .then(({ tokens, returnPath }) => {
        if (!active) return
        completeSignIn(tokens, tokens.user.login)
        void navigate(returnPath, { replace: true })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [callback, completeSignIn, navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-02 p-6">
      <div className="flex max-w-xl flex-col items-start gap-4 rounded-lg bg-ui-01 p-8">
        <Typography component="h1" fontSize={26} fontWeight={700}>
          {t('faceId.callbackTitle')}
        </Typography>
        <Typography
          role={failed ? 'alert' : 'status'}
          color={failed ? 'error' : 'text.primary'}
        >
          {t(failed ? 'faceId.callbackFailed' : 'faceId.completing')}
        </Typography>
        {failed && (
          <Button
            variant="primary"
            onClick={() => {
              void navigate('/login', { replace: true })
            }}
          >
            {t('faceId.backToLogin')}
          </Button>
        )}
      </div>
    </main>
  )
}

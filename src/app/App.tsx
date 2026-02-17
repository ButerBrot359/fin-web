import { GreenAccentButton } from '@/shared/ui/buttons/green-accent-button'
import { useTranslation } from 'react-i18next'

function App() {
  const { t, i18n } = useTranslation()

  return (
    <div className="bg-ui-06 w-full h-screen">
      <div className="bg-ui-01">{t('actions.back')}</div>
      <GreenAccentButton
        onClick={() =>
          i18n.changeLanguage(i18n.language === 'ru' ? 'kz' : 'ru')
        }
      >
        1231
      </GreenAccentButton>
    </div>
  )
}

export default App

import { useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import { menuSettingsApi, type MenuScope } from '../../api/menu-settings-api'
import { useMenuSettingsEditor } from '../../lib/menu-settings/use-menu-settings-editor'
import { MenuScopeSelect } from './menu-scope-select'
import { MenuStructureTree } from './menu-structure-tree'

interface MenuSettingsEditorProps {
  initialScope?: MenuScope
  /** Вызывается после успешного сохранения (диалог закрывается, страница остаётся). */
  onSaved?: () => void
}

/**
 * Редактор меню (SCRUM-426 §4.2): выбор уровня (для обладателей права), дерево
 * модули→секции→ссылки, Сохранить / Сбросить слой. Используется и админ-страницей,
 * и диалогом «Настроить меню» у сайдбара.
 */
export const MenuSettingsEditor: FC<MenuSettingsEditorProps> = ({
  initialScope,
  onSaved,
}) => {
  const { t } = useTranslation()
  const [scope, setScope] = useState<MenuScope>(initialScope ?? { kind: 'my' })
  const [confirmReset, setConfirmReset] = useState(false)

  const { data: me } = useQuery({
    queryKey: ['menu-settings-me'],
    queryFn: ({ signal }) => menuSettingsApi.me(signal),
  })
  const canManage = me?.canManage === true

  const editor = useMenuSettingsEditor(scope)

  const scopeReady =
    (scope.kind !== 'profile' || scope.profileKey !== '') &&
    (scope.kind !== 'user' || scope.userKey !== '')

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {canManage ? (
        <MenuScopeSelect scope={scope} busy={editor.busy} onChange={setScope} />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {editor.isLoading && (
          <Typography variant="body2" className="text-ui-05">
            {t('sdui.menuSettings.loading')}
          </Typography>
        )}
        {editor.isError && (
          <Typography variant="body2" className="text-ui-05">
            {t('sdui.menuSettings.loadError')}
          </Typography>
        )}
        {!editor.isLoading && scopeReady && editor.structure != null && (
          <MenuStructureTree structure={editor.structure} editor={editor} />
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          disabled={editor.busy || editor.structure == null}
          onClick={() => {
            setConfirmReset(true)
          }}
        >
          {t('sdui.menuSettings.resetLayer')}
        </Button>
        <Button
          disabled={editor.busy || editor.structure == null}
          onClick={() => {
            editor.save(undefined, { onSuccess: onSaved })
          }}
        >
          {t('sdui.menuSettings.save')}
        </Button>
      </div>
      <Dialog
        open={confirmReset}
        onClose={() => {
          setConfirmReset(false)
        }}
      >
        <DialogTitle>{t('sdui.menuSettings.resetLayer')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('sdui.menuSettings.resetConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmReset(false)
            }}
          >
            {t('sdui.menuSettings.close')}
          </Button>
          <Button
            onClick={() => {
              setConfirmReset(false)
              editor.reset()
            }}
          >
            {t('sdui.menuSettings.resetLayer')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

import { useEffect, useMemo, useState, type FC } from 'react'
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import { viewSettingsApi } from '../api/view-settings-api'
import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import {
  buildPatchFromDecisions,
  collectCustomizableNodes,
} from '../lib/customize-form/collect-customizable-nodes'
import { useTreeStore } from '../lib/stores/tree-store'

const settingsKey = (screenKey: string) => ['view-settings', screenKey] as const

/**
 * Диалог «Ещё → Изменить форму» (конструктор дизайна Ф4): пер-пользовательская
 * видимость полей/групп/таблиц текущего экрана. Generic: список нод строится
 * по дереву с провода, диалог не знает ни одной конкретной формы.
 *
 * Скрытые СЕРВЕРОМ ноды в списке не показываются — раскрыть чужое скрытие
 * нельзя (сервер отвергает `visible:true`, это может быть вопрос прав).
 * После сохранения форма переоткрывается через шину настроек вида — патч
 * накладывает бэк, клиентского слияния нет.
 */
export const CustomizeFormDialog: FC = () => {
  const { t } = useTranslation()
  const isOpen = useCustomizeFormStore((s) => s.isOpen)
  const close = useCustomizeFormStore((s) => s.close)
  const screenKey = useTreeStore((s) => s.screenKey)
  const root = useTreeStore((s) => s.root)
  const queryClient = useQueryClient()

  const { data: patch } = useQuery({
    queryKey: settingsKey(screenKey ?? ''),
    queryFn: ({ signal }) => viewSettingsApi.get(screenKey ?? '', signal),
    enabled: isOpen && screenKey != null,
  })

  const nodes = useMemo(
    () => collectCustomizableNodes(root, patch ?? []),
    [root, patch]
  )

  const [hidden, setHidden] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!isOpen || patch == null) return
    setHidden(new Set(nodes.filter((n) => !n.visible).map((n) => n.nodeId)))
    // Пересобираем галочки только на открытии/приходе патча: правки
    // пользователя внутри открытого диалога перетирать нельзя.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patch])

  const finish = async () => {
    if (screenKey != null) {
      await queryClient.invalidateQueries({
        queryKey: settingsKey(screenKey),
      })
    }
    notifyViewSettingsChanged()
    close()
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      viewSettingsApi.put(
        screenKey ?? '',
        buildPatchFromDecisions(patch ?? [], hidden)
      ),
    onSuccess: finish,
  })

  const resetMutation = useMutation({
    mutationFn: () => viewSettingsApi.reset(screenKey ?? ''),
    onSuccess: finish,
  })

  const busy = saveMutation.isPending || resetMutation.isPending
  const toggle = (nodeId: string) => {
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  if (!isOpen) return null

  return (
    <Dialog
      open={isOpen}
      onClose={busy ? undefined : close}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t('sdui.customizeForm.title')}</DialogTitle>
      <DialogContent className="flex flex-col gap-1">
        <Typography variant="body2" className="pb-2">
          {t('sdui.customizeForm.description')}
        </Typography>
        {nodes.length === 0 && (
          <Typography variant="body2">
            {t('sdui.customizeForm.empty')}
          </Typography>
        )}
        {nodes.map((node) => (
          <FormControlLabel
            key={node.nodeId}
            control={
              <Checkbox
                checked={!hidden.has(node.nodeId)}
                onChange={() => {
                  toggle(node.nodeId)
                }}
                disabled={busy}
              />
            }
            label={node.label}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button
          variant="tertiary"
          onClick={() => {
            resetMutation.mutate()
          }}
          disabled={busy || screenKey == null}
        >
          {t('sdui.customizeForm.reset')}
        </Button>
        <Button variant="secondary" onClick={close} disabled={busy}>
          {t('sdui.customizeForm.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            saveMutation.mutate()
          }}
          disabled={busy || screenKey == null || patch == null}
        >
          {t('sdui.customizeForm.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

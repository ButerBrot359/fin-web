import { useEffect, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import type { SelectOption } from '@/shared/types/select-option'

import { fetchReferenceOptions } from '../../../../api/reference-options'
import { useReferenceOptions } from '../../../../lib/hooks/use-reference-options'

interface TabelPodborDialogProps {
  /** optionsSource контракта колонки Sotrudnik (spec v1 §3) — url готовит бэк. */
  url: string
  params: Record<string, string>
  /** id сотрудников, уже показанных в матрице, — их не даём выбрать повторно. */
  existingRefs: Set<number>
  onAdd: (refs: number[]) => void
  onClose: () => void
}

/**
 * Мультиподбор сотрудников для ADD_EMPLOYEES: серверный поиск по контракту
 * колонки, локальный набор отмеченных. Итог отправляется одной командой.
 */
export const TabelPodborDialog: FC<TabelPodborDialogProps> = ({
  url,
  params,
  existingRefs,
  onAdd,
  onClose,
}) => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Map<number, SelectOption>>(new Map())

  const { options, loading, load, loadDebounced } = useReferenceOptions(
    (q?: string) => fetchReferenceOptions({ url, params, search: q }),
    url
  )

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- начальная загрузка один раз
  }, [])

  const toggle = (opt: SelectOption) => {
    const id = Number(opt.id)
    setChecked((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, opt)
      return next
    })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('sdui.tabel.podborTitle')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={t('table.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            loadDebounced(e.target.value)
          }}
          sx={{ mb: 1 }}
        />
        {loading ? (
          <div className="flex justify-center p-4">
            <CircularProgress size={24} />
          </div>
        ) : (
          <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {options.map((opt) => {
              const id = Number(opt.id)
              const already = existingRefs.has(id)
              return (
                <ListItemButton
                  key={opt.code}
                  disabled={already}
                  onClick={() => {
                    toggle(opt)
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Checkbox
                      edge="start"
                      size="small"
                      checked={already || checked.has(id)}
                      disableRipple
                      tabIndex={-1}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={opt.label}
                    secondary={
                      already ? t('sdui.tabel.alreadyAdded') : undefined
                    }
                  />
                </ListItemButton>
              )
            })}
            {options.length === 0 && (
              <Typography
                variant="body2"
                sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}
              >
                {t('table.empty')}
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={checked.size === 0}
          onClick={() => {
            onAdd([...checked.keys()])
          }}
        >
          {t('sdui.tabel.podborAdd', { count: checked.size })}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

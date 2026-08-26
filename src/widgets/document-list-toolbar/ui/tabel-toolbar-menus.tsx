import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Menu, MenuItem } from '@mui/material'

import {
  postDocumentEntry,
  unpostDocumentEntry,
  type DocumentEntry,
} from '@/entities/document-entry'
import { openMovementsForEntry } from '@/features/sdui'
import { invalidateDocumentQueries } from '@/shared/lib/query/invalidate-entities'
import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { DropdownButton } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

interface TabelReportsDropdownProps {
  selectedId: number | null
}

/** «Отчёты» списка Табеля (spec v2 §3.3): единственный подтверждённый пункт —
 * «Движения документа»; пустых пунктов-заглушек не рисуем. */
export const TabelReportsDropdown = ({
  selectedId,
}: TabelReportsDropdownProps) => {
  const { t } = useTranslation()
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const movements = useMutation({
    mutationFn: (id: number) => openMovementsForEntry(String(id)),
    onError: () => {
      showToast('error', t('documentListToolbar.movementsError'))
    },
  })

  return (
    <div ref={anchorRef} className="inline-flex">
      <DropdownButton
        label={t('documentListToolbar.reports')}
        disabled={selectedId == null}
        onClick={() => {
          setAnchor(anchorRef.current)
        }}
      />
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => {
          setAnchor(null)
        }}
      >
        <MenuItem
          disabled={selectedId == null || movements.isPending}
          onClick={() => {
            setAnchor(null)
            if (selectedId != null) movements.mutate(selectedId)
          }}
        >
          {t('documentListToolbar.documentMovements')}
        </MenuItem>
      </Menu>
    </div>
  )
}

interface TabelMoreDropdownProps {
  pageCode: string
  moduleCode: string
  /** Ровно одна выбранная строка — или null. */
  selectedEntry: DocumentEntry | null
  hasCriteria: boolean
  onRefresh: () => void
  onCancelSearch: () => void
}

/** «Ещё» списка Табеля (spec v2 §3.3): Изменить, Провести/Отменить проведение
 * по состоянию, Обновить, Отменить поиск. Исключённые пункты 1С (Изменить
 * форму…, Справка, пометка удаления и пр.) не рисуем — analyst waiver. */
export const TabelMoreDropdown = ({
  pageCode,
  moduleCode,
  selectedEntry,
  hasCriteria,
  onRefresh,
  onCancelSearch,
}: TabelMoreDropdownProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const post = useMutation({
    mutationFn: (id: number) => postDocumentEntry(id),
    onSuccess: () => {
      invalidateDocumentQueries(queryClient)
      showToast('success', t('documentListToolbar.postSuccess'))
    },
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('documentListToolbar.postError')
      )
    },
  })

  const unpost = useMutation({
    mutationFn: (id: number) => unpostDocumentEntry(id),
    onSuccess: () => {
      invalidateDocumentQueries(queryClient)
      showToast('success', t('documentListToolbar.unpostSuccess'))
    },
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('documentListToolbar.unpostError')
      )
    },
  })

  const close = () => {
    setAnchor(null)
  }
  const single = selectedEntry

  return (
    <div ref={anchorRef} className="inline-flex">
      <DropdownButton
        label={t('documentListToolbar.more')}
        onClick={() => {
          setAnchor(anchorRef.current)
        }}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem
          disabled={!single}
          onClick={() => {
            close()
            if (single) {
              void navigate(
                `/modules/${pageCode}/document/${moduleCode}/${String(single.id)}`
              )
            }
          }}
        >
          {t('documentListToolbar.editEntry')}
        </MenuItem>
        {/* Проведение/отмена — по фактическому состоянию документа (§3.3) */}
        {single && !single.isPosted && (
          <MenuItem
            disabled={post.isPending}
            onClick={() => {
              close()
              post.mutate(single.id)
            }}
          >
            {t('documentListToolbar.post')}
          </MenuItem>
        )}
        {single?.isPosted && (
          <MenuItem
            disabled={unpost.isPending}
            onClick={() => {
              close()
              unpost.mutate(single.id)
            }}
          >
            {t('documentListToolbar.unpost')}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            close()
            onRefresh()
          }}
        >
          {t('documentListToolbar.refresh')}
        </MenuItem>
        {hasCriteria && (
          <MenuItem
            onClick={() => {
              close()
              onCancelSearch()
            }}
          >
            {t('table.cancelSearch')}
          </MenuItem>
        )}
      </Menu>
    </div>
  )
}

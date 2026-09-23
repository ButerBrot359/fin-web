import { useRef, useState } from 'react'
import type { FC } from 'react'
import { Menu, MenuItem } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { AvatarPlaceholder } from '@/shared/ui/avatar-placeholder'
import { showToast } from '@/shared/ui/toast/show-toast'
import { cn } from '@/shared/lib/utils/cn'

import type { NodeProps } from '../../../types/view'
import { uploadImageFieldFile } from '../../../api/image-field-api'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useImageFieldSource } from '../../../lib/hooks/use-image-field-source'

// SCRUM-308 v3 §2: IMAGE_FIELD. Карточка — редактируемый узел с
// uploadUrl/clearCommand (действия — пункты меню самого поля-картинки, как
// контекстное меню эталона); миниатюра панели списка — те же пропы без ключей
// действий вовсе. sourceUrl: null = фото нет → серый силуэт (§2.3).
export const ImageFieldNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()
  const sourceUrl = node.props?.sourceUrl as string | null | undefined
  // Ключей нет вовсе (не null) у read-only миниатюры — различаем по 'in'.
  const editable =
    !!node.props && ('uploadUrl' in node.props || 'clearCommand' in node.props)
  const uploadUrl = node.props?.uploadUrl as string | null | undefined
  const clearCommand = node.props?.clearCommand as string | undefined
  const maxSizeBytes = node.props?.maxSizeBytes as number | undefined
  const accept = node.props?.accept as string | undefined
  const enabled = node.props?.enabled === true

  const objectUrl = useImageFieldSource(sourceUrl)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: ({ url, file }: { url: string; file: File }) =>
      uploadImageFieldFile(url, file),
    onSuccess: () => {
      // §2.4: после загрузки sourceUrl получают перечитыванием формы — версия
      // ?v= в новом ответе уже другая, кэш blob инвалидируется ключом запроса.
      void dispatch({ type: 'OPEN' })
    },
    onError: (error: unknown) => {
      // Тексты ошибок сервера (400 ErrorResponse.message) показываем как есть.
      showToast(
        'error',
        error instanceof Error ? error.message : t('sdui.requestError')
      )
    },
  })

  const onFileChosen = (file: File | null) => {
    if (!file || typeof uploadUrl !== 'string' || uploadUrl === '') return
    // §2.4: maxSizeBytes из узла — отсечь заранее; сервер проверяет сам.
    if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
      showToast('error', t('sdui.imageField.tooLarge'))
      return
    }
    upload.mutate({ url: uploadUrl, file })
  }

  const interactive = editable && enabled

  const image = (
    <div
      className={cn(
        'flex h-28 w-28 items-center justify-center overflow-hidden rounded bg-ui-01 text-ui-05',
        interactive && 'cursor-pointer'
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? t('sdui.imageField.alt') : undefined}
      onClick={
        interactive
          ? (e) => {
              setMenuAnchor(e.currentTarget)
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setMenuAnchor(e.currentTarget)
              }
            }
          : undefined
      }
    >
      {objectUrl ? (
        <img
          src={objectUrl}
          alt={t('sdui.imageField.alt')}
          className="h-full w-full object-cover"
        />
      ) : (
        <AvatarPlaceholder />
      )}
    </div>
  )

  if (!editable) return image

  return (
    <div>
      {image}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          onFileChosen(e.target.files?.[0] ?? null)
          // Позволяет выбрать тот же файл повторно после ошибки
          e.target.value = ''
        }}
      />
      <Menu
        anchorEl={menuAnchor}
        open={menuAnchor !== null}
        onClose={() => {
          setMenuAnchor(null)
        }}
      >
        <MenuItem
          // У новой (несохранённой) карточки uploadUrl: null — загружать некуда
          disabled={
            typeof uploadUrl !== 'string' ||
            uploadUrl === '' ||
            upload.isPending
          }
          onClick={() => {
            setMenuAnchor(null)
            fileInputRef.current?.click()
          }}
        >
          {t('sdui.imageField.choosePhoto')}
        </MenuItem>
        <MenuItem
          disabled={!clearCommand || sourceUrl == null}
          onClick={() => {
            setMenuAnchor(null)
            if (clearCommand)
              void dispatch({ type: 'COMMAND', command: clearCommand })
          }}
        >
          {t('sdui.imageField.clearPhoto')}
        </MenuItem>
      </Menu>
    </div>
  )
}

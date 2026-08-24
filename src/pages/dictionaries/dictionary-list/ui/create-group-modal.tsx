import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, TextField, Typography } from '@mui/material'

import { createDictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { invalidateDictionaryQueries } from '@/shared/lib/query/invalidate-entities'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import CrossIcon from '@/shared/assets/icons/cross.svg'

interface CreateGroupModalProps {
  open: boolean
  onClose: () => void
  domain: string
  typeCode: string
  parentId?: number
}

interface CreateGroupForm {
  nameRu: string
  nameKz: string
}

export const CreateGroupModal = ({
  open,
  onClose,
  domain,
  typeCode,
  parentId,
}: CreateGroupModalProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const form = useForm<CreateGroupForm>({
    defaultValues: { nameRu: '', nameKz: '' },
  })

  // SCRUM-360 §6: код группы присваивает бэк (автонумерация, лежит в
  // attributes.Kod ответа). До записи поле пустое — как в эталонной форме 1С;
  // после создания показываем присвоенный код, не перечитывая запись.
  // Kod в запрос не кладём: непустое значение отключило бы автонумерацию.
  const [createdKod, setCreatedKod] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: CreateGroupForm) =>
      createDictEntry(domain, typeCode, {
        nameRu: data.nameRu,
        nameKz: data.nameKz || undefined,
        isGroup: true,
        ...(parentId != null && { parentId }),
        attributes: {},
      }),
    onSuccess: (res) => {
      invalidateDictionaryQueries(queryClient)
      showToast('success', t('dictSidebar.groupCreated'))
      const kod = res.data.data.attributes?.Kod
      if (typeof kod === 'string' && kod) {
        setCreatedKod(kod)
      } else {
        form.reset()
        onClose()
      }
    },
    onError: () => {
      showToast('error', t('dictSidebar.groupCreateError'))
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    mutation.mutate(data)
  })

  const handleClose = () => {
    form.reset()
    setCreatedKod(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
            p: 0,
            m: 0,
            minWidth: 500,
            maxWidth: 'none',
          },
        },
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-15 py-10">
        <div className="flex items-center gap-6">
          <Typography variant="h5" className="flex-1 font-bold text-ui-06">
            {t('actions.createGroup')}
          </Typography>
          <button type="button" onClick={handleClose}>
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <TextField
          label={t('dictSidebar.kod')}
          value={createdKod ?? ''}
          helperText={t('dictSidebar.kodAutoHint')}
          slotProps={{ input: { readOnly: true } }}
          disabled={!createdKod}
          fullWidth
        />

        <TextField
          label={t('dictSidebar.nameRu')}
          {...form.register('nameRu', { required: true })}
          error={!!form.formState.errors.nameRu}
          slotProps={{ input: { readOnly: !!createdKod } }}
          fullWidth
          autoFocus
        />

        <TextField
          label={t('dictSidebar.nameKz')}
          {...form.register('nameKz')}
          slotProps={{ input: { readOnly: !!createdKod } }}
          fullWidth
        />

        <div className="flex gap-3">
          {createdKod ? (
            <Button
              variant="primary"
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg"
            >
              {t('actions.close')}
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 rounded-lg"
              >
                {t('actions.create')}
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg"
              >
                {t('actions.cancel')}
              </Button>
            </>
          )}
        </div>
      </form>
    </Dialog>
  )
}

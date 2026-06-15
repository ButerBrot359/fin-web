import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import type { EnumsValue } from '@/entities/document-type'
import { SelectOperationDialog } from '@/widgets/document-list-toolbar'
import { PageHeader } from '@/widgets/page-header'
import {
  AutocompleteInput,
  DateTimeInput,
  NumberInput,
  TextInput,
} from '@/shared/ui/inputs'
import { showToast } from '@/shared/ui/toast/show-toast'
import type { SelectOption } from '@/shared/types/select-option'

import {
  useDvizheniyaFinansirovaniya,
  useIstochnikiFinansirovaniya,
  useOrganizations,
  useVidyPlana,
} from '../lib/hooks/use-upload-options'
import {
  useGenerateFinancingPlan,
  useParseFinancingPlan,
} from '../lib/hooks/use-financing-plan-upload'
import { FinancingPlanPreviewTable } from './financing-plan-preview-table'
import {
  DEFAULT_SHEET_NAME,
  OPERATION_FROM_FILE,
  OPERATION_FROM_PORTAL,
  type GenerateRequest,
  type GenerateRow,
  type ParseResult,
  type UploadFormState,
} from '../types/financing-plan-upload'

const todayIso = () => new Date().toISOString().slice(0, 10)

/** Синтетический EnumsValue для диалога выбора операции. */
const makeOperation = (
  code: string,
  name: string,
  isActive: boolean
): EnumsValue => ({
  id: 0,
  code,
  code1C: '',
  name,
  enumCode: 'VidOperatsiiZagruzki',
  isActive,
})

/**
 * Обработка «Загрузка плана финансирования» (DataProcessor): загрузка Excel,
 * предпросмотр распарсенных строк, формирование и проведение документа.
 * MVP — только операция «Из файла» (Excel); «Из портала» отключена.
 */
export const FinancingPlanUploadPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '' } = useParams()

  useTabMeta(t('bankPage.financing.financingPlanUpload'))

  // Диалог выбора операции (Из файла / Из портала). Показываем при входе;
  // после выбора «Из файла» — параметрическая форма.
  const [operationDialogOpen, setOperationDialogOpen] = useState(true)
  const [operation, setOperation] = useState<string | null>(null)

  const operationOptions = useMemo<EnumsValue[]>(
    () => [
      makeOperation(
        OPERATION_FROM_FILE,
        t('financingPlanUpload.fromFile'),
        true
      ),
      makeOperation(
        OPERATION_FROM_PORTAL,
        t('financingPlanUpload.fromPortalSoon'),
        false
      ),
    ],
    [t]
  )

  // Опции автокомплитов.
  const { organizationOptions } = useOrganizations()
  const { vidPlanaOptions } = useVidyPlana()
  const { istochnikOptions } = useIstochnikiFinansirovaniya()
  const { dvizhenieOptions } = useDvizheniyaFinansirovaniya()

  // Черновик формы параметров.
  const [form, setForm] = useState<UploadFormState>({
    data: todayIso(),
    organizatsiyaId: null,
    vidPlana: null,
    istochnikFinansirovaniyaId: null,
    dvizhenieFinansirovaniyaId: null,
    sheetName: '',
    startRow: 2,
    columnOffset: null,
    vTysTenge: false,
  })
  const patchForm = (patch: Partial<UploadFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  // Выбранные SelectOption (для отображения в автокомплитах).
  const [organization, setOrganization] = useState<SelectOption | null>(null)
  const [vidPlana, setVidPlana] = useState<SelectOption | null>(null)
  const [istochnik, setIstochnik] = useState<SelectOption | null>(null)
  const [dvizhenie, setDvizhenie] = useState<SelectOption | null>(null)

  // Выбранный файл.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }

  // Результат разбора.
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  const parseMutation = useParseFinancingPlan()
  const generateMutation = useGenerateFinancingPlan()

  const handleSelectOperation = (code: string) => {
    if (code === OPERATION_FROM_PORTAL) {
      showToast('info', t('financingPlanUpload.fromPortalSoon'))
      return
    }
    setOperation(code)
    setOperationDialogOpen(false)
  }

  const canParse =
    !!file &&
    form.organizatsiyaId != null &&
    !!form.vidPlana &&
    !parseMutation.isPending

  const handleParse = () => {
    if (!file || form.organizatsiyaId == null || !form.vidPlana) return
    const sheetName = form.sheetName.trim()
    parseMutation.mutate(
      {
        file,
        params: {
          organizatsiyaId: form.organizatsiyaId,
          vidPlana: form.vidPlana,
          startRow: form.startRow,
          vTysTenge: form.vTysTenge,
          data: form.data,
          // Отправляем имя листа только если пользователь его изменил.
          ...(sheetName && sheetName !== DEFAULT_SHEET_NAME
            ? { sheetName }
            : {}),
          ...(form.columnOffset != null
            ? { columnOffset: form.columnOffset }
            : {}),
        },
      },
      {
        onSuccess: (result) => {
          setParseResult(result)
        },
        onError: (error) => {
          setParseResult(null)
          showToast(
            'error',
            t('financingPlanUpload.parseFailed'),
            extractErrorMessage(error)
          )
        },
      }
    )
  }

  const canGenerate =
    parseResult?.canGenerate === true &&
    form.organizatsiyaId != null &&
    !!form.vidPlana &&
    !generateMutation.isPending

  const handleGenerate = () => {
    if (!parseResult || form.organizatsiyaId == null || !form.vidPlana) return

    const rows: GenerateRow[] = parseResult.rows.map((row) => {
      const out: GenerateRow = {
        fkrId: row.fkrId,
        spetsifikaId: row.spetsifikaId,
        summaItogo: row.summaItogo,
        summaPeriod1: row.summaPeriod1,
        summaPeriod2: row.summaPeriod2,
        summaPeriod3: row.summaPeriod3,
        summaPeriod4: row.summaPeriod4,
        summaPeriod5: row.summaPeriod5,
        summaPeriod6: row.summaPeriod6,
        summaPeriod7: row.summaPeriod7,
        summaPeriod8: row.summaPeriod8,
        summaPeriod9: row.summaPeriod9,
        summaPeriod10: row.summaPeriod10,
        summaPeriod11: row.summaPeriod11,
        summaPeriod12: row.summaPeriod12,
      }
      return out
    })

    const body: GenerateRequest = {
      organizatsiyaId: form.organizatsiyaId,
      vidPlana: form.vidPlana,
      data: form.data,
      ...(form.istochnikFinansirovaniyaId != null
        ? { istochnikFinansirovaniyaId: form.istochnikFinansirovaniyaId }
        : {}),
      ...(form.dvizhenieFinansirovaniyaId != null
        ? { dvizhenieFinansirovaniyaId: form.dvizhenieFinansirovaniyaId }
        : {}),
      rows,
    }

    generateMutation.mutate(body, {
      onSuccess: (result) => {
        showToast(
          'success',
          t('financingPlanUpload.generated', { number: result.number })
        )
      },
      onError: (error) => {
        showToast(
          'error',
          t('financingPlanUpload.generateFailed'),
          extractErrorMessage(error)
        )
      },
    })
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  // Пока операцию не выбрали — показываем только диалог.
  if (operation !== OPERATION_FROM_FILE) {
    return (
      <div className="flex h-full flex-col gap-5 pt-5">
        <PageHeader
          title={t('bankPage.financing.financingPlanUpload')}
          onClose={handleClose}
        />
        <SelectOperationDialog
          open={operationDialogOpen}
          onClose={handleClose}
          onSelect={handleSelectOperation}
          operations={operationOptions}
          isLoading={false}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader
        title={t('bankPage.financing.financingPlanUpload')}
        onClose={handleClose}
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="report-param-field w-64">
          <DateTimeInput
            value={form.data}
            onChange={(v) => {
              patchForm({ data: v })
            }}
            label={t('financingPlanUpload.dateLabel')}
            dateOnly
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <AutocompleteInput
            value={organization}
            options={organizationOptions}
            onChange={(opt) => {
              setOrganization(opt)
              patchForm({ organizatsiyaId: opt ? Number(opt.id) : null })
            }}
            label={t('financingPlanUpload.organization')}
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <AutocompleteInput
            value={vidPlana}
            options={vidPlanaOptions}
            onChange={(opt) => {
              setVidPlana(opt)
              patchForm({ vidPlana: opt ? opt.code : null })
            }}
            label={t('financingPlanUpload.planType')}
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <AutocompleteInput
            value={istochnik}
            options={istochnikOptions}
            onChange={(opt) => {
              setIstochnik(opt)
              patchForm({
                istochnikFinansirovaniyaId: opt ? Number(opt.id) : null,
              })
            }}
            label={t('financingPlanUpload.source')}
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <AutocompleteInput
            value={dvizhenie}
            options={dvizhenieOptions}
            onChange={(opt) => {
              setDvizhenie(opt)
              patchForm({
                dvizhenieFinansirovaniyaId: opt ? Number(opt.id) : null,
              })
            }}
            label={t('financingPlanUpload.movement')}
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <TextInput
            value={form.sheetName}
            onChange={(e) => {
              patchForm({ sheetName: e.target.value })
            }}
            label={t('financingPlanUpload.sheetName')}
            placeholder={DEFAULT_SHEET_NAME}
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-40">
          <NumberInput
            value={String(form.startRow)}
            onChange={(e) => {
              patchForm({
                startRow: Number((e.target as HTMLInputElement).value) || 0,
              })
            }}
            label={t('financingPlanUpload.startRow')}
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-40">
          <NumberInput
            value={form.columnOffset == null ? '' : String(form.columnOffset)}
            onChange={(e) => {
              const raw = (e.target as HTMLInputElement).value
              patchForm({ columnOffset: raw === '' ? null : Number(raw) })
            }}
            label={t('financingPlanUpload.columnOffset')}
            size="small"
            fullWidth
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <Typography variant="caption" className="text-ui-05">
            {t('financingPlanUpload.units')}
          </Typography>
          <RadioGroup
            row
            value={form.vTysTenge ? 'thousands' : 'tenge'}
            onChange={(e) => {
              patchForm({ vTysTenge: e.target.value === 'thousands' })
            }}
          >
            <FormControlLabel
              value="tenge"
              control={<Radio size="small" />}
              label={t('financingPlanUpload.inTenge')}
            />
            <FormControlLabel
              value="thousands"
              control={<Radio size="small" />}
              label={t('financingPlanUpload.inThousands')}
            />
          </RadioGroup>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outlined"
          onClick={() => fileInputRef.current?.click()}
          sx={{ height: 40 }}
        >
          {t('financingPlanUpload.chooseFile')}
        </Button>
        {file && (
          <Typography variant="body2" className="text-ui-06">
            {file.name}
          </Typography>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="contained"
          disabled={!canParse}
          onClick={handleParse}
          sx={{ height: 40 }}
        >
          {t('financingPlanUpload.loadFromExcel')}
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!canGenerate}
          onClick={handleGenerate}
          sx={{ height: 40 }}
        >
          {t('financingPlanUpload.generateDocuments')}
        </Button>
      </div>

      {parseResult && parseResult.errors.length > 0 && (
        <div className="rounded-md border border-support-01/40 bg-support-01/10 p-3">
          <Typography variant="subtitle2" className="text-support-01">
            {t('financingPlanUpload.parseErrors')}
          </Typography>
          <ul className="mt-1 list-disc pl-5">
            {parseResult.errors.map((err, i) => (
              <li key={i} className="text-sm text-support-01">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parseResult && <FinancingPlanPreviewTable rows={parseResult.rows} />}
    </div>
  )
}

/** Достаём человекочитаемое сообщение из ошибки бэка (envelope/обычный axios). */
function extractErrorMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const e = error as {
      message?: string
      data?: { message?: string }
      errors?: { message?: string }[]
    }
    if (e.data?.message) return e.data.message
    if (e.errors?.[0]?.message) return e.errors[0].message
    if (e.message) return e.message
  }
  return undefined
}

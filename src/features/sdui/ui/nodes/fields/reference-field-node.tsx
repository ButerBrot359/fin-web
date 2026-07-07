import { useState, useEffect, useRef, type FC } from 'react'
import { IconButton } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { useSduiDispatch } from '../../../lib/dispatch'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { fetchReferenceOptions } from '../../../api/reference-options'
import { openReferencePicker } from '../../../lib/reference-picker-gateway'

const DOMAIN_PATH_MAP: Record<string, string> = {
  DICTIONARY: 'dictionary-entries',
  DOCUMENT: 'document-entries',
  ACCOUNT_PLAN: 'account-plan',
}

interface ReferenceValue {
  id: number
  presentation: string
}

function toSelectOption(ref: ReferenceValue): SelectOption {
  return { id: ref.id, code: String(ref.id), label: ref.presentation }
}

function fromSelectOption(opt: SelectOption): ReferenceValue {
  return { id: Number(opt.id), presentation: opt.label }
}

export const ReferenceFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const dispatch = useSduiDispatch()

  const domain = (node.props?.domain as string | undefined) ?? 'DICTIONARY'
  const targetTypeCode = node.props?.targetTypeCode as string | undefined
  const filter = node.props?.filter as Record<string, unknown> | undefined
  const optionsSource = node.props?.optionsSource as { url: string; params?: Record<string, string> } | undefined

  const rawValue = f.value as ReferenceValue | null | undefined

  const [options, setOptions] = useState<SelectOption[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const requestSeqRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Инвалидировать кеш опций при смене параметров источника (напр. смена организации)
  const paramsKey = optionsSource?.params
    ? JSON.stringify(optionsSource.params)
    : JSON.stringify(filter ?? null)
  useEffect(() => {
    setOptions([])
  }, [paramsKey])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  if (!f.visible) return null

  const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'

  const loadOptions = (search?: string) => {
    const url = optionsSource
      ? optionsSource.url
      : targetTypeCode
        ? `/api/${domainPath}/${targetTypeCode}/entries`
        : null
    if (!url) return
    const params = optionsSource ? optionsSource.params : filter
    const seq = ++requestSeqRef.current
    setLoading(true)
    fetchReferenceOptions({ url, params, search })
      .then((opts) => {
        if (seq !== requestSeqRef.current) return // поздний ответ раннего запроса — игнор
        setOptions(opts)
      })
      .catch(() => {
        if (seq === requestSeqRef.current) setOptions([])
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setLoading(false)
      })
  }

  const loadOptionsDebounced = (search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadOptions(search), 300)
  }

  const selectedOption = rawValue ? toSelectOption(rawValue) : null

  const applySelected = (opt: SelectOption | null) => {
    const newVal = opt ? fromSelectOption(opt) : null
    f.setValue(newVal)
    // Сброс локального кэша опций: следующий onOpen перезапросит свежий список,
    // и запись, созданная из формы выбора, появится без перезагрузки страницы.
    setOptions([])
    f.fireServerEvent('change', newVal)
  }

  const canBrowse = !!targetTypeCode && !f.readonly && f.enabled

  const filterSearchParams = filter
    ? Object.fromEntries(
        Object.entries(filter).map(([k, v]) => [k, String(v)]),
      )
    : undefined

  const openDictList = () => {
    openReferencePicker({
      mode: 'list',
      domain,
      typeCode: targetTypeCode!,
      onSelect: applySelected,
      searchParams: filterSearchParams,
    })
  }

  const openDictCreate = () => {
    openReferencePicker({
      mode: 'create',
      domain,
      typeCode: targetTypeCode!,
      onSelect: applySelected,
      searchParams: filterSearchParams,
    })
  }

  const showAllAction = node.actions?.find(
    (a) => a.trigger === 'showAll' && a.actionId === 'command'
  )
  const allowShowAll = node.props?.allowShowAll as boolean | undefined

  const createAction = node.actions?.find((a) => a.trigger === 'create' && a.actionId === 'command')
  const openAction = node.actions?.find((a) => a.trigger === 'open' && a.actionId === 'command')
  const allowCreate = node.props?.allowCreate as boolean | undefined

  return (
    <div style={{ flex: f.flex !== undefined ? f.flex : undefined }}>
      <AutocompleteInput
        value={selectedOption}
        inputValue={inputValue}
        options={options}
        label={f.label}
        required={f.required}
        readOnly={f.readonly}
        disabled={!f.enabled}
        error={!!f.error}
        helperText={f.error}
        loading={loading}
        onInputChange={(_e, val, reason) => {
          setInputValue(val)
          if (reason === 'input') {
            loadOptionsDebounced(val)
          }
        }}
        onOpen={() => {
          if (options.length === 0) {
            loadOptions()
          }
        }}
        onChange={applySelected}
        onShowAll={
          showAllAction
            ? () => void dispatch({ type: 'COMMAND', command: showAllAction.command!, sourceNodeId: node.id })
            : (allowShowAll ?? canBrowse) ? openDictList : undefined
        }
        onAdd={
          createAction
            ? () => void dispatch({ type: 'COMMAND', command: createAction.command!, sourceNodeId: node.id })
            : (allowCreate ?? canBrowse) ? openDictCreate : undefined
        }
        endAction={
          selectedOption && openAction ? (
            <IconButton
              sx={{ p: '4px', borderRadius: '6px' }}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                void dispatch({ type: 'COMMAND', command: openAction.command!, sourceNodeId: node.id })
              }}
            >
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 20 }} />
            </IconButton>
          ) : selectedOption && canBrowse ? (
            <IconButton
              sx={{ p: '4px', borderRadius: '6px' }}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                openReferencePicker({
                  mode: 'edit',
                  domain,
                  typeCode: targetTypeCode!,
                  entryId: selectedOption.id,
                  onSelect: applySelected,
                })
              }}
            >
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 20 }} />
            </IconButton>
          ) : undefined
        }
      />
    </div>
  )
}

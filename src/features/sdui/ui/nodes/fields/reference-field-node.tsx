import { useState, useEffect, type FC } from 'react'
import { IconButton } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { apiService } from '@/shared/api/api'
import { useDictSidebarStore } from '@/features/dict-sidebar'

const DOMAIN_PATH_MAP: Record<string, string> = {
  DICTIONARY: 'dictionary-entries',
  DOCUMENT: 'document-entries',
  ACCOUNT_PLAN: 'account-plan',
}

interface ReferenceValue {
  id: number
  presentation: string
}

interface EntryItem {
  id: number
  presentation?: string
  name?: string
  [key: string]: unknown
}

function toSelectOption(ref: ReferenceValue): SelectOption {
  return { id: ref.id, code: String(ref.id), label: ref.presentation }
}

function fromSelectOption(opt: SelectOption): ReferenceValue {
  return { id: Number(opt.id), presentation: opt.label }
}

export const ReferenceFieldNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const required = node.props?.required as boolean | undefined
  const readonly = node.props?.readonly as boolean | undefined
  const visible = (node.props?.visible as boolean | undefined) ?? true
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const error = node.props?.error as string | undefined
  const flex = node.props?.flex as number | string | undefined
  const domain = (node.props?.domain as string | undefined) ?? 'DICTIONARY'
  const targetTypeCode = node.props?.targetTypeCode as string | undefined
  const filter = node.props?.filter as Record<string, unknown> | undefined
  const optionsSource = node.props?.optionsSource as { url: string; params?: Record<string, string> } | undefined

  const { getValue, setValue } = useSduiSession()
  const rawValue = getValue(node.binding) as ReferenceValue | null | undefined
  const dispatch = useSduiDispatch()

  const [options, setOptions] = useState<SelectOption[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  // Инвалидировать кеш опций при смене параметров источника (напр. смена организации)
  const paramsKey = optionsSource?.params
    ? JSON.stringify(optionsSource.params)
    : JSON.stringify(filter ?? null)
  useEffect(() => {
    setOptions([])
  }, [paramsKey])

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  const domainPath = DOMAIN_PATH_MAP[domain] ?? 'dictionary-entries'

  const fetchOptions = async (search?: string) => {
    setLoading(true)
    try {
      if (optionsSource) {
        const res = await apiService.get<{ content?: EntryItem[]; items?: EntryItem[] }>({
          url: optionsSource.url,
          params: { ...optionsSource.params, search, page: 0, size: 20 },
        })
        const items = res.data.content ?? res.data.items ?? []
        setOptions(
          items.map((item) => ({
            id: item.id,
            code: String(item.id),
            label: (item.presentation ?? item.name ?? String(item.id)) as string,
          })),
        )
        return
      }

      // Legacy path — field without optionsSource
      if (!targetTypeCode) return
      const res = await apiService.get<{ content?: EntryItem[]; items?: EntryItem[] }>({
        url: `/api/${domainPath}/${targetTypeCode}/entries`,
        params: { search, page: 0, size: 20, ...filter },
      })
      const items = res.data.content ?? res.data.items ?? []
      setOptions(
        items.map((item) => ({
          id: item.id,
          code: String(item.id),
          label: (item.presentation ?? item.name ?? String(item.id)) as string,
        })),
      )
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const selectedOption = rawValue ? toSelectOption(rawValue) : null

  const applySelected = (opt: SelectOption | null) => {
    const newVal = opt ? fromSelectOption(opt) : null
    if (node.binding) setValue(node.binding, newVal)
    fireServerEvent('change', newVal)
  }

  const canBrowse = !!targetTypeCode && !readonly && enabled

  const filterSearchParams = filter
    ? Object.fromEntries(
        Object.entries(filter).map(([k, v]) => [k, String(v)]),
      )
    : undefined

  const openDictList = () => {
    useDictSidebarStore.getState().push({
      mode: 'list',
      domain,
      typeCode: targetTypeCode!,
      onSelect: applySelected,
      searchParams: filterSearchParams,
    })
  }

  const openDictCreate = () => {
    useDictSidebarStore.getState().push({
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
    <div style={{ flex: flex !== undefined ? flex : undefined }}>
      <AutocompleteInput
        value={selectedOption}
        inputValue={inputValue}
        options={options}
        label={label}
        required={required}
        readOnly={readonly}
        disabled={!enabled}
        error={!!error}
        helperText={error}
        loading={loading}
        onInputChange={(_e, val, reason) => {
          setInputValue(val)
          if (reason === 'input') {
            void fetchOptions(val)
          }
        }}
        onOpen={() => {
          if (options.length === 0) {
            void fetchOptions()
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
                useDictSidebarStore.getState().push({
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

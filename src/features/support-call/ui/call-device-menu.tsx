import SettingsVoiceIcon from '@mui/icons-material/SettingsVoice'
import { Menu } from '@mui/material'
import { useMediaDeviceSelect } from '@livekit/components-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

/**
 * Умеет ли браузер переключать устройство вывода.
 *
 * <p>`setSinkId` есть только в Chromium: Firefox и Safari проигрывают звук туда, куда указывает
 * система. Проверяем заранее, чтобы не рисовать список, который ничего не переключит, — молча
 * не работающий выбор хуже честного «в этом браузере нельзя».
 */
const canPickSpeaker =
  typeof HTMLMediaElement !== 'undefined' &&
  'setSinkId' in HTMLMediaElement.prototype

/** Один список устройств: подписи приходят от браузера, наше дело — выделить выбранное. */
const DeviceList = ({
  kind,
  title,
  emptyLabel,
}: {
  kind: MediaDeviceKind
  title: string
  emptyLabel: string
}) => {
  const { devices, activeDeviceId, setActiveMediaDevice } =
    useMediaDeviceSelect({ kind })

  return (
    <div className="px-2 py-1">
      <p className="px-2 py-1 text-body2 text-ui-05">{title}</p>

      {devices.length === 0 && (
        <p className="px-2 py-1 text-body2 text-ui-03">{emptyLabel}</p>
      )}

      {devices.map((device) => (
        <button
          key={device.deviceId}
          type="button"
          onClick={() => {
            void setActiveMediaDevice(device.deviceId)
          }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-body2 transition-colors',
            device.deviceId === activeDeviceId
              ? 'bg-ui-04 text-accent-02'
              : 'text-ui-06 hover:bg-ui-02'
          )}
        >
          <span className="truncate">
            {/* Пустая подпись — устройство есть, но браузер не отдал имя без разрешения
                на микрофон. Показываем хоть что-то, чтобы список не выглядел сломанным. */}
            {device.label || device.deviceId.slice(0, 12)}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Выбор микрофона и динамика (ADR-0050).
 *
 * <p>Нужен чаще, чем кажется: у бухгалтера в кабинете обычно гарнитура и встроенный микрофон
 * ноутбука одновременно, и браузер по умолчанию берёт не тот. Разбираться в системных настройках
 * посреди разговора с поддержкой человек не станет — он просто скажет, что его не слышно.
 */
export const CallDeviceMenu = () => {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          setAnchor(event.currentTarget)
        }}
        aria-label={t('support.devices')}
        title={t('support.devices')}
        className="flex cursor-pointer items-center gap-2 rounded-md bg-ui-02 py-2.5 pr-4 pl-3 text-body2 whitespace-nowrap text-ui-06 transition-colors hover:bg-ui-04"
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <SettingsVoiceIcon fontSize="small" />
        </span>
        {t('support.devices')}
      </button>

      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null)
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
              minWidth: 280,
              maxWidth: 360,
            },
          },
        }}
      >
        <DeviceList
          kind="audioinput"
          title={t('support.microphoneDevice')}
          emptyLabel={t('support.devicesEmpty')}
        />

        <div className="mx-4 my-1 border-t border-ui-03" />

        {canPickSpeaker ? (
          <DeviceList
            kind="audiooutput"
            title={t('support.speakerDevice')}
            emptyLabel={t('support.devicesEmpty')}
          />
        ) : (
          <div className="px-4 py-2">
            <p className="text-body2 text-ui-05">
              {t('support.speakerDevice')}
            </p>
            <p className="mt-1 text-body2 text-ui-03">
              {t('support.speakerUnsupported')}
            </p>
          </div>
        )}
      </Menu>
    </>
  )
}

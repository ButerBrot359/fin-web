import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils/cn'

import { MicroLabel } from '@/shared/ui/micro-label'

interface SettingsSectionProps {
  label: string
  /**
   * Волосяная линия сверху. Группы внутри панели разделяем линией и отступом,
   * а не вложенными карточками: карточка означала бы отдельный объект.
   */
  divided?: boolean
  children: ReactNode
}

/** Группа полей формы настроек: микро-лейбл + поля под ним. */
export const SettingsSection = ({
  label,
  divided = false,
  children,
}: SettingsSectionProps) => (
  <section
    className={cn(
      'flex flex-col gap-3',
      divided && 'border-t border-ui-03 pt-5'
    )}
  >
    <MicroLabel>{label}</MicroLabel>
    {/* gap-6: helperText у полей темы позиционирован абсолютно (bottom: -18),
        меньший отступ клал бы подсказку на следующее поле. */}
    <div className="flex flex-col gap-6">{children}</div>
  </section>
)

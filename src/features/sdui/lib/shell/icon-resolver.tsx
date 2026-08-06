import type { FC, SVGProps } from 'react'

import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'
import WarehouseIcon from '@/shared/assets/navigation/warehouse.svg'
import ActivesIcon from '@/shared/assets/navigation/actives.svg'
import SalaryIcon from '@/shared/assets/navigation/salary.svg'
import ReportIcon from '@/shared/assets/navigation/report.svg'
import RegulatedFinReportIcon from '@/shared/assets/navigation/regulated-fin-report.svg'

type IconComponent = FC<SVGProps<SVGSVGElement>>

// Имена — из реестра бэка (SduiIconNames): home + модульные. Ассеты остаются
// на фронте; бэк шлёт имя строкой (backend-answers-SCRUM-289-shell.md §Иконки).
const SHELL_ICONS: Record<string, IconComponent> = {
  home: MainIcon,
  bank: BankIcon,
  warehouse: WarehouseIcon,
  actives: ActivesIcon,
  salary: SalaryIcon,
  reports: ReportIcon,
  admin: RegulatedFinReportIcon,
}

const FALLBACK_ICON: IconComponent = MainIcon

export function resolveShellIcon(name?: string): IconComponent {
  if (!name) return FALLBACK_ICON
  return SHELL_ICONS[name] ?? FALLBACK_ICON
}

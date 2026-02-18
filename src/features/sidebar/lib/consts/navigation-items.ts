import MainIcon from '@/shared/assets/navigation/main.svg'
import BankIcon from '@/shared/assets/navigation/bank.svg'
import WarehouseIcon from '@/shared/assets/navigation/warehouse.svg'
import ActivesIcon from '@/shared/assets/navigation/actives.svg'
import TarifsIcon from '@/shared/assets/navigation/tarifs.svg'
import SalaryIcon from '@/shared/assets/navigation/salary.svg'
import ReportIcon from '@/shared/assets/navigation/report.svg'
import OurCompanyIcon from '@/shared/assets/navigation/our-company.svg'
import FlkIcon from '@/shared/assets/navigation/flk.svg'
import RegulatedFinReportIcon from '@/shared/assets/navigation/regulated-fin-report.svg'

import type { NavigationItem } from '../../types/types'

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'main', label: 'Главная', icon: MainIcon },
  { id: 'bank', label: 'Банк и касса', icon: BankIcon },
  { id: 'warehouse', label: 'Склад', icon: WarehouseIcon },
  {
    id: 'actives',
    label: 'Основные средства и нематериальные активы',
    icon: ActivesIcon,
  },
  { id: 'tarifs', label: 'Тарификация', icon: TarifsIcon },
  { id: 'salary', label: 'Зарплата и кадры', icon: SalaryIcon },
  { id: 'reports', label: 'Отчёты', icon: ReportIcon },
  { id: 'our-company', label: 'Наше учреждение', icon: OurCompanyIcon },
  { id: 'flk', label: 'ФЛК', icon: FlkIcon },
  {
    id: 'regulated-fin-report',
    label: 'Регламентированная настраиваемая отчётность',
    icon: RegulatedFinReportIcon,
  },
]

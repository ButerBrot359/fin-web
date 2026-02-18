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
  { id: 'main', labelKey: 'sidebar.nav.main', icon: MainIcon },
  { id: 'bank', labelKey: 'sidebar.nav.bank', icon: BankIcon },
  {
    id: 'warehouse',
    labelKey: 'sidebar.nav.warehouse',
    icon: WarehouseIcon,
    disabled: true,
  },
  {
    id: 'actives',
    labelKey: 'sidebar.nav.actives',
    icon: ActivesIcon,
    disabled: true,
  },
  {
    id: 'tariffs',
    labelKey: 'sidebar.nav.tariffs',
    icon: TarifsIcon,
    disabled: true,
  },
  {
    id: 'salary',
    labelKey: 'sidebar.nav.salary',
    icon: SalaryIcon,
    disabled: true,
  },
  {
    id: 'reports',
    labelKey: 'sidebar.nav.reports',
    icon: ReportIcon,
    disabled: true,
  },
  {
    id: 'our-company',
    labelKey: 'sidebar.nav.ourCompany',
    icon: OurCompanyIcon,
    disabled: true,
  },
  { id: 'flk', labelKey: 'sidebar.nav.flk', icon: FlkIcon, disabled: true },
  {
    id: 'regulated-fin-report',
    labelKey: 'sidebar.nav.regulatedFinReport',
    icon: RegulatedFinReportIcon,
    disabled: true,
  },
]

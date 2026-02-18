export interface BankSectionItem {
  labelKey: string
  selectable?: boolean
  path?: string
}

interface BankSection {
  titleKey: string
  items: BankSectionItem[]
}

export const BANK_COLUMNS: BankSection[][] = [
  [
    {
      titleKey: 'bankPage.financing.title',
      items: [
        { labelKey: 'bankPage.financing.financingPlan' },
        { labelKey: 'bankPage.financing.financingPlanUpload' },
      ],
    },
    {
      titleKey: 'bankPage.bank.title',
      items: [
        { labelKey: 'bankPage.bank.invoice' },
        { labelKey: 'bankPage.bank.incomingPaymentOrder' },
      ],
    },
    {
      titleKey: 'bankPage.treasury.title',
      items: [{ labelKey: 'bankPage.treasury.civilDealRegistration' }],
    },
    {
      titleKey: 'bankPage.cashDesk.title',
      items: [
        { labelKey: 'bankPage.cashDesk.advanceReport' },
        { labelKey: 'bankPage.cashDesk.cashDesks' },
        {
          labelKey: 'bankPage.cashDesk.receiptOrder',
          selectable: true,
          path: '/bank/cash-receipt-order',
        },
        { labelKey: 'bankPage.cashDesk.expenseOrder' },
        { labelKey: 'bankPage.cashDesk.businessTrips' },
        { labelKey: 'bankPage.cashDesk.reconciliationAct' },
      ],
    },
  ],
  [
    {
      titleKey: 'bankPage.statements.title',
      items: [
        { labelKey: 'bankPage.statements.individualPayments' },
        { labelKey: 'bankPage.statements.accountableAmounts' },
        { labelKey: 'bankPage.statements.individualRefunds' },
        { labelKey: 'bankPage.statements.mealPayments' },
      ],
    },
    {
      titleKey: 'bankPage.directories.title',
      items: [
        { labelKey: 'bankPage.directories.banks' },
        { labelKey: 'bankPage.directories.budgetPayments' },
        { labelKey: 'bankPage.directories.paymentPurposeTypes' },
        { labelKey: 'bankPage.directories.paymentDocExpenses' },
        { labelKey: 'bankPage.directories.bicDirectory' },
        { labelKey: 'bankPage.directories.cashFlowItems' },
        { labelKey: 'bankPage.directories.ddsItemFilling' },
      ],
    },
  ],
  [
    {
      titleKey: 'bankPage.reports.title',
      items: [
        { labelKey: 'bankPage.reports.financingPlanUpload1' },
        { labelKey: 'bankPage.reports.financingPlanUpload2' },
      ],
    },
  ],
]

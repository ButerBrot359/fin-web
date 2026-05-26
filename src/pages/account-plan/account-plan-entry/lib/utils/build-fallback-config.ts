import type { FormConfig, TabsNode } from '@/entities/form-config'

/**
 * Fallback-схема карточки счёта на случай, если form-config с бэка
 * не пришёл. Только вкладка «Основное» через стандартные FieldNode —
 * вкладка «Субконто» рендерится отдельным компонентом (см.
 * AccountPlanCard), потому что табличная часть с правилами учёта не
 * вписывается в текущие узлы FormConfig.
 */
export const buildAccountPlanFallbackConfig = (): FormConfig => ({
  name: 'account-plan-fallback',
  title: '',
  layout: {
    type: 'Tabs',
    panes: [
      {
        key: 'general',
        label: 'Основное',
        children: [
          {
            type: 'VStack',
            gap: 3,
            children: [
              {
                type: 'HStack',
                gap: 3,
                children: [
                  { type: 'Field', code: 'code', flex: 1 },
                  { type: 'Field', code: 'accountType', flex: 1 },
                ],
              },
              { type: 'Field', code: 'nameRu' },
              { type: 'Field', code: 'nameKz' },
              {
                type: 'HStack',
                gap: 3,
                children: [
                  { type: 'Field', code: 'isCurrency', flex: 1 },
                  { type: 'Field', code: 'isQuantitative', flex: 1 },
                  { type: 'Field', code: 'isOffBalance', flex: 1 },
                ],
              },
              { type: 'Field', code: 'parentId' },
            ],
          },
        ],
      },
    ],
  } satisfies TabsNode,
})

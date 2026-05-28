import type { FormConfig, TabsNode } from '@/entities/form-config'

/**
 * Fallback-схема карточки на случай отсутствия form-config с бэка.
 * Поля повторяют имена нового DTO (isQuantity, isGroup и т.д.). Вкладка
 * «Виды субконто» рендерится отдельным компонентом и здесь не описана.
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
                  { type: 'Field', code: 'parentId', flex: 1 },
                ],
              },
              { type: 'Field', code: 'nameRu' },
              { type: 'Field', code: 'nameKz' },
              { type: 'Field', code: 'accountType' },
              {
                type: 'HStack',
                gap: 3,
                children: [
                  { type: 'Field', code: 'isOffBalance', flex: 1 },
                  { type: 'Field', code: 'isGroup', flex: 1 },
                  { type: 'Field', code: 'isCurrency', flex: 1 },
                  { type: 'Field', code: 'isQuantity', flex: 1 },
                ],
              },
            ],
          },
        ],
      },
    ],
  } satisfies TabsNode,
})

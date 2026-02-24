/**
 * ========================================================
 * ВАРИАНТ 3: ACTION-DRIVEN (Ориентирован на действия)
 * ========================================================
 *
 * Идея: гибрид — layout по секциям, но каждый элемент
 * может иметь свои actions, validations, visibility rules.
 * Бэк управляет не только "что показать", но и "когда" и "как".
 *
 * Плюсы:
 *   + Бэк управляет бизнес-логикой (видимость, валидация, зависимости)
 *   + Можно менять поведение полей без обновления фронта
 *   + Поддерживает условную логику (visibility, computed fields)
 *   + Секции дают гибкую группировку без глубокой вложенности
 *
 * Минусы:
 *   - Самая сложная структура
 *   - Фронту нужен движок для вычисления условий
 *   - Больше данных передаётся
 */

export const schemaV3 = {
  // ==========================================
  // Страница списка (таблица)
  // ==========================================
  listPage: {
    type: 'list',
    meta: {
      title: 'cashReceiptOrder',
      entityCode: 'cash-receipt-order',
      dataEndpoint: '/api/data/cash-receipt-orders',
    },

    // Действия страницы с контекстом
    actions: [
      {
        id: 'create',
        trigger: 'button',
        label: 'Создать',
        variant: 'accent',
        execute: {
          type: 'fetch-ui',
          endpoint: '/api/v3/pages/cash-receipt-order/create-action',
          renderAs: 'modal',
        },
      },
      {
        id: 'bulk-edit',
        trigger: 'button',
        label: 'Изменить выделенные...',
        variant: 'outlined',
        // Активна только если выделены строки
        visibility: { condition: 'selectedRows.length > 0' },
        execute: {
          type: 'fetch-ui',
          endpoint: '/api/v3/pages/cash-receipt-order/bulk-edit',
          renderAs: 'modal',
        },
      },
      {
        id: 'print',
        trigger: 'dropdown',
        label: 'Печать',
        items: [
          {
            id: 'print-list',
            label: 'Печать списка',
            execute: { type: 'api-call', method: 'POST', endpoint: '/api/print/cash-receipt-orders' },
          },
          {
            id: 'print-selected',
            label: 'Печать выделенных',
            visibility: { condition: 'selectedRows.length > 0' },
            execute: { type: 'api-call', method: 'POST', endpoint: '/api/print/cash-receipt-orders', body: { ids: '{selectedRows}' } },
          },
        ],
      },
      {
        id: 'reports',
        trigger: 'dropdown',
        label: 'Отчёты',
        items: [
          { id: 'report-summary', label: 'Сводный отчёт', execute: { type: 'navigate', path: '/reports/cash-receipt-summary' } },
          { id: 'report-period', label: 'По периодам', execute: { type: 'navigate', path: '/reports/cash-receipt-by-period' } },
        ],
      },
    ],

    // Фильтры с зависимостями
    filters: [
      {
        id: 'organization',
        fieldType: 'select',
        label: 'Организация',
        source: { type: 'api', endpoint: '/api/enums/organizations' },
      },
      {
        id: 'subdivision',
        fieldType: 'select',
        label: 'Подразделение организации',
        source: {
          type: 'api',
          endpoint: '/api/enums/subdivisions',
          params: { organizationId: '{filters.organization}' },
        },
        // Показывать только если выбрана организация
        visibility: { condition: 'filters.organization != null' },
      },
      {
        id: 'operationType',
        fieldType: 'select',
        label: 'Вид операции',
        source: { type: 'api', endpoint: '/api/enums/operation-types' },
      },
    ],

    // Колонки таблицы
    table: {
      columns: [
        { id: 'date', label: 'Дата', fieldType: 'datetime', sortable: true, width: 160 },
        { id: 'number', label: 'Номер', fieldType: 'text', sortable: true, width: 120 },
        { id: 'organization', label: 'Организация', fieldType: 'text', width: 140 },
        { id: 'subdivision', label: 'Подразделение', fieldType: 'text', width: 130 },
        { id: 'operationType', label: 'Вид операции', fieldType: 'text', width: 130 },
        { id: 'counterparty', label: 'Контрагент', fieldType: 'text', width: 130 },
        { id: 'fundingSource', label: 'Источник финансирования', fieldType: 'text', width: 130 },
        { id: 'fkr', label: 'ФКР', fieldType: 'text', width: 80 },
        { id: 'paymentCode', label: 'Код платежа', fieldType: 'text', width: 110 },
        { id: 'spec', label: 'Спецификация', fieldType: 'text', width: 80 },
        { id: 'comment', label: 'Комментарий', fieldType: 'text', width: 140 },
        { id: 'responsible', label: 'Ответственный', fieldType: 'text', width: 140 },
        { id: 'link', label: 'Ссылка', fieldType: 'link', width: 120 },
      ],
      rowActions: [
        {
          id: 'open',
          trigger: 'click',
          execute: { type: 'navigate', path: '/bank/cash-receipt-order/{row.id}' },
        },
        {
          id: 'delete',
          trigger: 'context-menu',
          label: 'Удалить',
          confirm: { title: 'Удалить запись?', message: 'Запись будет удалена безвозвратно.' },
          execute: { type: 'api-call', method: 'DELETE', endpoint: '/api/data/cash-receipt-orders/{row.id}' },
        },
      ],
      pagination: {
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100],
      },
    },
  },

  // ==========================================
  // Действие "Создать" — модалка
  // ==========================================
  createAction: {
    type: 'modal',
    meta: {
      title: 'Выберите операцию',
      width: 'sm',
    },

    fields: [
      {
        id: 'operationType',
        fieldType: 'radio-group',
        defaultValue: 'payment_from_buyer',
        options: [
          { value: 'payment_from_buyer', label: 'Оплата от покупателя' },
          { value: 'cash_from_bank', label: 'Получение наличных в банке' },
          { value: 'other_income', label: 'Прочие поступления' },
        ],
      },
    ],

    actions: [
      {
        id: 'confirm',
        trigger: 'button',
        label: 'Далее',
        variant: 'accent',
        execute: {
          type: 'navigate',
          path: '/bank/cash-receipt-order/new',
          params: { operationType: '{fields.operationType}' },
        },
      },
      {
        id: 'cancel',
        trigger: 'button',
        label: 'Отмена',
        variant: 'text',
        execute: { type: 'close-modal' },
      },
    ],
  },

  // ==========================================
  // Страница формы (детальная)
  // ==========================================
  formPage: {
    type: 'form',
    meta: {
      title: 'Приходно кассовый ордер {number} от {date}',
      entityCode: 'cash-receipt-order',
      dataEndpoint: '/api/data/cash-receipt-orders/{id}',
      saveEndpoint: '/api/data/cash-receipt-orders/{id}',
    },

    // Действия формы
    actions: [
      {
        id: 'post-and-close',
        trigger: 'button',
        label: 'Провести и закрыть',
        variant: 'accent',
        execute: {
          type: 'sequence',
          steps: [
            { type: 'validate-form' },
            { type: 'api-call', method: 'POST', endpoint: '/api/data/cash-receipt-orders/{id}/post' },
            { type: 'navigate', path: '/bank/cash-receipt-order' },
          ],
        },
      },
      {
        id: 'save',
        trigger: 'button',
        label: 'Записать',
        variant: 'outlined',
        execute: {
          type: 'sequence',
          steps: [
            { type: 'validate-form' },
            { type: 'api-call', method: 'PUT', endpoint: '/api/data/cash-receipt-orders/{id}' },
            { type: 'show-notification', message: 'Сохранено', severity: 'success' },
          ],
        },
      },
      {
        id: 'post',
        trigger: 'button',
        label: 'Провести',
        variant: 'outlined',
        execute: {
          type: 'sequence',
          steps: [
            { type: 'validate-form' },
            { type: 'api-call', method: 'POST', endpoint: '/api/data/cash-receipt-orders/{id}/post' },
          ],
        },
      },
      {
        id: 'print',
        trigger: 'dropdown',
        label: 'Печать',
        items: [
          { id: 'print-order', label: 'Печать ордера', execute: { type: 'api-call', method: 'POST', endpoint: '/api/print/cash-receipt-orders/{id}' } },
        ],
      },
    ],

    // Секции формы — средний уровень вложенности
    sections: [
      // === Шапка ===
      {
        id: 'header',
        type: 'section',
        columns: 2, // сетка 2 колонки
        fields: [
          { id: 'operationType', fieldType: 'select', label: 'Вид операции', col: 1, source: { type: 'api', endpoint: '/api/enums/operation-types' } },
          { id: 'basis', fieldType: 'heading', label: 'Основание', col: 2, link: true },
        ],
      },

      // === Основные данные ===
      {
        id: 'main',
        type: 'section',
        columns: 2,
        fields: [
          {
            id: 'number',
            fieldType: 'text',
            label: 'Номер',
            col: 1,
            readOnly: true,
            validation: { required: true },
          },
          {
            id: 'date',
            fieldType: 'datetime',
            label: 'от',
            col: 1,
            validation: { required: true },
          },
          {
            id: 'fundingSource',
            fieldType: 'reference',
            label: 'Источник финансирования',
            col: 2,
            source: { type: 'api', endpoint: '/api/references/funding-sources' },
          },

          {
            id: 'organization',
            fieldType: 'reference',
            label: 'Организация',
            col: 1,
            source: { type: 'api', endpoint: '/api/references/organizations' },
            validation: { required: true },
          },
          {
            id: 'spec',
            fieldType: 'reference',
            label: 'Специфика',
            col: 2,
            source: { type: 'api', endpoint: '/api/references/specs' },
          },

          {
            id: 'subdivision',
            fieldType: 'reference',
            label: 'Подразделение организации',
            col: 1,
            source: {
              type: 'api',
              endpoint: '/api/references/subdivisions',
              params: { organizationId: '{fields.organization}' },
            },
            visibility: { condition: 'fields.organization != null' },
          },
          {
            id: 'cashAccount',
            fieldType: 'reference',
            label: 'Счёт кассы',
            col: 2,
            source: { type: 'api', endpoint: '/api/references/accounts' },
          },
          {
            id: 'ddsArticle',
            fieldType: 'reference',
            label: 'Статья ДДС',
            col: 2,
            source: { type: 'api', endpoint: '/api/references/dds-articles' },
          },

          {
            id: 'cash',
            fieldType: 'reference',
            label: 'Касса',
            col: 1,
            source: { type: 'api', endpoint: '/api/references/cashes' },
            validation: { required: true },
          },

          {
            id: 'documentAmount',
            fieldType: 'money',
            label: 'Сумма документа',
            col: 1,
            validation: { required: true, min: 0 },
            // Вычисляемое поле — может обновляться при изменении строк табличной части
            computed: {
              expression: 'sum(tabRows.amount)',
              editable: true, // можно перезаписать вручную
            },
          },
        ],
      },

      // === Вкладки (табличная часть) ===
      {
        id: 'tabs',
        type: 'tabs',
        items: [
          {
            id: 'payment_from_buyer',
            label: 'Оплата от покупателя',
            // Показывать только при соответствующем виде операции
            visibility: { condition: "fields.operationType == 'payment_from_buyer'" },
            type: 'section',
            columns: 3,
            fields: [
              {
                id: 'accountingAccount',
                fieldType: 'reference',
                label: 'Счёт учёта',
                col: 1,
                source: { type: 'api', endpoint: '/api/references/accounts' },
              },
              {
                id: 'advanceAccount',
                fieldType: 'reference',
                label: 'Счёт авансов',
                col: 2,
                source: { type: 'api', endpoint: '/api/references/accounts' },
              },
              {
                id: 'counterparty',
                fieldType: 'reference',
                label: 'Контрагент',
                col: 3,
                source: { type: 'api', endpoint: '/api/references/counterparties' },
                validation: { required: true },
              },
              {
                id: 'counterpartyContract',
                fieldType: 'reference',
                label: 'Договор контрагента',
                col: '1-3', // занимает все 3 колонки
                source: {
                  type: 'api',
                  endpoint: '/api/references/contracts',
                  params: { counterpartyId: '{fields.counterparty}' },
                },
                visibility: { condition: 'fields.counterparty != null' },
              },
            ],
          },
          {
            id: 'cash_from_bank',
            label: 'Получение наличных',
            visibility: { condition: "fields.operationType == 'cash_from_bank'" },
            type: 'section',
            columns: 2,
            fields: [
              {
                id: 'bankAccount',
                fieldType: 'reference',
                label: 'Банковский счёт',
                col: 1,
                source: { type: 'api', endpoint: '/api/references/bank-accounts' },
              },
              {
                id: 'withdrawalOrder',
                fieldType: 'reference',
                label: 'Заявка на снятие',
                col: 2,
                source: { type: 'api', endpoint: '/api/references/withdrawal-orders' },
              },
            ],
          },
          {
            id: 'print',
            label: 'Печать',
            type: 'section',
            columns: 1,
            fields: [],
          },
        ],
      },

      // === Подвал ===
      {
        id: 'footer',
        type: 'section',
        columns: 2,
        fields: [
          {
            id: 'comment',
            fieldType: 'textarea',
            label: 'Комментарий',
            col: 1,
          },
          {
            id: 'responsible',
            fieldType: 'reference',
            label: 'Ответственный',
            col: 2,
            source: { type: 'api', endpoint: '/api/references/employees' },
            defaultValue: '{currentUser.id}',
          },
        ],
      },
    ],
  },
}

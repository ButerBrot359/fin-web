/**
 * ========================================================
 * ВАРИАНТ 2: ВЛОЖЕННАЯ СТРУКТУРА С LAYOUT (Nested Layout)
 * ========================================================
 *
 * Идея: бэк полностью описывает layout — строки, колонки, секции.
 * Фронт — "тупой" рендерер, идёт по дереву и отрисовывает.
 *
 * Плюсы:
 *   + Бэк полностью контролирует расположение
 *   + Можно менять layout без обновления фронта
 *   + Гибкая группировка (секции, строки, колонки)
 *
 * Минусы:
 *   - Более сложная структура JSON
 *   - Бэку нужно знать про UI
 *   - Больше данных в ответе
 */

export const schemaV2 = {
  // ==========================================
  // Страница списка (таблица)
  // ==========================================
  listPage: {
    type: 'list',
    title: 'cashReceiptOrder',
    entityCode: 'cash-receipt-order',
    dataEndpoint: '/api/data/cash-receipt-orders',

    // Layout описывает расположение всего на странице
    layout: {
      type: 'page',
      children: [
        // Тулбар
        {
          type: 'toolbar',
          children: [
            {
              type: 'toolbar-group',
              position: 'left',
              children: [
                {
                  type: 'action-button',
                  id: 'create',
                  label: 'Создать',
                  variant: 'accent',
                  onClick: {
                    type: 'fetch',
                    endpoint: '/api/v2/pages/cash-receipt-order/create-action',
                  },
                },
                { type: 'action-icon', id: 'export', icon: 'export' },
                { type: 'action-icon', id: 'settings', icon: 'table-settings' },
                { type: 'action-icon', id: 'columns', icon: 'columns' },
                {
                  type: 'action-button',
                  id: 'bulk-edit',
                  label: 'Изменить выделенные...',
                  variant: 'outlined',
                },
                {
                  type: 'action-dropdown',
                  id: 'print',
                  label: 'Печать',
                  items: [
                    { id: 'print-list', label: 'Печать списка' },
                    { id: 'print-selected', label: 'Печать выделенных' },
                  ],
                },
                {
                  type: 'action-dropdown',
                  id: 'reports',
                  label: 'Отчёты',
                  items: [
                    { id: 'report-summary', label: 'Сводный отчёт' },
                    { id: 'report-period', label: 'По периодам' },
                  ],
                },
              ],
            },
            {
              type: 'toolbar-group',
              position: 'right',
              children: [
                { type: 'search', placeholder: 'Поиск' },
                {
                  type: 'action-dropdown',
                  id: 'more',
                  label: 'Ещё',
                  items: [],
                },
              ],
            },
          ],
        },

        // Фильтры
        {
          type: 'filter-bar',
          children: [
            {
              type: 'filter',
              id: 'organization',
              fieldType: 'select',
              label: 'Организация',
              optionsEndpoint: '/api/enums/organizations',
              span: 4, // из 12 колонок
            },
            {
              type: 'filter',
              id: 'subdivision',
              fieldType: 'select',
              label: 'Подразделение организации',
              optionsEndpoint: '/api/enums/subdivisions',
              dependsOn: 'organization',
              span: 4,
            },
            {
              type: 'filter',
              id: 'operationType',
              fieldType: 'select',
              label: 'Вид операции',
              optionsEndpoint: '/api/enums/operation-types',
              span: 4,
            },
          ],
        },

        // Таблица
        {
          type: 'data-table',
          dataEndpoint: '/api/data/cash-receipt-orders',
          rowAction: {
            type: 'navigate',
            pattern: '/bank/cash-receipt-order/{id}',
          },
          pagination: {
            defaultPageSize: 20,
            pageSizeOptions: [10, 20, 50, 100],
          },
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
        },
      ],
    },
  },

  // ==========================================
  // Действие "Создать" — модалка
  // ==========================================
  createAction: {
    type: 'modal',
    title: 'Выберите операцию',
    layout: {
      type: 'modal-body',
      children: [
        {
          type: 'field',
          id: 'operationType',
          fieldType: 'radio-group',
          options: [
            { value: 'payment_from_buyer', label: 'Оплата от покупателя' },
            { value: 'cash_from_bank', label: 'Получение наличных в банке' },
            { value: 'other_income', label: 'Прочие поступления' },
          ],
        },
      ],
    },
    footer: {
      type: 'modal-footer',
      children: [
        {
          type: 'action-button',
          id: 'confirm',
          label: 'Далее',
          variant: 'accent',
          onClick: {
            type: 'navigate',
            pattern: '/bank/cash-receipt-order/new?operationType={operationType}',
          },
        },
        {
          type: 'action-button',
          id: 'cancel',
          label: 'Отмена',
          variant: 'text',
          onClick: { type: 'close' },
        },
      ],
    },
  },

  // ==========================================
  // Страница формы (детальная)
  // ==========================================
  formPage: {
    type: 'form',
    title: 'Приходно кассовый ордер {number} от {date}',
    entityCode: 'cash-receipt-order',
    dataEndpoint: '/api/data/cash-receipt-orders/{id}',

    layout: {
      type: 'page',
      children: [
        // Тулбар формы
        {
          type: 'toolbar',
          children: [
            {
              type: 'toolbar-group',
              position: 'left',
              children: [
                {
                  type: 'action-button',
                  id: 'post-and-close',
                  label: 'Провести и закрыть',
                  variant: 'accent',
                  onClick: {
                    type: 'api-call',
                    method: 'POST',
                    endpoint: '/api/data/cash-receipt-orders/{id}/post-and-close',
                  },
                },
                {
                  type: 'action-button',
                  id: 'save',
                  label: 'Записать',
                  variant: 'outlined',
                  onClick: {
                    type: 'api-call',
                    method: 'PUT',
                    endpoint: '/api/data/cash-receipt-orders/{id}',
                  },
                },
                {
                  type: 'action-button',
                  id: 'post',
                  label: 'Провести',
                  variant: 'outlined',
                  onClick: {
                    type: 'api-call',
                    method: 'POST',
                    endpoint: '/api/data/cash-receipt-orders/{id}/post',
                  },
                },
                {
                  type: 'action-dropdown',
                  id: 'print',
                  label: 'Печать',
                  items: [{ id: 'print-order', label: 'Печать ордера' }],
                },
              ],
            },
          ],
        },

        // Тело формы — двухколоночный layout
        {
          type: 'form-body',
          children: [
            // Шапка — Вид операции + Основание
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'operationType', fieldType: 'select', label: 'Вид операции', optionsEndpoint: '/api/enums/operation-types' },
                  ],
                },
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'heading', text: 'Основание', level: 3, link: true },
                  ],
                },
              ],
            },

            // Номер + Дата | Источник финансирования
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 3,
                  children: [
                    { type: 'field', id: 'number', fieldType: 'text', label: 'Номер', readOnly: true },
                  ],
                },
                {
                  type: 'column',
                  span: 3,
                  children: [
                    { type: 'field', id: 'date', fieldType: 'datetime', label: 'от' },
                  ],
                },
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'fundingSource', fieldType: 'reference', label: 'Источник финансирования', referenceEndpoint: '/api/references/funding-sources' },
                  ],
                },
              ],
            },

            // Организация | Специфика
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'organization', fieldType: 'reference', label: 'Организация', referenceEndpoint: '/api/references/organizations' },
                  ],
                },
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'spec', fieldType: 'reference', label: 'Специфика', referenceEndpoint: '/api/references/specs' },
                  ],
                },
              ],
            },

            // Подразделение | Счёт кассы + Статья ДДС
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'subdivision', fieldType: 'reference', label: 'Подразделение организации', referenceEndpoint: '/api/references/subdivisions' },
                  ],
                },
                {
                  type: 'column',
                  span: 3,
                  children: [
                    { type: 'field', id: 'cashAccount', fieldType: 'reference', label: 'Счёт кассы', referenceEndpoint: '/api/references/accounts' },
                  ],
                },
                {
                  type: 'column',
                  span: 3,
                  children: [
                    { type: 'field', id: 'ddsArticle', fieldType: 'reference', label: 'Статья ДДС', referenceEndpoint: '/api/references/dds-articles' },
                  ],
                },
              ],
            },

            // Касса
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'cash', fieldType: 'reference', label: 'Касса', referenceEndpoint: '/api/references/cashes' },
                  ],
                },
              ],
            },

            // Сумма документа
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'documentAmount', fieldType: 'money', label: 'Сумма документа' },
                  ],
                },
              ],
            },

            // Вкладки
            {
              type: 'tabs',
              children: [
                {
                  type: 'tab',
                  id: 'payment_from_buyer',
                  label: 'Оплата от покупателя',
                  children: [
                    {
                      type: 'row',
                      children: [
                        {
                          type: 'column',
                          span: 4,
                          children: [
                            { type: 'field', id: 'accountingAccount', fieldType: 'reference', label: 'Счёт учёта', referenceEndpoint: '/api/references/accounts' },
                          ],
                        },
                        {
                          type: 'column',
                          span: 4,
                          children: [
                            { type: 'field', id: 'advanceAccount', fieldType: 'reference', label: 'Счёт авансов', referenceEndpoint: '/api/references/accounts' },
                          ],
                        },
                        {
                          type: 'column',
                          span: 4,
                          children: [
                            { type: 'field', id: 'counterparty', fieldType: 'reference', label: 'Контрагент', referenceEndpoint: '/api/references/counterparties' },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'row',
                      children: [
                        {
                          type: 'column',
                          span: 12,
                          children: [
                            { type: 'field', id: 'counterpartyContract', fieldType: 'reference', label: 'Договор контрагента', referenceEndpoint: '/api/references/contracts' },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'tab',
                  id: 'print',
                  label: 'Печать',
                  children: [],
                },
              ],
            },

            // Футер — Комментарий + Ответственный
            {
              type: 'row',
              children: [
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'comment', fieldType: 'text', label: 'Комментарий' },
                  ],
                },
                {
                  type: 'column',
                  span: 6,
                  children: [
                    { type: 'field', id: 'responsible', fieldType: 'reference', label: 'Ответственный', referenceEndpoint: '/api/references/employees' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
}

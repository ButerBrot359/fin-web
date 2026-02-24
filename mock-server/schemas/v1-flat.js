/**
 * ========================================================
 * ВАРИАНТ 1: ПЛОСКАЯ СТРУКТУРА (Flat Schema)
 * ========================================================
 *
 * Идея: бэк отдаёт плоские массивы — колонки, фильтры, действия.
 * Фронт сам решает как их расположить в сетке.
 *
 * Плюсы:
 *   + Простая структура, легко парсить
 *   + Фронт контролирует layout
 *   + Легко расширять новыми типами полей
 *
 * Минусы:
 *   - Бэк не управляет расположением элементов
 *   - Для сложных форм с группировкой нужна доп. логика
 */

export const schemaV1 = {
  // ==========================================
  // Страница списка (таблица)
  // ==========================================
  listPage: {
    type: 'list',
    title: 'cashReceiptOrder',
    entityCode: 'cash-receipt-order',
    dataEndpoint: '/api/data/cash-receipt-orders',

    // Действия в тулбаре
    actions: [
      {
        id: 'create',
        type: 'button',
        label: 'Создать',
        variant: 'accent',
        // При нажатии — запросить у бэка что делать
        handler: {
          type: 'fetch',
          endpoint: '/api/v1/pages/cash-receipt-order/create-action',
        },
      },
      { id: 'export', type: 'icon-button', icon: 'export' },
      { id: 'settings', type: 'icon-button', icon: 'table-settings' },
      { id: 'columns', type: 'icon-button', icon: 'columns' },
      {
        id: 'bulk-edit',
        type: 'button',
        label: 'Изменить выделенные...',
        variant: 'outlined',
      },
      {
        id: 'print',
        type: 'dropdown',
        label: 'Печать',
        options: [
          { id: 'print-list', label: 'Печать списка' },
          { id: 'print-selected', label: 'Печать выделенных' },
        ],
      },
      {
        id: 'reports',
        type: 'dropdown',
        label: 'Отчёты',
        options: [
          { id: 'report-summary', label: 'Сводный отчёт' },
          { id: 'report-period', label: 'По периодам' },
        ],
      },
    ],

    // Фильтры
    filters: [
      {
        id: 'organization',
        type: 'select',
        label: 'Организация',
        optionsEndpoint: '/api/enums/organizations',
      },
      {
        id: 'subdivision',
        type: 'select',
        label: 'Подразделение организации',
        optionsEndpoint: '/api/enums/subdivisions',
        dependsOn: 'organization',
      },
      {
        id: 'operationType',
        type: 'select',
        label: 'Вид операции',
        optionsEndpoint: '/api/enums/operation-types',
      },
    ],

    // Колонки таблицы
    columns: [
      { id: 'date', label: 'Дата', type: 'datetime', sortable: true, width: 160 },
      { id: 'number', label: 'Номер', type: 'text', sortable: true, width: 120 },
      { id: 'organization', label: 'Организация', type: 'text', width: 140 },
      { id: 'subdivision', label: 'Подразделение', type: 'text', width: 130 },
      { id: 'operationType', label: 'Вид операции', type: 'text', width: 130 },
      { id: 'counterparty', label: 'Контрагент', type: 'text', width: 130 },
      { id: 'fundingSource', label: 'Источник финансирования', type: 'text', width: 130 },
      { id: 'fkr', label: 'ФКР', type: 'text', width: 80 },
      { id: 'paymentCode', label: 'Код платежа', type: 'text', width: 110 },
      { id: 'spec', label: 'Спецификация', type: 'text', width: 80 },
      { id: 'comment', label: 'Комментарий', type: 'text', width: 140 },
      { id: 'responsible', label: 'Ответственный', type: 'text', width: 140 },
      { id: 'link', label: 'Ссылка', type: 'link', width: 120 },
    ],

    // При клике по строке
    rowAction: {
      type: 'navigate',
      pattern: '/bank/cash-receipt-order/{id}',
    },

    pagination: {
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
    },
  },

  // ==========================================
  // Действие "Создать" — модалка с выбором
  // ==========================================
  createAction: {
    type: 'modal',
    title: 'Выберите операцию',

    // Содержимое модалки
    content: {
      type: 'radio-select',
      fieldId: 'operationType',
      options: [
        { value: 'payment_from_buyer', label: 'Оплата от покупателя' },
        { value: 'cash_from_bank', label: 'Получение наличных в банке' },
        { value: 'other_income', label: 'Прочие поступления' },
      ],
    },

    // Кнопки модалки
    actions: [
      {
        id: 'confirm',
        label: 'Далее',
        variant: 'accent',
        handler: {
          type: 'navigate',
          pattern: '/bank/cash-receipt-order/new?operationType={operationType}',
        },
      },
      {
        id: 'cancel',
        label: 'Отмена',
        variant: 'text',
        handler: { type: 'close' },
      },
    ],
  },

  // ==========================================
  // Страница формы (детальная)
  // ==========================================
  formPage: {
    type: 'form',
    title: 'Приходно кассовый ордер {number} от {date}',
    entityCode: 'cash-receipt-order',
    dataEndpoint: '/api/data/cash-receipt-orders/{id}',

    // Действия в тулбаре формы
    actions: [
      {
        id: 'post-and-close',
        label: 'Провести и закрыть',
        variant: 'accent',
        handler: { type: 'api-call', method: 'POST', endpoint: '/api/data/cash-receipt-orders/{id}/post-and-close' },
      },
      {
        id: 'save',
        label: 'Записать',
        variant: 'outlined',
        handler: { type: 'api-call', method: 'PUT', endpoint: '/api/data/cash-receipt-orders/{id}' },
      },
      {
        id: 'post',
        label: 'Провести',
        variant: 'outlined',
        handler: { type: 'api-call', method: 'POST', endpoint: '/api/data/cash-receipt-orders/{id}/post' },
      },
      {
        id: 'print',
        type: 'dropdown',
        label: 'Печать',
        options: [
          { id: 'print-order', label: 'Печать ордера' },
        ],
      },
    ],

    // Поля формы — плоский массив, группировка через group
    fields: [
      // === Основная секция (верх) ===
      { id: 'operationType', label: 'Вид операции', type: 'select', group: 'header', optionsEndpoint: '/api/enums/operation-types' },

      { id: 'number', label: 'Номер', type: 'text', group: 'main', readOnly: true },
      { id: 'date', label: 'от', type: 'datetime', group: 'main' },

      { id: 'organization', label: 'Организация', type: 'reference', group: 'main', referenceEndpoint: '/api/references/organizations' },
      { id: 'fundingSource', label: 'Источник финансирования', type: 'reference', group: 'main', referenceEndpoint: '/api/references/funding-sources' },

      { id: 'subdivision', label: 'Подразделение организации', type: 'reference', group: 'main', referenceEndpoint: '/api/references/subdivisions' },
      { id: 'spec', label: 'Специфика', type: 'reference', group: 'main', referenceEndpoint: '/api/references/specs' },

      { id: 'cashAccount', label: 'Счёт кассы', type: 'reference', group: 'main', referenceEndpoint: '/api/references/accounts' },
      { id: 'ddsArticle', label: 'Статья ДДС', type: 'reference', group: 'main', referenceEndpoint: '/api/references/dds-articles' },

      { id: 'cash', label: 'Касса', type: 'reference', group: 'main', referenceEndpoint: '/api/references/cashes' },
      { id: 'documentAmount', label: 'Сумма документа', type: 'money', group: 'main' },

      // === Табличная секция (вкладки) ===
      { id: 'accountingAccount', label: 'Счёт учёта', type: 'reference', group: 'tab:payment_from_buyer', referenceEndpoint: '/api/references/accounts' },
      { id: 'advanceAccount', label: 'Счёт авансов', type: 'reference', group: 'tab:payment_from_buyer', referenceEndpoint: '/api/references/accounts' },
      { id: 'counterparty', label: 'Контрагент', type: 'reference', group: 'tab:payment_from_buyer', referenceEndpoint: '/api/references/counterparties' },
      { id: 'counterpartyContract', label: 'Договор контрагента', type: 'reference', group: 'tab:payment_from_buyer', referenceEndpoint: '/api/references/contracts' },

      // === Нижняя секция ===
      { id: 'comment', label: 'Комментарий', type: 'text', group: 'footer' },
      { id: 'responsible', label: 'Ответственный', type: 'reference', group: 'footer', referenceEndpoint: '/api/references/employees' },
    ],

    // Описание вкладок
    tabs: [
      { id: 'payment_from_buyer', label: 'Оплата от покупателя' },
      { id: 'print', label: 'Печать' },
    ],
  },
}

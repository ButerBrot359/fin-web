/**
 * ЕДИНСТВЕННАЯ клиентская команда контракта SDUI (конструктор дизайна Ф4):
 * пункт «Ещё → Изменить форму» приходит с бэка обычной MENU_ITEM-нодой, но
 * диалог целиком клиентский — dispatch перехватывает команду ДО транспорта,
 * серверного хендлера у неё нет. Это контрактная константа (зеркало
 * `CommandIds.CUSTOMIZE_FORM` бэка), а не разбор имён команд.
 */
export const CUSTOMIZE_FORM_COMMAND = 'view.customizeForm'

/**
 * «Изменить форму для всех» (конструктор дизайна Ф5): вторая клиентская
 * команда контракта — тот же диалог, но пишет админский дефолт экрана
 * (`/api/view-settings-defaults`). Пункт эмитится бэком только
 * административным ролям; зеркало `CommandIds.CUSTOMIZE_FORM_DEFAULT`.
 */
export const CUSTOMIZE_FORM_DEFAULT_COMMAND = 'view.customizeFormDefault'

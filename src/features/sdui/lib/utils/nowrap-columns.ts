/**
 * Колонки ТЧ, в которых перенос текста ОТКЛЮЧЁН.
 *
 * <p>По умолчанию ячейка ТЧ переносит длинное значение по ширине колонки
 * (`readonlyCellTextStyle` и multiline-редакторы в `table-cell-editor.tsx`) —
 * иначе оно вылезает поверх соседней колонки. У колонок ниже это правило даёт
 * обратный эффект: значения длинные по своей природе (ФИО, наименование
 * должности, «Целевые текущие трансферты из областного бюджета…»), и перенос
 * раздувает КАЖДУЮ строку ТЧ на три-четыре текстовых строки. В эталоне 1С эти
 * колонки идут в одну строку с многоточием — значение опознают по началу.
 *
 * <p>Состав списка — шапка ТЧ «Начисления» документа «Начисление зарплаты
 * сотрудникам» в эталоне 1С; те же колонки с теми же именами есть в ТЧ других
 * документов и справочников, и правило для них общее.
 */

/**
 * Совпадение по НАЧАЛУ биндинга (имя реквизита 1С в транслитерации бэка):
 * `Отработано` приезжает как `OtrabotanoDney`/`OtrabotanoChasov`,
 * `Подразделение` — как `PodrazdelenieOrganizatsii`, «Источник финансирования»
 * в ТЧ движений бухрегистра — как `IstochnikFinansirovaniyaDt`/`Kt`.
 */
const NOWRAP_BINDING_PREFIXES = [
  'istochnikfinansirovaniya',
  'sotrudnik',
  'periodregistratsii',
  'podrazdelenie',
  'dolzhnost',
  'vidnachisleniya',
  'planovyyoklad',
  'grafikraboty',
  'normadney',
  'normachasov',
  'otrabotano',
  'nachaloperioda',
  'okonchanieperioda',
  'normativnayanagruzka',
  'nedelnayanagruzka',
  'razmer',
]

/**
 * Те же колонки по ПОДПИСИ — второй ключ, а не дубль списка выше.
 *
 * <p>Биндинг бэк отдаёт транслитерацией 1С-имени, и её правила у части
 * реквизитов неочевидны («ПлановыйОклад» → `PlanovyyOklad`?). Промах в
 * транслитерации молча вернул бы колонке перенос, поэтому колонка опознаётся
 * ещё и по русской подписи — ровно по той, что видит пользователь в шапке ТЧ.
 * Подпись менее стабильна (бэк может её переименовать, в казахской локали она
 * другая), поэтому она именно ДОПОЛНЯЕТ биндинг, а не заменяет его.
 */
const NOWRAP_LABEL_PREFIXES = [
  'источник финансирования',
  'сотрудник',
  'период регистрации',
  'подразделение',
  'должность',
  'вид начисления',
  'плановый оклад',
  'график работы',
  'норма дней',
  'норма часов',
  'отработано',
  'начало периода',
  'окончание периода',
  'нормативная нагрузка',
  'недельная нагрузка',
  'размер',
]

/** Регистр и «ё» подписи бэка не фиксированы — сравниваем нормализованное. */
function normalize(value: string): string {
  return value.toLowerCase().replaceAll('ё', 'е').trim()
}

function matches(value: string, prefixes: string[]): boolean {
  const normalized = normalize(value)
  return normalized !== '' && prefixes.some((p) => normalized.startsWith(p))
}

/** true — колонке перенос текста не нужен: одна строка с многоточием. */
export function isNoWrapColumn(binding: string, label?: string): boolean {
  return (
    matches(binding, NOWRAP_BINDING_PREFIXES) ||
    (label !== undefined && matches(label, NOWRAP_LABEL_PREFIXES))
  )
}

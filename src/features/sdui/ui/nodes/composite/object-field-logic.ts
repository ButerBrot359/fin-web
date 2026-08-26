/**
 * Чистая логика OBJECT_FIELD (SCRUM-268 §3.2).
 *
 * Развилка имён (§2.5 контракта): DomainKind во ВХОДЯЩЕМ значении лежит под
 * ключом `domain`, в ИСХОДЯЩЕМ — под ключом `type`. Виджет не читает ни то,
 * ни другое: из входящего значения читается ТОЛЬКО `targetTypeCode` — он
 * round-trip'ится и различает same-domain членов (Владелец: Организации |
 * Контрагенты — оба DICTIONARY).
 */

export interface ObjectValue {
  id: number
  presentation: string
  /** DomainKind — только ПИШЕТСЯ при эмите. Из входящего значения не читается. */
  type?: string
  /**
   * Заполнен для ссылочных членов; у члена без цели (примитив) его физически нет,
   * см. `AllowedType.targetTypeCode`. Необязательность — не послабление контракта,
   * а признание факта: `buildObjectValue` копирует код члена, и обязательный тип
   * здесь лишь скрывал, что у примитивного члена копировать нечего (SCRUM-279).
   * Сервер такой случай различает: при однозначном домене ему достаточно `type`.
   */
  targetTypeCode?: string
}

export interface AllowedType {
  position: number
  domainKind: string
  /**
   * Есть только у ССЫЛОЧНЫХ членов. У примитивных (BOOLEAN/STRING/DECIMAL/
   * DATETIME) бэк присылает лишь `{position, domainKind}` — цель ссылки им не
   * положена. Раньше поле было объявлено обязательным, то есть тип обещал больше,
   * чем даёт провод (SCRUM-279).
   */
  targetTypeCode?: string
  /** Тоже только у ссылочных членов — примитивам бэк подпись не резолвит. */
  presentation?: string
  optionsSource?: { url: string; params?: Record<string, string> }
}

export function sortAllowedTypes(types: AllowedType[]): AllowedType[] {
  return [...types].sort((a, b) => a.position - b.position)
}

/**
 * Устойчивый идентификатор члена составного типа (SCRUM-279).
 *
 * `targetTypeCode` различает только ССЫЛОЧНЫХ членов. У примитивных его нет: бэк
 * отдаёт `{position, domainKind}` без `targetTypeCode` и без `presentation` —
 * примитивам он намеренно не резолвит ни цель, ни `optionsSource` (см.
 * `CompositeFieldPropsResolver.isOptionsSourceEligible`). У реального поля
 * «Значение» доп.реквизитов физлица таких членов ЧЕТЫРЕ из семи (BOOLEAN,
 * STRING, DATETIME, DECIMAL), то есть выбор «по targetTypeCode» для них не
 * работает в принципе: члены неразличимы, а React-ключи в списке совпадают.
 *
 * Ключ = `targetTypeCode`, если он есть, иначе `domainKind#position`. `position`
 * бэк присваивает подряд в порядке «|» исходного составного типа 1С, поэтому
 * ключ стабилен между запросами.
 */
export function memberKey(type: AllowedType): string {
  return type.targetTypeCode ?? `${type.domainKind}#${String(type.position)}`
}

export function findMemberByKey(
  allowedTypes: AllowedType[],
  key: string | undefined
): AllowedType | undefined {
  if (!key) return undefined
  return allowedTypes.find((t) => memberKey(t) === key)
}

/**
 * Тот же приоритет, что в `resolveSelectedTypeCode` (тип из значения → ручной
 * выбор → первый член), но в терминах `memberKey` — поэтому работает и для
 * примитивных членов. Из ВХОДЯЩЕГО значения по-прежнему читается только
 * `targetTypeCode` (§2.5 контракта): значения примитивных членов бэк на запись
 * не принимает, различать их в значении нечего.
 */
export function resolveSelectedMemberKey(
  allowedTypes: AllowedType[],
  value: ObjectValue | null | undefined,
  userKey: string | undefined
): string | undefined {
  const fromValue = findAllowedType(allowedTypes, value?.targetTypeCode)
  if (fromValue) return memberKey(fromValue)
  if (findMemberByKey(allowedTypes, userKey)) return userKey
  return allowedTypes[0] ? memberKey(allowedTypes[0]) : undefined
}

export function findAllowedType(
  allowedTypes: AllowedType[],
  typeCode: string | undefined
): AllowedType | undefined {
  if (!typeCode) return undefined
  return allowedTypes.find((t) => t.targetTypeCode === typeCode)
}

/**
 * Приоритет: targetTypeCode из значения (если он ∈ allowedTypes) →
 * ручной выбор пользователя → первый член (allowedTypes уже отсортированы).
 */
export function resolveSelectedTypeCode(
  allowedTypes: AllowedType[],
  value: ObjectValue | null | undefined,
  userTypeCode: string | undefined
): string | undefined {
  if (
    value?.targetTypeCode &&
    findAllowedType(allowedTypes, value.targetTypeCode)
  ) {
    return value.targetTypeCode
  }
  if (findAllowedType(allowedTypes, userTypeCode)) {
    return userTypeCode
  }
  return allowedTypes[0]?.targetTypeCode
}

export function buildObjectValue(
  member: AllowedType,
  option: { id: number | string; label: string }
): ObjectValue {
  return {
    id: Number(option.id),
    presentation: option.label,
    type: member.domainKind,
    targetTypeCode: member.targetTypeCode,
  }
}

/**
 * Отпечаток набора членов — признак «сервер перерешил, каким бывает это поле».
 *
 * Смена счёта в шапке/строке перестраивает вид субконто: приходит патч props с
 * другим `allowedTypes`. Ручной выбор члена и уже выбранное значение к новому
 * набору отношения не имеют — прежнего члена в нём может не быть вовсе, поэтому
 * оба сбрасываются. Сравниваем по составу, а не по ссылке: патч пересобирает
 * массив даже когда набор тот же, и сброс на каждый чужой патч был бы шумом.
 */
export function membersSignature(types: AllowedType[]): string {
  return types.map(memberKey).join('|')
}

/**
 * Значение всё ещё принадлежит одному из членов?
 *
 * Значение без `targetTypeCode` (примитивные члены) не трогаем: различать их в
 * значении нечем, а бэк такие на запись и не принимает — чистить нечего.
 */
export function isValueAllowed(
  allowedTypes: AllowedType[],
  value: ObjectValue | null | undefined
): boolean {
  if (!value?.targetTypeCode) return true
  return findAllowedType(allowedTypes, value.targetTypeCode) !== undefined
}

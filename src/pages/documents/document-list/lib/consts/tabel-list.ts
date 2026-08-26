// SCRUM-276 spec v2: список Табеля приводится к наблюдаемому 1С-эталону.
// Всё Tabel-специфичное включается только по коду типа — прочие document
// types эти константы не читают.

export const TABEL_TYPE_CODE = 'Tabel'

/** Тип строки ТЧ — источник metadata для критерия «Сотрудник» (spec §3.1). */
export const TABEL_ROW_TYPE_CODE = 'Tabel_UchetRabochegoVremeni'

/** Поля критериев в 1С-порядке: Организация, Сотрудник, Подразделение (§3.1). */
export const TABEL_CRITERIA = [
  { field: 'Organizatsiya', source: 'header' },
  { field: 'Sotrudnik', source: 'row' },
  { field: 'PodrazdelenieOrganizatsii', source: 'header' },
] as const

/**
 * 1С-порядок колонок (§3.2): Дата, Номер, Организация, Подразделение,
 * Период регистрации, Комментарий, Ответственный; «Ссылка» замыкает список.
 * Неизвестные коды сохраняют относительный порядок metadata после известных.
 */
export const TABEL_COLUMN_ORDER = [
  'Data',
  'Nomer',
  'Organizatsiya',
  'PodrazdelenieOrganizatsii',
  'PeriodRegistratsii',
  'Kommentariy',
  'Otvetstvennyy',
]

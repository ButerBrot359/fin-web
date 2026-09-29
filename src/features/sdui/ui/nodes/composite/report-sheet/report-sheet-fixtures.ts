// Тестовые данные сетки report-sheet/v1. Базовый payload — ФАКТИЧЕСКИЙ пример
// из handoff (frontend-handoff-konstruktor-report-sheet.md, тест бэка
// UniversalnyyReglamentirovannyyOtchetViewFormHandlerTest), расширенный
// вычисляемой ячейкой, ручной правкой и строкой раскрытия. Только для тестов.

import type { ViewNode } from '../../../../types/view'

export const REPORT_SHEET_NODE: ViewNode = {
  id: 'table.reportSheet',
  type: 'TABLE',
  binding: 'ReportSheet',
  props: {
    tablePresentation: 'REPORT_SHEET',
    tableWireVersion: 'report-sheet/v1',
    formValue: true,
    editable: true,
    label: 'Сетка отчёта',
  },
  actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
}

/** Payload ровно из handoff (§«Фактический пример payload»). */
export const HANDOFF_PAYLOAD = {
  grafy: [
    { kod: '3', nameRu: 'На начало отчётного периода', nomerPechatnoyGrafy: 3 },
    { kod: '4', nameRu: 'На конец отчётного периода', nomerPechatnoyGrafy: 4 },
  ],
  stroki: [
    {
      kod: '010',
      nameRu: 'Нефинансовые активы',
      uroven: 1,
      isGroup: true,
      cells: [],
      raskrytie: [],
    },
    {
      kod: '111',
      nameRu: 'Основные средства',
      uroven: 2,
      isGroup: false,
      cells: [
        {
          pokazatelId: 4501,
          kod: 'стр_111_3',
          kolonkaKod: '3',
          indeks: 0,
          znachenie: 120000,
          syroe: 120000,
          vid: 'ZAPOLNYAEMYY',
          redaktiruemaya: true,
          izmenenoVruchnuyu: false,
        },
        {
          pokazatelId: 4502,
          kod: 'стр_111_4',
          kolonkaKod: '4',
          indeks: 0,
          znachenie: 135000,
          syroe: 135000,
          vid: 'ZAPOLNYAEMYY',
          redaktiruemaya: true,
          izmenenoVruchnuyu: false,
        },
      ],
      raskrytie: [],
    },
  ],
  generation: 0,
}

/**
 * Расширенный payload: итог 199 — вычисляемый и только в графе 4 (в графе 3
 * показателя нет), у строки 112 правленая вручную ячейка и раскрытие.
 */
export const RICH_PAYLOAD = {
  grafy: HANDOFF_PAYLOAD.grafy,
  stroki: [
    ...HANDOFF_PAYLOAD.stroki,
    {
      kod: '112',
      nameRu: 'Нематериальные активы',
      uroven: 2,
      isGroup: false,
      cells: [
        {
          pokazatelId: 4511,
          kod: 'стр_112_3',
          kolonkaKod: '3',
          indeks: 0,
          znachenie: '5000.5',
          syroe: '5000.5',
          vid: 'ZAPOLNYAEMYY',
          redaktiruemaya: true,
          izmenenoVruchnuyu: true,
        },
      ],
      raskrytie: [
        {
          indeks: 1,
          cells: [
            {
              pokazatelId: 4511,
              kod: 'стр_112_3',
              kolonkaKod: '3',
              indeks: 1,
              znachenie: 3000,
              syroe: 3000,
              vid: 'ZAPOLNYAEMYY',
              redaktiruemaya: true,
              izmenenoVruchnuyu: false,
            },
          ],
        },
      ],
    },
    {
      kod: '199',
      nameRu: 'Итого нефинансовых активов',
      uroven: 1,
      isGroup: false,
      cells: [
        {
          pokazatelId: 4599,
          kod: 'стр_199_4',
          kolonkaKod: '4',
          indeks: 0,
          znachenie: 140000.5,
          syroe: 140000.5,
          vid: 'VYCHISLYAEMYY',
          redaktiruemaya: true,
          izmenenoVruchnuyu: false,
        },
      ],
      raskrytie: [],
    },
  ],
  generation: 7,
}

export const EMPTY_PAYLOAD = { grafy: [], stroki: [], generation: 0 }

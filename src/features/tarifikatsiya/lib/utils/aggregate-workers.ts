import type { ConsolidatedWorkerRow } from '../../types/consolidated'

interface RabotnikRef {
  id?: number | string
  displayName?: string
  nameRu?: string
}

interface DannyeRow {
  Rabotnik?: RabotnikRef | null
  Dolzhnost?: { nameRu?: string } | null
  [key: string]: unknown
}

interface NachisleniyaRow {
  Rabotnik?: RabotnikRef | null
  Rezultat?: number | null
  EtoNadbavka?: boolean | null
  [key: string]: unknown
}

interface DopNachisleniyaRow {
  Rabotnik?: RabotnikRef | null
  Rezultat?: number | null
  [key: string]: unknown
}

const getRabotnikId = (ref: RabotnikRef | null | undefined): string | null =>
  ref?.id != null ? String(ref.id) : null

const getRabotnikName = (ref: RabotnikRef | null | undefined): string =>
  ref?.displayName ?? ref?.nameRu ?? ''

export const aggregateWorkers = (
  dannyeRabotnikov: DannyeRow[],
  nachisleniya: NachisleniyaRow[],
  dopNachisleniya: DopNachisleniyaRow[]
): ConsolidatedWorkerRow[] => {
  const workerMap = new Map<string, { name: string; dolzhnost: string }>()

  for (const row of dannyeRabotnikov) {
    const id = getRabotnikId(row.Rabotnik)
    if (!id) continue
    if (!workerMap.has(id)) {
      workerMap.set(id, {
        name: getRabotnikName(row.Rabotnik),
        dolzhnost: row.Dolzhnost?.nameRu ?? '',
      })
    }
  }

  const tarifMap = new Map<string, number>()
  const nadbavkiMap = new Map<string, number>()

  for (const row of nachisleniya) {
    const id = getRabotnikId(row.Rabotnik)
    if (!id) continue
    const rezultat = row.Rezultat ?? 0
    if (row.EtoNadbavka) {
      nadbavkiMap.set(id, (nadbavkiMap.get(id) ?? 0) + rezultat)
    } else {
      tarifMap.set(id, (tarifMap.get(id) ?? 0) + rezultat)
    }
    if (!workerMap.has(id)) {
      workerMap.set(id, { name: getRabotnikName(row.Rabotnik), dolzhnost: '' })
    }
  }

  const dopMap = new Map<string, number>()
  for (const row of dopNachisleniya) {
    const id = getRabotnikId(row.Rabotnik)
    if (!id) continue
    dopMap.set(id, (dopMap.get(id) ?? 0) + (row.Rezultat ?? 0))
    if (!workerMap.has(id)) {
      workerMap.set(id, { name: getRabotnikName(row.Rabotnik), dolzhnost: '' })
    }
  }

  const rows: ConsolidatedWorkerRow[] = []
  for (const [id, worker] of workerMap) {
    const tarifnayaStavka = tarifMap.get(id) ?? 0
    const nadbavki = nadbavkiMap.get(id) ?? 0
    const mesyachnyFot = tarifnayaStavka + nadbavki
    const dopolnitelnyFot = dopMap.get(id) ?? 0

    rows.push({
      rabotnikId: id,
      rabotnikName: worker.name,
      dolzhnost: worker.dolzhnost,
      tarifnayaStavka,
      nadbavki,
      mesyachnyFot,
      dopolnitelnyFot,
      itogoFot: mesyachnyFot + dopolnitelnyFot,
    })
  }

  return rows
}

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchActiveTasks, isActiveTask } from '@/entities/async-task'

// Неспешный опрос: значок в списке — вторичная индикация, живёт только пока
// страница открыта (хук размонтируется вместе с ней)
export const POSTING_TASKS_POLL_MS = 7000

/**
 * id записей ТЕКУЩЕГО типа, по которым прямо сейчас идёт фоновая задача
 * (SCRUM-330): значок «проводится» в легаси-списке. Чисто клиентское
 * сопоставление targetTypeCode+targetEntryId активных задач с загруженными
 * строками — контракт списка с бэка не меняется. Ключ запроса общий с бейджем
 * «Мои операции» (['background-tasks','active']): запросы дедуплицируются, а
 * инвалидация после 202 в тулбаре зажигает значок, не дожидаясь опроса.
 */
export function usePostingEntryIds(typeCode: string): Set<number> {
  const { data } = useQuery({
    queryKey: ['background-tasks', 'active'],
    queryFn: fetchActiveTasks,
    refetchInterval: POSTING_TASKS_POLL_MS,
  })

  // Стабилизация: Set пересоздаётся только при смене СОСТАВА id, а не на каждый
  // тик опроса — иначе колонки таблицы пересобирались бы каждые 7 секунд
  const idsKey = (data ?? [])
    .filter(
      (task) =>
        isActiveTask(task) &&
        task.targetTypeCode === typeCode &&
        task.targetEntryId != null
    )
    .map((task) => String(task.targetEntryId))
    .sort()
    .join(',')

  return useMemo(
    () => new Set(idsKey === '' ? [] : idsKey.split(',').map(Number)),
    [idsKey]
  )
}

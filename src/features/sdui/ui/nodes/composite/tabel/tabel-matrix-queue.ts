import {
  useGenerationCommandQueue,
  type GenerationCommandBuilder,
  type GenerationCommandQueue,
} from '../../../../lib/hooks/use-generation-command-queue'
import {
  parseTabelMatrixPayload,
  type TabelMatrixCommand,
  type TabelMatrixPayload,
} from './tabel-matrix-contract'

type TabelCommandBody =
  | Omit<TabelMatrixCommand, 'baseGeneration'>
  | TabelMatrixCommand

/**
 * Билдер команды матрицы: вызывается В ГОЛОВЕ очереди с АКТУАЛЬНЫМ payload —
 * его generation и есть валидный baseGeneration (правило конкурентности
 * spec v1 §4). Вернуть null — отменить команду.
 */
export type TabelCommandBuilder = GenerationCommandBuilder<
  TabelMatrixPayload,
  TabelCommandBody
>

export type TabelMatrixQueue = GenerationCommandQueue<
  TabelMatrixPayload,
  TabelCommandBody
>

/**
 * Сериализатор матричных мутаций (spec v1 §4) — общая generation-очередь
 * SDUI с адресом `<nodeId>.matrix` (семантический suffix матрицы Табеля).
 */
export function useTabelMatrixQueue(
  nodeId: string,
  binding: string
): TabelMatrixQueue {
  return useGenerationCommandQueue<TabelMatrixPayload, TabelCommandBody>({
    sourceNodeId: `${nodeId}.matrix`,
    binding,
    parse: parseTabelMatrixPayload,
  })
}

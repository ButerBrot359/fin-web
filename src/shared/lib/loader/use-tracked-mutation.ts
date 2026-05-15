import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'

import { useLoaderStore } from './loader-store'

// TODO (фаза 2):
//  - опция `cancellable` с AbortController (для AI/печати)
//  - таймаут N секунд → показывать подпись «Операция выполняется дольше обычного…»

export function useTrackedMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const increment = useLoaderStore((state) => state.increment)
  const decrement = useLoaderStore((state) => state.decrement)

  const wrapped: UseMutationOptions<TData, TError, TVariables, TContext> = {
    ...options,
    onMutate: async (variables, context) => {
      increment()
      if (options.onMutate) {
        return await options.onMutate(variables, context)
      }
      return undefined as TContext
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      decrement()
      await options.onSettled?.(
        data,
        error,
        variables,
        onMutateResult,
        context
      )
    },
  }

  return useMutation<TData, TError, TVariables, TContext>(wrapped)
}

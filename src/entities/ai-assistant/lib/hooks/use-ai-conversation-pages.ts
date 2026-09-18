import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { aiAssistantApi } from '../../api/ai-assistant-api'
import type { AiConversation } from '../../types/conversation'
import { aiAssistantKeys } from '../query-keys'

export function useAiConversationPages() {
  const query = useInfiniteQuery({
    queryKey: [...aiAssistantKeys.conversations(), 'pages', 10],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) =>
      aiAssistantApi.getConversationPage(pageParam, signal),
    getNextPageParam: (page) => (page.hasMore ? page.nextBeforeId : undefined),
    refetchOnWindowFocus: false,
  })
  const conversations = useMemo(() => {
    const unique = new Map<number, AiConversation>()
    for (const page of query.data?.pages ?? []) {
      for (const conversation of page.conversations)
        unique.set(conversation.id, conversation)
    }
    return [...unique.values()]
  }, [query.data])
  return {
    conversations,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetching)
        void query.fetchNextPage({ cancelRefetch: false })
    },
    retry: () => {
      void query.refetch()
    },
  }
}

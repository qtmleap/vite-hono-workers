import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { charactersQueryKey } from '@/hooks/useCharacters'
import { getCharacters } from '@/lib/characters'
import { RankingClient } from './ranking-client'

// SSR: リクエストごとにレンダリング
export const dynamic = 'force-dynamic'

/**
 * ランキングページ（Server Component）
 */
const RankingPage = async () => {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: charactersQueryKey,
    queryFn: getCharacters
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RankingClient />
    </HydrationBoundary>
  )
}

export default RankingPage

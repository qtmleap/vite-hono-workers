import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { charactersQueryKey } from '@/hooks/useCharacters'
import { getCharacters } from '@/lib/characters'
import { HomeClient } from './home-client'

/**
 * ホームページ（Server Component）
 * ビルド時にキャラクターデータをprefetchしてSSG
 */
const HomePage = async () => {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: charactersQueryKey,
    queryFn: getCharacters
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeClient />
    </HydrationBoundary>
  )
}

export default HomePage

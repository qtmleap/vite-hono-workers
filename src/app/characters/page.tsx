import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { charactersQueryKey } from '@/hooks/useCharacters'
import { getCharacters } from '@/lib/characters'
import { CharactersClient } from './characters-client'

/**
 * キャラクター一覧ページ（Server Component）
 */
const CharactersPage = async () => {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: charactersQueryKey,
    queryFn: getCharacters
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CharactersClient />
    </HydrationBoundary>
  )
}

export default CharactersPage

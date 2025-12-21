import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { charactersQueryKey } from '@/hooks/useCharacters'
import { getCharacters } from '@/lib/characters'
import { CharacterDetailClient } from './character-detail-client'

type PageProps = {
  params: Promise<{ id: string }>
}

/**
 * ビルド時に全キャラクターのIDを生成（SSG）
 */
export const generateStaticParams = async () => {
  const characters = await getCharacters()
  return characters.map((character) => ({
    id: character.key
  }))
}

/**
 * キャラクター詳細ページ（Server Component）
 */
const CharacterDetailPage = async ({ params }: PageProps) => {
  const { id } = await params
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: charactersQueryKey,
    queryFn: getCharacters
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CharacterDetailClient id={id} />
    </HydrationBoundary>
  )
}

export default CharacterDetailPage

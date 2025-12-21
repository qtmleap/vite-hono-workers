import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { charactersQueryKey } from '@/hooks/useCharacters'
import { getCharacters } from '@/lib/characters'
import { CalendarClient } from './calendar-client'

/**
 * カレンダーページ（Server Component）
 * ビルド時にキャラクターデータをprefetchしてSSG
 */
const CalendarPage = async () => {
  const queryClient = new QueryClient()

  // サーバーサイドでキャラクターデータをprefetch
  await queryClient.prefetchQuery({
    queryKey: charactersQueryKey,
    queryFn: getCharacters
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarClient />
    </HydrationBoundary>
  )
}

export default CalendarPage

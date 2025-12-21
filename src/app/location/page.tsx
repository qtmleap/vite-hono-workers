import { Suspense } from 'react'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { LoadingFallback } from '@/components/common/loading-fallback'
import { charactersQueryKey } from '@/hooks/useCharacters'
import { getCharacters } from '@/lib/characters'
import { LocationClient } from './location-client'

/**
 * ロケーションページ（Server Component）
 */
const LocationPage = async () => {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: charactersQueryKey,
    queryFn: getCharacters
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<LoadingFallback />}>
        <LocationClient />
      </Suspense>
    </HydrationBoundary>
  )
}

export default LocationPage

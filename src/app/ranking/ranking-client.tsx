'use client'

import { Suspense } from 'react'
import { LoadingFallback } from '@/components/common/loading-fallback'
import { RankingList } from '@/components/ranking/ranking-list'
import { useCharacters } from '@/hooks/useCharacters'
import { useVoteRanking } from '@/hooks/useVoteRanking'

/**
 * ランキングコンテンツコンポーネント
 */
const RankingContent = () => {
  const { data: characters } = useCharacters()
  const { data: ranking } = useVoteRanking(characters)

  return (
    <div className='container mx-auto px-4 py-6 max-w-7xl'>
      <RankingList characters={ranking} />
    </div>
  )
}

/**
 * ランキングクライアントコンポーネント
 */
export const RankingClient = () => (
  <Suspense fallback={<LoadingFallback />}>
    <RankingContent />
  </Suspense>
)

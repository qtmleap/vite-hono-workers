'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { CharacterDetailContent } from '@/components/characters/character-detail-content'
import { LoadingFallback } from '@/components/common/loading-fallback'
import { Button } from '@/components/ui/button'
import { useCharacters } from '@/hooks/useCharacters'

type CharacterDetailClientProps = {
  id: string
}

/**
 * キャラクター詳細コンテンツ
 */
const CharacterDetailPage = ({ id }: CharacterDetailClientProps) => {
  const { data: characters } = useCharacters()

  const character = useMemo(() => {
    return characters.find((c) => c.key === id)
  }, [characters, id])

  if (!character) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-destructive mb-4'>キャラクターが見つかりませんでした</p>
          <Link href='/characters'>
            <Button variant='outline'>
              <ArrowLeft className='h-4 w-4 mr-2' />
              一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <CharacterDetailContent character={character} />
}

/**
 * キャラクター詳細クライアントコンポーネント
 */
export const CharacterDetailClient = ({ id }: CharacterDetailClientProps) => (
  <Suspense fallback={<LoadingFallback />}>
    <CharacterDetailPage id={id} />
  </Suspense>
)

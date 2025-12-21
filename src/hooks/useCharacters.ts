import { useSuspenseQuery } from '@tanstack/react-query'
import { CharactersSchema } from '@/schemas/character.dto'

/**
 * キャラクター一覧取得用のクエリキー
 */
export const charactersQueryKey = ['characters'] as const

/**
 * クライアントサイドでキャラクター一覧を取得
 */
const fetchCharacters = async () => {
  const response = await fetch('/characters.json')
  if (!response.ok) {
    throw new Error('Failed to fetch characters')
  }
  const data = await response.json()
  return CharactersSchema.parse(data)
}

/**
 * キャラクター一覧を取得するカスタムフック
 * Suspenseと連携して使用
 * SSG時はHydrationBoundaryでprefetchされたデータを使用
 */
export const useCharacters = () => {
  return useSuspenseQuery({
    queryKey: charactersQueryKey,
    queryFn: fetchCharacters,
    staleTime: 1000 * 60 * 5 // 5分間キャッシュ
  })
}

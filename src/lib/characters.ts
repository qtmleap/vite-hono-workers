import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type Characters, CharactersSchema } from '@/schemas/character.dto'

/**
 * サーバーサイドでキャラクター一覧を取得
 * ビルド時・SSG時に使用
 */
export const getCharacters = async (): Promise<Characters> => {
  const filePath = join(process.cwd(), 'public', 'characters.json')
  const fileContent = await readFile(filePath, 'utf-8')
  const data = JSON.parse(fileContent)

  const result = CharactersSchema.safeParse(data)
  if (!result.success) {
    console.error('Character data validation failed:', result.error)
    throw new Error('Invalid character data')
  }

  return result.data
}

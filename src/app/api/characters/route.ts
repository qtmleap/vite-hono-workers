import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'
import { CharactersSchema } from '@/schemas/character.dto'

/**
 * キャラクター一覧取得
 * GET /api/characters
 */
export const GET = async (_request: NextRequest) => {
  try {
    const filePath = join(process.cwd(), 'public', 'characters.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContent)

    // Zodでバリデーション
    const result = CharactersSchema.safeParse(data)

    if (!result.success) {
      console.error('Character data validation failed:', result.error)
      return NextResponse.json({ error: 'Invalid character data' }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Failed to load characters:', error)
    return NextResponse.json({ error: 'Failed to load characters' }, { status: 500 })
  }
}

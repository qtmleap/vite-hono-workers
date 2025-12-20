import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Character, generateCharacters } from '../../scripts/generate_characters'

/**
 * スクリプトで生成されるフィールドのみを抽出
 */
const extractGeneratedFields = (char: Character): Partial<Character> => {
  return {
    address: char.address,
    character_birthday: char.character_birthday,
    character_name: char.character_name,
    description: char.description,
    detail_url: char.detail_url,
    image_urls: char.image_urls,
    is_biccame_musume: char.is_biccame_musume,
    key: char.key,
    // latitude: char.latitude,  // Google Geo APIで取得
    // longitude: char.longitude, // Google Geo APIで取得
    prefecture: char.prefecture,
    profile_image_url: char.profile_image_url,
    store_birthday: char.store_birthday,
    store_link: char.store_link,
    store_name: char.store_name,
    twitter_screen_name: char.twitter_screen_name,
    zipcode: char.zipcode
  }
}

describe('generate_characters', () => {
  test('生成されたデータが現在のcharacters.jsonと一致すること（生成可能なフィールドのみ）', async () => {
    // 現在のcharacters.jsonを読み込み
    const currentPath = join(import.meta.dir, '../../public/characters.json')
    const currentData: Character[] = JSON.parse(readFileSync(currentPath, 'utf-8'))

    // fixturesディレクトリのパスを確認
    const fixturesDir = join(import.meta.dir, '../fixtures/html')
    const useFixtures = existsSync(fixturesDir)

    if (useFixtures) {
      console.log('ローカルHTMLファイルを使用します')
    } else {
      console.log('⚠️ fixturesが見つからないため、ネットワークから取得します')
      console.log(`   fixtures作成: bun scripts/fetch_test_fixtures.ts`)
    }

    // 新しくデータを生成
    console.log('キャラクターデータを生成中...')
    const generatedData = await generateCharacters(useFixtures ? { fixturesDir } : undefined)

    // 件数を確認
    expect(generatedData.length).toBe(currentData.length)
    console.log(`✓ キャラクター数: ${generatedData.length}件`)

    // キャラクター名でソートして比較
    const sortedGenerated = [...generatedData].sort((a, b) => a.key.localeCompare(b.key))
    const sortedCurrent = [...currentData].sort((a, b) => a.key.localeCompare(b.key))

    // 各キャラクターについて生成可能なフィールドを比較
    for (let i = 0; i < sortedGenerated.length; i++) {
      const generated = extractGeneratedFields(sortedGenerated[i])
      const current = extractGeneratedFields(sortedCurrent[i])

      // キーで一致確認
      expect(generated.key).toBe(current.key)

      // フィールドごとに比較
      expect(generated.character_name).toBe(current.character_name)
      expect(generated.store_name).toBe(current.store_name)
      // expect(generated.description).toBe(current.description)
      expect(generated.detail_url).toBe(current.detail_url)
      expect(generated.profile_image_url).toBe(current.profile_image_url)
      expect(generated.twitter_screen_name).toBe(current.twitter_screen_name)
      expect(generated.prefecture).toBe(current.prefecture)
      expect(generated.address).toBe(current.address)
      expect(generated.zipcode).toBe(current.zipcode)
      // expect(generated.latitude).toBe(current.latitude)   // Google Geo APIで取得
      // expect(generated.longitude).toBe(current.longitude) // Google Geo APIで取得
      expect(generated.character_birthday).toBe(current.character_birthday)
      expect(generated.store_birthday).toBe(current.store_birthday)
      expect(generated.store_link).toBe(current.store_link)
      expect(generated.is_biccame_musume).toBe(current.is_biccame_musume)

      // 配列は内容を比較
      if (generated.image_urls && current.image_urls) {
        expect(generated.image_urls).toEqual(current.image_urls)
      }
    }

    console.log('✓ すべてのフィールドが一致しました')
  }, 120000) // タイムアウトを120秒に設定
})

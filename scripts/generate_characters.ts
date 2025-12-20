#!/usr/bin/env bun
/**
 * ビックカメ娘のcharacters.jsonを一発で生成するスクリプト
 * 1. プロフィールページから基本情報を取得
 * 2. 各詳細ページから追加情報を取得
 * 3. 都道府県情報を付与
 * 4. JSONキーをアルファベット順にソート
 * 5. public/characters.jsonに出力
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { fromPairs, sortBy } from 'lodash-es'
import jaconv from 'jaconv'

// =============================================================================
// 定数
// =============================================================================

/** 都道府県一覧 */
const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
] as const

/** 卒業したキャラクターの都道府県マッピング */
const GRADUATED_CHARACTERS: Record<string, string> = {
  kyoto: '京都府',
  funato: '千葉県',
  machida: '東京都',
  tamapla: '神奈川県',
  photo: '東京都',
  camera: '東京都',
  seiseki: '東京都'
}

/** Google Geocoding API キー（環境変数から取得） */
const GOOGLE_GEOCODING_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || ''

/** 卒業したキャラクターのキー一覧 */
const GRADUATED_KEYS = Object.keys(GRADUATED_CHARACTERS)

/** ビッカメ娘の関係者（ビックカメラ、ナイセン、ビックシム、お偉いたん） */
const EXCLUDED_KEYS = ['biccamera', 'naisen', 'bicsim', 'oeraitan']

// =============================================================================
// 型定義
// =============================================================================

/** 生成オプション */
interface GenerateOptions {
  /** フィクスチャディレクトリのパス（テスト用） */
  fixturesDir?: string
}

/** キャラクター情報 */
export interface Character {
  address?: string
  character_birthday?: string
  character_name: string
  description: string
  detail_url: string
  image_urls?: string[]
  is_biccame_musume?: boolean
  key: string
  latitude?: number
  longitude?: number
  prefecture?: string
  profile_image_url?: string
  store_birthday?: string
  store_link?: string
  store_name: string
  twitter_screen_name?: string
  zipcode?: string
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * 住所から都道府県を抽出
 */
const extractPrefecture = (address: string | undefined): string | null => {
  if (!address) return null

  for (const pref of PREFECTURES) {
    if (address.startsWith(pref)) {
      return pref
    }
  }

  return null
}

/** Geocoding APIレスポンスの型 */
interface GeocodingResult {
  latitude: number
  longitude: number
}

/**
 * Google Geocoding APIで住所から座標を取得
 */
const geocodeAddress = async (address: string): Promise<GeocodingResult | null> => {
  if (!GOOGLE_GEOCODING_API_KEY) {
    console.warn('  Warning: GOOGLE_GEOCODING_API_KEY is not set, skipping geocoding')
    return null
  }

  const encodedAddress = encodeURIComponent(address)
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_GEOCODING_API_KEY}&language=ja`

  try {
    const response = await fetch(url)
    const data = await response.json() as {
      status: string
      results: Array<{
        geometry: {
          location: {
            lat: number
            lng: number
          }
        }
      }>
    }

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return {
        latitude: location.lat,
        longitude: location.lng
      }
    }

    console.warn(`  Warning: Geocoding failed for "${address}": ${data.status}`)
    return null
  } catch (error) {
    console.error(`  Error geocoding "${address}":`, error)
    return null
  }
}

/**
 * オブジェクトのキーをアルファベット順にソート
 */
const sortObjectKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
  const sortedEntries = sortBy(Object.entries(obj), ([key]) => key)
  return fromPairs(sortedEntries)
}

/**
 * 相対パスを絶対URLに変換
 */
const toAbsoluteUrl = (path: string, baseUrl = 'https://biccame.jp'): string => {
  if (path.startsWith('http')) return path
  return path.startsWith('/') ? `${baseUrl}${path}` : path
}

/** Twitterスクリーンネームとして無効な値 */
const INVALID_TWITTER_NAMES = ['share', 'widgets', 'search']

/**
 * URLからTwitterスクリーンネームを抽出
 */
const extractTwitterScreenName = (url: string): string | null => {
  const match = url.match(/twitter\.com\/([a-zA-Z0-9_]+)/)
  if (match && !INVALID_TWITTER_NAMES.includes(match[1])) {
    return match[1]
  }
  return null
}

/**
 * HTMLを取得（ローカルファイル優先）
 */
const fetchHTML = async (url: string, localPath?: string): Promise<string> => {
  // ローカルファイルが存在する場合はそれを使用
  const html = localPath && existsSync(localPath)
    ? readFileSync(localPath, 'utf-8')
    : await (await fetch(url)).text()

  // 全角英数字・記号を半角に変換（カタカナは変換しない）
  return jaconv.toHanAscii(html)
}

// =============================================================================
// HTMLパーサー関数
// =============================================================================

/**
 * トップページからTwitterアカウント情報を取得
 */
const fetchTwitterAccounts = async (options?: GenerateOptions): Promise<Map<string, string>> => {
  const twitterAccounts = new Map<string, string>()
  const topUrl = 'https://biccame.jp/'
  const topPath = options?.fixturesDir ? join(options.fixturesDir, 'top.html') : undefined

  try {
    const html = await fetchHTML(topUrl, topPath)
    const dom = new JSDOM(html)
    const document = dom.window.document

    // キャラクター一覧からTwitterリンクを取得
    const twitterLinks = document.querySelectorAll('a[href*="twitter.com/"]')
    for (const link of twitterLinks) {
      const href = link.getAttribute('href') || ''
      const screenName = extractTwitterScreenName(href)
      if (screenName) {
        // リンク元のキャラクター情報を特定
        const parent = link.closest('div') || link.parentElement
        if (parent) {
          const profileLink = parent.querySelector('a[href*="/profile/"]')
          if (profileLink) {
            const profileHref = profileLink.getAttribute('href') || ''
            const keyMatch = profileHref.match(/\/profile\/([^/.]+)\.html/)
            if (keyMatch) {
              twitterAccounts.set(keyMatch[1], screenName)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch Twitter accounts from top page:', error)
  }

  return twitterAccounts
}

/**
 * キャラクター情報を解析
 */
const parseCharacterInfo = (html: string): Partial<Character>[] => {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const characters: Partial<Character>[] = []

  const profileNameDivs = document.querySelectorAll('div.profile_name')

  for (const nameDiv of profileNameDivs) {
    if (nameDiv.getAttribute('align') === 'center') {
      continue
    }

    const character: Partial<Character> = {}

    // キャラクター名（半角括弧に統一、重複を省略）
    const rawName = (nameDiv.textContent?.trim() || '').replace(/\(\s*([^)]+?)\s*\)/g, '/$1')
    const parts = rawName.split('/')
    character.character_name = (parts.length === 2 && parts[0] === parts[1]) ? parts[0] : rawName

    const parent = nameDiv.parentElement
    if (parent) {
      // 店舗名（「ビックカメラ」を削除して空白を正規化）
      const shopDiv = parent.querySelector('div.profile_shop')
      if (shopDiv) {
        const rawStoreName = shopDiv.textContent?.trim().replace(/\s+/g, ' ') || ''
        character.store_name = rawStoreName.replace(/ビックカメラ/g, '').trim()
      }

      const grandparent = parent.parentElement
      if (grandparent) {
        // 詳細ページURL
        const detailLink = grandparent.querySelector('a[href*="/profile/"][href$=".html"]')
        if (detailLink) {
          const href = detailLink.getAttribute('href') || ''
          character.detail_url = toAbsoluteUrl(href)

          // キー抽出
          const keyMatch = href.match(/\/profile\/([^/]+)\.html/)
          if (keyMatch) {
            character.key = keyMatch[1]
          }
        }

        // 説明文（空白を正規化し、句読点後の空白を削除）
        const descElem = grandparent.querySelector('p')
        if (descElem) {
          const rawDesc = descElem.textContent?.trim().replace(/\s+/g, ' ') || ''
          character.description = rawDesc.replace(/([。、！？])\s+/g, '$1')
        }

        // Twitterスクリーンネーム
        const twitterLink = grandparent.querySelector('a[href*="twitter.com"]')
        if (twitterLink) {
          const twitterUrl = twitterLink.getAttribute('href') || ''
          const screenName = extractTwitterScreenName(twitterUrl)
          if (screenName) {
            character.twitter_screen_name = screenName
          }
        }

        // プロフィール画像
        const profileImg = grandparent.querySelector('img[src*="/profile/"][src$=".png"]')
        if (profileImg) {
          const imgUrl = profileImg.getAttribute('src') || ''
          character.profile_image_url = toAbsoluteUrl(imgUrl)
        }
      }
    }

    if (character.character_name) {
      characters.push(character)
    }
  }

  // 重複を除去
  const seenNames = new Set<string>()
  const uniqueCharacters: Partial<Character>[] = []

  for (const char of characters) {
    const name = char.character_name
    if (name && !seenNames.has(name)) {
      seenNames.add(name)
      uniqueCharacters.push(char)
    }
  }

  return uniqueCharacters
}

/**
 * 詳細ページから追加情報を取得
 */
const fetchDetailPage = async (url: string, localPath?: string): Promise<Partial<Character>> => {
  try {
    const html = await fetchHTML(url, localPath)
    const dom = new JSDOM(html)
    const document = dom.window.document
    const detailInfo: Partial<Character> = {}
    const infoText = document.body.textContent || ''

    // 住所（shop_infoから取得）
    const addressDivs = document.querySelectorAll('div.shop_info')
    for (const div of addressDivs) {
      const divText = div.textContent || ''
      if (divText.includes('〒')) {
        const zipcodeMatch = divText.match(/〒([\d\-]+)/)
        if (zipcodeMatch) {
          detailInfo.zipcode = zipcodeMatch[1].trim()
          // 郵便番号の後の住所部分を取得
          const addressPart = divText.substring(divText.indexOf(zipcodeMatch[0]) + zipcodeMatch[0].length)
          detailInfo.address = addressPart.trim().split('\n')[0].trim()

          // 住所から都道府県を抽出
          if (detailInfo.address) {
            const prefecture = extractPrefecture(detailInfo.address)
            if (prefecture) {
              detailInfo.prefecture = prefecture
            }
          }
          break
        }
      }
    }

    // キャラクター誕生日（複数パターンに対応）
    const birthdayPatterns = [
      /誕生日[：:]\s*(\d+)月(\d+)日/,
      /生年月日[：:]\s*(\d+)月(\d+)日/,
      /Birthday[：:]\s*(\d+)月(\d+)日/i
    ]

    for (const pattern of birthdayPatterns) {
      const birthdayMatch = infoText.match(pattern)
      if (birthdayMatch) {
        const month = birthdayMatch[1].padStart(2, '0')
        const day = birthdayMatch[2].padStart(2, '0')
        detailInfo.character_birthday = `2015-${month}-${day}`
        break
      }
    }

    // 店舗誕生日
    const shopInfoDivs = document.querySelectorAll('div.shop_info')
    for (const div of shopInfoDivs) {
      const divText = div.textContent || ''
      if (divText.includes('店舗誕生日')) {
        const storeBirthdayMatch = divText.match(/(\d{4})年(\d{2})月(\d{2})日/)
        if (storeBirthdayMatch) {
          detailInfo.store_birthday = `${storeBirthdayMatch[1]}-${storeBirthdayMatch[2]}-${storeBirthdayMatch[3]}`
          break
        }
      }
    }

    // 店舗リンク
    const storeLink = document.querySelector('a[href*="shoplist"]')
    if (storeLink) {
      const href = storeLink.getAttribute('href') || ''
      detailInfo.store_link = toAbsoluteUrl(href, 'http://www.biccamera.co.jp')
    }

    // Twitterスクリーンネーム（詳細ページから取得）
    const twitterLink = document.querySelector('a[href*="twitter.com/"]')
    if (twitterLink) {
      const twitterUrl = twitterLink.getAttribute('href') || ''
      const screenName = extractTwitterScreenName(twitterUrl)
      if (screenName) {
        detailInfo.twitter_screen_name = screenName
      }
    }

    // 画像URL
    const images = document.querySelectorAll('img[src*="/profile/"][src$=".png"]')
    const imageUrls = [...images]
      .map((img) => toAbsoluteUrl(img.getAttribute('src') || ''))
      .filter((url, index, self) => self.indexOf(url) === index)

    if (imageUrls.length > 0) {
      detailInfo.image_urls = imageUrls
    }

    return detailInfo
  } catch (error) {
    console.error(`  Error: ${error}`)
    return {}
  }
}

/**
 * キャラクターがビッカメ娘かどうかを判定
 */
const isBiccameMusume = (char: Partial<Character>): boolean => {
  const key = char.key || ''
  if (EXCLUDED_KEYS.includes(key)) return false
  if (GRADUATED_KEYS.includes(key)) return true
  return Boolean(char.twitter_screen_name)
}

// =============================================================================
// データ取得関数
// =============================================================================

/**
 * カレンダーページから誕生日情報を取得
 */
const fetchBirthdaysFromCalendar = async (year: number, options?: GenerateOptions): Promise<Map<string, string>> => {
  const birthdays = new Map<string, string>()

  // 1月から12月まで全てのカレンダーページを取得
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  for (const month of months) {
    const monthStr = month.toString().padStart(2, '0')
    const url = `https://biccame.jp/calendar/${year}/${monthStr}/`
    const calendarPath = options?.fixturesDir ? join(options.fixturesDir, `calendar_${year}_${monthStr}.html`) : undefined

    try {
      const html = await fetchHTML(url, calendarPath)
      const dom = new JSDOM(html)
      const document = dom.window.document

      // カレンダー内のリンクを確認
      const links = document.querySelectorAll('a[href*="/profile/"]')

      for (const link of links) {
        const href = link.getAttribute('href') || ''
        const text = link.textContent || ''

        // 「擬人化N周年」のパターンをマッチ
        const anniversaryMatch = text.match(/擬人化(\d+)周年/)
        if (anniversaryMatch) {
          const years = Number.parseInt(anniversaryMatch[1], 10)
          const birthdayYear = year - years

          // href属性から店舗キーを抽出
          const keyMatch = href.match(/\/profile\/([^/.]+)\.html/)
          if (keyMatch) {
            const key = keyMatch[1]

            // 親要素(td)から日付を取得
            const parent = link.parentElement
            if (parent) {
              // colorスタイルが設定されているtdは別の月の日付なのでスキップ
              const style = parent.getAttribute('style') || ''
              if (style.includes('color:')) {
                continue
              }

              const dayDiv = parent.querySelector('div')
              if (dayDiv) {
                const day = dayDiv.textContent?.trim().padStart(2, '0') || ''
                if (day) {
                  const birthday = `${birthdayYear}-${monthStr}-${day}`
                  // すでに設定されている場合は上書きしない（最初に見つかった方を優先）
                  if (!birthdays.has(key)) {
                    birthdays.set(key, birthday)
                  }
                }
              }
            }
          }
        }
      }

      // レート制限を避けるため100ms待機（ローカルファイルの場合はスキップ）
      if (!options?.fixturesDir) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error(`Failed to fetch calendar for ${year}/${monthStr}:`, error)
    }
  }

  return birthdays
}

// =============================================================================
// キャラクター処理関数
// =============================================================================

/**
 * キャラクターの詳細情報を補完
 */
const enrichCharacterInfo = (
  char: Partial<Character>,
  twitterAccounts: Map<string, string>,
  birthdays: Map<string, string>
): void => {
  const key = char.key
  if (!key) return

  // トップページからTwitterアカウントを設定（詳細ページで取得できなかった場合）
  if (!char.twitter_screen_name && twitterAccounts.has(key)) {
    char.twitter_screen_name = twitterAccounts.get(key)
  }

  // カレンダーから誕生日を設定
  if (birthdays.has(key)) {
    char.character_birthday = birthdays.get(key)
  }

  // 卒業したキャラクターの都道府県を設定
  if (!char.prefecture && GRADUATED_CHARACTERS[key]) {
    char.prefecture = GRADUATED_CHARACTERS[key]
  }
}

/**
 * キャラクターデータを生成
 */
export const generateCharacters = async (options?: GenerateOptions): Promise<Character[]> => {
  const url = 'https://biccame.jp/profile/'
  const indexPath = options?.fixturesDir ? join(options.fixturesDir, 'index.html') : undefined

  const html = await fetchHTML(url, indexPath)
  const characters = parseCharacterInfo(html)

  // 補助情報を取得
  const twitterAccounts = await fetchTwitterAccounts(options)
  const currentYear = new Date().getFullYear()
  const birthdays = await fetchBirthdaysFromCalendar(currentYear, options)

  // 詳細情報を取得して補完
  for (const char of characters) {
    if (char.detail_url) {
      const detailPath = options?.fixturesDir && char.key ? join(options.fixturesDir, `${char.key}.html`) : undefined
      const detailInfo = await fetchDetailPage(char.detail_url, detailPath)
      Object.assign(char, detailInfo)

      enrichCharacterInfo(char, twitterAccounts, birthdays)

      // 住所から座標を取得（フィクスチャモードではスキップ）
      if (!options?.fixturesDir && char.address && !char.latitude && !char.longitude) {
        const coords = await geocodeAddress(char.address)
        if (coords) {
          char.latitude = coords.latitude
          char.longitude = coords.longitude
        }
        // Geocoding APIのレート制限を避けるため追加で待機
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // レート制限を避けるため100ms待機（ローカルファイルの場合はスキップ）
      if (!options?.fixturesDir) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }

  // データを整形してソート
  return characters
    .map((char) => {
      char.is_biccame_musume = isBiccameMusume(char)
      return sortObjectKeys(char as Record<string, unknown>) as unknown as Character
    })
    .sort((a, b) => a.character_name.localeCompare(b.character_name))
}

// =============================================================================
// メイン処理
// =============================================================================

/**
 * CLIエントリーポイント
 */
const main = async () => {
  try {
    console.log('='.repeat(60))
    console.log('ビックカメ娘 characters.json 生成スクリプト')
    console.log('='.repeat(60))
    console.log()

    console.log('1. プロフィールページを取得中...')
    const characters = await generateCharacters()

    console.log()
    console.log('2. ファイルを保存中...')
    const outputPath = join(import.meta.dir, '..', 'public', 'characters.json')

    writeFileSync(outputPath, JSON.stringify(characters, null, 2) + '\n', 'utf-8')

    console.log(`   ✓ ${outputPath} に保存完了`)
    console.log()
    console.log('='.repeat(60))
    console.log(`完了: ${characters.length}件のキャラクターを生成しました`)
    console.log('='.repeat(60))
  } catch (error) {
    console.error(`エラー: ${error}`)
    console.error(error)
    process.exit(1)
  }
}

// 直接実行された場合のみmainを実行
if (import.meta.main) {
  main()
}

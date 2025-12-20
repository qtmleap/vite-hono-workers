import { type ReactNode, useEffect, useRef } from 'react'

// TypeScript用の型定義
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement | null) => void
      }
    }
  }
}

type TwitterTimelineProps = {
  /** Twitterのスクリーンネーム（@なし） */
  screenName: string
  /** ボタンの中身（省略時はデフォルトのフォローボタン） */
  children?: ReactNode
}

/**
 * Twitterフォローボタン埋め込みコンポーネント
 */
export const TwitterTimeline = ({ screenName, children }: TwitterTimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // コンポーネントマウント時にウィジェットを再読み込み
  useEffect(() => {
    if (window.twttr?.widgets && containerRef.current) {
      window.twttr.widgets.load(containerRef.current)
    }
  }, [])

  if (!screenName) {
    return null
  }

  return (
    <div ref={containerRef}>
      <a
        href={`https://twitter.com/${screenName}?ref_src=twsrc%5Etfw`}
        className='twitter-follow-button'
        data-show-count='false'
      >
        {children ?? `Follow @${screenName}`}
      </a>
    </div>
  )
}

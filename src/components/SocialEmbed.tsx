import type { SocialPost } from '../types'

const PLATFORM_ICON: Record<SocialPost['platform'], string> = {
  x: '𝕏',
  tiktok: '♪',
  instagram: '◎',
  youtube: '▶',
}

const youTubeId = (url: string) =>
  url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1]
const tweetId = (url: string) => url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/)?.[1]
const tikTokId = (url: string) => url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)?.[1]
const instaPath = (url: string) => url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)

/** Inline iframe embed per platform, falling back to a plain link card when the URL doesn't parse. */
export default function SocialEmbed({ post }: { post: SocialPost }) {
  let frame = null
  if (post.platform === 'youtube') {
    const id = youTubeId(post.url)
    if (id) frame = <iframe className="se se-video" src={`https://www.youtube-nocookie.com/embed/${id}`} title={post.note} allowFullScreen loading="lazy" />
  } else if (post.platform === 'x') {
    const id = tweetId(post.url)
    if (id)
      frame = (
        <iframe
          className="se se-x"
          src={`https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&dnt=true&hideThread=true`}
          title={post.note}
          loading="lazy"
        />
      )
  } else if (post.platform === 'tiktok') {
    const id = tikTokId(post.url)
    if (id) frame = <iframe className="se se-tiktok" src={`https://www.tiktok.com/embed/v2/${id}`} title={post.note} allowFullScreen loading="lazy" />
  } else if (post.platform === 'instagram') {
    const m = instaPath(post.url)
    if (m) frame = <iframe className="se se-ig" src={`https://www.instagram.com/${m[1]}/${m[2]}/embed/`} title={post.note} loading="lazy" />
  }

  if (!frame) {
    return (
      <a href={post.url} target="_blank" rel="noopener noreferrer" className={`social-card ${post.platform}`}>
        <span className="social-icon">{PLATFORM_ICON[post.platform]}</span>
        <span className="social-note">{post.note}</span>
        <span className={`social-kind kind-${post.kind}`}>{post.kind}</span>
      </a>
    )
  }
  return (
    <div className="social-embed">
      {frame}
      <a className="se-src" href={post.url} target="_blank" rel="noopener noreferrer">
        {PLATFORM_ICON[post.platform]} {post.note} <span className={`social-kind kind-${post.kind}`}>{post.kind}</span> ↗
      </a>
    </div>
  )
}

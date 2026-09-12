import { useEffect } from 'react'

// Lightweight runtime SEO helpers — no react-helmet dependency.
//
// Why this exists:
//   - Private/dynamic routes (lobby, settings, profile, auth) must NOT be
//     indexed by Google. The static index.html says "index, follow", so each
//     such page needs to override that at runtime.
//   - Public routes benefit from a unique <title> + canonical <link> per page
//     so that snippets in search results actually describe the page they
//     point to, not the generic landing title.
//
// One DOM tag per concern, idempotent — safe to call from multiple components.

const SITE_NAME = 'Le Salon de Belot'

// Default origin for canonical URLs when the runtime is server-side or for
// builds. At runtime in a browser we use window.location.origin.
const FALLBACK_ORIGIN = 'https://belot-online.netlify.app'

function origin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return FALLBACK_ORIGIN
}

/** Set <title>. Restores the previous title on unmount. */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} — ${SITE_NAME}`
    return () => { document.title = prev }
  }, [title])
}

/**
 * Override the robots meta on a per-page basis. Used by private/dynamic routes
 * to prevent indexing. The override is removed on unmount so navigation back
 * to a public page restores indexability.
 */
export function useRobotsNoindex(active = true): void {
  useEffect(() => {
    if (!active) return
    const existing = document.querySelector('meta[name="robots"]')
    const previous = existing?.getAttribute('content') ?? null
    let meta = existing as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', 'noindex,nofollow')
    return () => {
      if (previous !== null) meta!.setAttribute('content', previous)
      else meta?.parentNode?.removeChild(meta)
    }
  }, [active])
}

/**
 * Set a per-page canonical URL. If `path` is omitted, uses the current
 * pathname. Useful when multiple aliases serve the same page (e.g.
 * /rules and /pravila).
 */
export function useCanonical(path?: string): void {
  useEffect(() => {
    const href = `${origin()}${path ?? window.location.pathname}`
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    const previous = link?.getAttribute('href') ?? null
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', href)
    return () => {
      if (previous !== null) link!.setAttribute('href', previous)
    }
  }, [path])
}

/**
 * Convenience wrapper for private pages: noindex + title.
 * Use on /tablo, /nastroyki, /profil/:username, /r/:code, auth pages.
 */
export function usePrivatePage(title: string): void {
  useRobotsNoindex(true)
  usePageTitle(title)
}

/**
 * Convenience wrapper for public, SEO-eligible pages: title + canonical.
 * Use on /, /rules, /pravila, /klasacia, /premium, /turniri.
 */
export function usePublicPage(title: string, canonicalPath?: string): void {
  usePageTitle(title)
  useCanonical(canonicalPath)
}

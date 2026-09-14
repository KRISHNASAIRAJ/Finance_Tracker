/**
 * SEO — per-page document head management (title, description, OG, Twitter).
 * No react-helmet dependency needed; writes document.head directly.
 */
import { useEffect } from 'react'

export interface SEOProps {
  title: string
  description: string
  /** Path under site origin, e.g. "/finance". Used for og:url + canonical. */
  path?: string
  /** Override the auto OG image (leave default for branded card). */
  ogImage?: string
  noIndex?: boolean
}

const SITE_NAME = 'Meridian'
const OG_IMAGE = '/og-image.svg'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function SEO({ title, description, path, ogImage, noIndex }: SEOProps) {
  useEffect(() => {
    const fullTitle = path ? `${title} · ${SITE_NAME}` : `${title}`
    document.title = fullTitle

    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:image', ogImage ?? OG_IMAGE)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', ogImage ?? OG_IMAGE)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    const url = `${window.location.origin}${path ?? '/'}`
    upsertMeta('property', 'og:url', url)
    upsertLink('canonical', url)
  }, [title, description, path, ogImage, noIndex])

  return null
}

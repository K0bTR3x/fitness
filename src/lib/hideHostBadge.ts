// Netlify can inject a "Powered by Netlify" badge into <body> that covers the bottom nav.
// Hide any injected element outside #app that links to netlify.
const isBadge = (el: Element) =>
  el.id !== 'app' && !['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(el.tagName) &&
  (el.matches('a[href*="netlify"]') || !!el.querySelector?.('a[href*="netlify"]') ||
    /powered by netlify/i.test(el.textContent || '') || el.tagName.includes('NETLIFY'))

function sweep() {
  for (const el of Array.from(document.body.children)) {
    if (isBadge(el)) (el as HTMLElement).style.setProperty('display', 'none', 'important')
  }
}

export function hideHostBadge() {
  sweep()
  new MutationObserver(sweep).observe(document.body, { childList: true })
}

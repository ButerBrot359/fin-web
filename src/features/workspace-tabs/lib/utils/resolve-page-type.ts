import type { TabPageType } from '../../types/workspace-tab'

const patterns: [RegExp, TabPageType][] = [
  [
    /^\/modules\/[^/]+\/document\/[^/]+\/[^/]+\/movements$/,
    'document-movements',
  ],
  [/^\/modules\/[^/]+\/document\/[^/]+\/new$/, 'document-entry'],
  [/^\/modules\/[^/]+\/document\/[^/]+\/[^/]+$/, 'document-entry'],
  [/^\/modules\/[^/]+\/document\/[^/]+$/, 'document-list'],
  [/^\/modules\/[^/]+\/dictionary\/[^/]+\/new$/, 'dictionary-entry'],
  [/^\/modules\/[^/]+\/dictionary\/[^/]+\/[^/]+$/, 'dictionary-entry'],
  [/^\/modules\/[^/]+\/dictionary\/[^/]+$/, 'dictionary-list'],
  [/^\/modules\/[^/]+$/, 'module'],
]

export function resolvePageType(pathname: string): TabPageType | null {
  for (const [regex, type] of patterns) {
    if (regex.test(pathname)) return type
  }
  return null
}

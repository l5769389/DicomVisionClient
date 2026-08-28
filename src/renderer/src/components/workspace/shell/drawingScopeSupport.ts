export type DrawingScopeToolKey = 'measurement' | 'annotation' | 'qaWater'

export function resolveDrawingScopeToolKey(
  toolKey: string,
  selectedQaOption: string | null | undefined
): DrawingScopeToolKey | null {
  if (toolKey === 'measure') {
    return 'measurement'
  }
  if (toolKey === 'annotate') {
    return 'annotation'
  }
  if (toolKey === 'qa' && selectedQaOption === 'qa:water-phantom') {
    return 'qaWater'
  }
  return null
}

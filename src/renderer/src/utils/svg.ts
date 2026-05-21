export function normalizeInlineSvg(svg: string): string {
  return svg
    .replace(/\s(width|height)="256"/g, '')
    .replace(/\scolor="black"/g, '')
    .replace(/\saria-label="[^"]*"/g, '')
    .replace('<svg ', '<svg focusable="false" ')
}

export const cssZoomOf = (el: Element | null | undefined): number => {
  const zoom = el?.currentCSSZoom
  return typeof zoom === 'number' && zoom > 0 ? zoom : 1
}

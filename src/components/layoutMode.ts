export interface RouteLayoutMode {
  lockViewport: boolean
  hideBottomNav: boolean
  hideFloatingFaq: boolean
}

export function routeLayoutMode(pathname: string): RouteLayoutMode {
  const injectionFullscreen = pathname === '/injektionen'
  return {
    lockViewport: injectionFullscreen || pathname === '/my-stack',
    hideBottomNav: injectionFullscreen,
    hideFloatingFaq: injectionFullscreen,
  }
}

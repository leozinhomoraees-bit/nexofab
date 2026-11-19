import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Keep the server render and the first browser render identical. The real
  // viewport value is applied immediately after hydration.
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

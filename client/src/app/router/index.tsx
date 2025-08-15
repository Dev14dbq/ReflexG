import { Suspense } from 'react'
import type { JSX } from 'react'
import HomePage from '../../pages/Home/ui/HomePage'

export function AppRouter(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  )
}

export default AppRouter



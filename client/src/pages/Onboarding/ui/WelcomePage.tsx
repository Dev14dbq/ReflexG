import type { JSX } from 'react'
import Container from '@/shared/ui/layout/Container'

interface Props { onStart: () => void }

export default function WelcomePage({ onStart }: Props): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-2xl font-semibold">Reflex</div>
          <div className="mt-2 text-muted">Добро пожаловать! Пройдите короткую регистрацию, это займёт пару минут.</div>
          <div className="mt-6">
            <button className="btn btn-primary w-full" onClick={onStart}>Начать регистрацию</button>
          </div>
        </div>
      </div>
    </div>
  )
}



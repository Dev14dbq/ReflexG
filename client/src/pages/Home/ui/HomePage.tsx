import type { JSX } from 'react'

import Container from '@/shared/ui/layout/Container'
import { TelegramUserCard } from '@/widgets/TelegramUserCard/ui/TelegramUserCard'

export default function HomePage(): JSX.Element {
  return (
    <Container>
      <h1 className="text-xl font-semibold text-[var(--color-fg)] mb-4">Главная страница</h1>
      <div className="mt-4">
        <TelegramUserCard />
      </div>
    </Container>
  )
}



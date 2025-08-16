import type { JSX } from 'react'
import Container from '@/shared/ui/layout/Container'
import { TelegramUserCard } from '@/widgets/TelegramUserCard/ui/TelegramUserCard'

export default function HomePage(): JSX.Element {
  return (
    <Container>
      Главная страница
      <div className="mt-4">
        <TelegramUserCard />
      </div>
    </Container>
  )
}



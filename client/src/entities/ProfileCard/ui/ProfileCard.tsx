import type { JSX } from 'react'

export type ProfileCardData = {
  userId: string
  displayName: string | null
  age: number | null
  city: string | null
  photos: string[]
  bio: string | null
}

interface Props {
  data: ProfileCardData
  onLike: () => void
  onDislike: () => void
}

export default function ProfileCard({ data, onLike, onDislike }: Props): JSX.Element {
  const title = [data.displayName, data.age ? String(data.age) : null].filter(Boolean).join(', ')
  return (
    <div className="card">
      <div className="w-full aspect-[4/5] overflow-hidden rounded-xl border border-accent flex items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)92%,var(--color-accent)8%)]">
        {data.photos?.[0] ? (
          <img src={data.photos[0]} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-muted">Нет фото</div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-lg font-semibold">{title || 'Без имени'}</div>
        <div className="text-sm text-muted">{data.city ?? ''}</div>
        {data.bio ? <div className="text-sm mt-2">{data.bio}</div> : null}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn w-1/2" onClick={onDislike}>Не интересно</button>
        <button className="btn btn-primary w-1/2" onClick={onLike}>Нравится</button>
      </div>
    </div>
  )
}



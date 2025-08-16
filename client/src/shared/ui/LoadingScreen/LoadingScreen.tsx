import type { JSX } from 'react'

interface LoadingScreenProps {
  statuses?: string[]
}

export default function LoadingScreen({ statuses = [] }: LoadingScreenProps): JSX.Element {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="animate-spin inline-block size-8 border-[3px] border-current border-t-transparent text-gray-500 rounded-full" role="status" aria-label="loading" />
      <div className="mt-4 text-lg font-medium">Загрузка…</div>
      {statuses.length > 0 ? (
        <div className="mt-2 text-sm text-gray-500 space-y-1">
          {statuses.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
      ) : null}
    </div>
  )
}



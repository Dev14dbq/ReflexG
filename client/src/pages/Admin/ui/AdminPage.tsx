import { useState, useEffect, type JSX } from 'react'
import { RiUserLine, RiShieldCheckLine, RiShieldCrossLine, RiTimeLine } from 'react-icons/ri'
import { Navigate } from 'react-router-dom'

import { getModerationStats } from '@/shared/api/admin'
import type { ModerationStatsResponse } from '@/shared/api/admin'
import { getUserInfo } from '@/shared/api/profile'


export default function AdminPage(): JSX.Element {
  const [stats, setStats] = useState<ModerationStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const initData = window?.Telegram?.WebApp?.initData || ''
        const response = await getUserInfo(initData)
        if (response.ok) {
          setUserInfo(response.user)
        }
      } catch (error) {
        console.error('Failed to check auth:', error)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (userInfo && (userInfo.isModerator || userInfo.isAdmin)) {
      fetchStats()
    }
  }, [userInfo])

  const fetchStats = async () => {
    try {
      const response = await getModerationStats()
      setStats(response)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Проверяем права доступа
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Проверка прав доступа...</div>
      </div>
    )
  }

  if (!userInfo || (!userInfo.isModerator && !userInfo.isAdmin)) {
    return <Navigate to="/messages" replace />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (!stats?.ok) {
    return (
      <div className="p-4">
        <div className="text-red-500">Ошибка загрузки статистики</div>
      </div>
    )
  }

  const { stats: statsData } = stats

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Админ панель</h1>
        <p className="text-[var(--color-fg-secondary)] mt-2">Управление системой и модерация</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <RiTimeLine className="text-blue-500 text-2xl" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-fg)]">{statsData.pending}</div>
          <div className="text-sm text-[var(--color-fg-secondary)]">Ожидают модерации</div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <RiShieldCheckLine className="text-green-500 text-2xl" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-fg)]">{statsData.approved}</div>
          <div className="text-sm text-[var(--color-fg-secondary)]">Одобрено</div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <RiShieldCrossLine className="text-red-500 text-2xl" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-fg)]">{statsData.rejected}</div>
          <div className="text-sm text-[var(--color-fg-secondary)]">Отклонено</div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <RiUserLine className="text-purple-500 text-2xl" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-fg)]">{statsData.total}</div>
          <div className="text-sm text-[var(--color-fg-secondary)]">Всего</div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-fg)]">Быстрые действия</h2>
        
        <div className="grid gap-3">
          <a 
            href="/admin/moderation" 
            className="bg-[var(--color-accent)] text-white rounded-lg p-4 text-center font-medium hover:opacity-90 transition-opacity"
          >
            Модерация контента
          </a>
          
          <a 
            href="/admin/users" 
            className="bg-[var(--color-bg-secondary)] text-[var(--color-fg)] rounded-lg p-4 text-center font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Управление пользователями
          </a>
        </div>
      </div>

      {/* Детальная статистика по типам */}
      {stats.byType && Object.keys(stats.byType).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">Статистика по типам</h2>
          
          <div className="space-y-2">
            {Object.entries(stats.byType).map(([type, statusCounts]) => (
              <div key={type} className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
                <div className="font-medium text-[var(--color-fg)] mb-2">
                  {type === 'INITIAL' && 'Первичная модерация'}
                  {type === 'PROFILE_DESCRIPTION' && 'Описания профилей'}
                  {type === 'PROFILE_EDIT' && 'Редактирование профилей'}
                  {type === 'PHOTOS' && 'Фотографии'}
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-500">Ожидает: {statusCounts.PENDING || 0}</span>
                  <span className="text-green-500">Одобрено: {statusCounts.APPROVED || 0}</span>
                  <span className="text-red-500">Отклонено: {statusCounts.REJECTED || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { RiShieldLine, RiUserLine, RiStarLine, RiEditLine } from 'react-icons/ri'

import { getUsersList, updateUserRole } from '@/shared/api/admin'
import type { UserListItem, UserRoleEnum } from '@/shared/api/admin'

export default function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [newRole, setNewRole] = useState<UserRoleEnum>('USER')

  useEffect(() => {
    fetchUsers()
  }, [currentPage])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await getUsersList(currentPage, 20)
      
      if (response.ok) {
        setUsers(response.users)
        setTotalPages(response.pagination.pages)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleUpdate = async () => {
    if (!editingUser) return

    try {
      const response = await updateUserRole({
        targetTelegramId: editingUser.telegramId,
        newRole
      })
      
      if (response.ok) {
        // Обновляем список
        fetchUsers()
        // Закрываем модалку
        setEditingUser(null)
        setNewRole('USER')
      }
    } catch (error) {
      console.error('Failed to update role:', error)
    }
  }

  const getRoleIcon = (role: UserRoleEnum) => {
    switch (role) {
      case 'ADMIN':
        return <RiStarLine className="text-yellow-500" size={20} />
      case 'MODERATOR':
        return <RiShieldLine className="text-blue-500" size={20} />
      case 'USER':
        return <RiUserLine className="text-gray-500" size={20} />
      default:
        return <RiUserLine className="text-gray-500" size={20} />
    }
  }

  const getRoleLabel = (role: UserRoleEnum): string => {
    switch (role) {
      case 'ADMIN': return 'Администратор'
      case 'MODERATOR': return 'Модератор'
      case 'USER': return 'Пользователь'
      default: return role
    }
  }

  const getRoleColor = (role: UserRoleEnum): string => {
    switch (role) {
      case 'ADMIN': return 'text-yellow-600'
      case 'MODERATOR': return 'text-blue-600'
      case 'USER': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Управление пользователями</h1>
        <a 
          href="/admin" 
          className="text-[var(--color-accent)] hover:opacity-80 transition-opacity"
        >
          ← Назад
        </a>
      </div>

      {/* Список пользователей */}
      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.telegramId} className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {getRoleIcon(user.role)}
                  <div>
                    <div className="font-medium text-[var(--color-fg)]">
                      {user.firstName || user.username || `ID: ${user.telegramId}`}
                    </div>
                    <div className={`text-sm font-medium ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </div>
                  </div>
                </div>
                
                {user.profile && (
                  <div className="text-sm text-[var(--color-fg-secondary)] mb-1">
                    Профиль: {user.profile.displayName || 'Без имени'}
                    {user.profile.city && ` • ${user.profile.city}`}
                  </div>
                )}
                
                <div className="text-xs text-[var(--color-fg-secondary)]">
                  ID: {user.telegramId} • Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingUser(user)
                  setNewRole(user.role)
                }}
                className="p-2 text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)] transition-colors"
                title="Изменить роль"
              >
                <RiEditLine size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-fg)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          
          <span className="px-3 py-2 text-[var(--color-fg)]">
            {currentPage} из {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-fg)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Модалка изменения роли */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg)] rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">
                Изменить роль пользователя
              </h3>
              <button
                onClick={() => {
                  setEditingUser(null)
                  setNewRole('USER')
                }}
                className="text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)]"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-sm text-[var(--color-fg-secondary)]">Пользователь:</span>
                <div className="text-[var(--color-fg)] font-medium">
                  {editingUser.firstName || editingUser.username || `ID: ${editingUser.telegramId}`}
                </div>
              </div>
              
              <div>
                <span className="text-sm text-[var(--color-fg-secondary)]">Текущая роль:</span>
                <div className={`font-medium ${getRoleColor(editingUser.role)}`}>
                  {getRoleLabel(editingUser.role)}
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-[var(--color-fg-secondary)] mb-2">
                  Новая роль:
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRoleEnum)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)]"
                >
                  <option value="USER">Пользователь</option>
                  <option value="MODERATOR">Модератор</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleRoleUpdate}
                  className="flex-1 bg-[var(--color-accent)] text-white py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null)
                    setNewRole('USER')
                  }}
                  className="flex-1 bg-[var(--color-bg-secondary)] text-[var(--color-fg)] py-2 px-4 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

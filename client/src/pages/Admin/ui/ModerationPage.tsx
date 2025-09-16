import { useState, useEffect } from 'react'
import { RiUserAddLine, RiEditLine } from 'react-icons/ri'

import { getModerationItems, updateModerationStatus, getModerationStats } from '@/shared/api/admin'
import type { ModerationItem, ModerationStatus, ModerationItemType } from '@/shared/api/admin'
import { ModerationCard } from '@/entities/ModerationCard'
import { useModerationWebSocket } from '@/shared/hooks/useModerationWebSocket'

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'DISCREPANT' | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [banUser, setBanUser] = useState(false)
  const [currentMode, setCurrentMode] = useState<'new' | 'changes'>('new')
  const [stats, setStats] = useState<any>(null)

  // WebSocket для действий модерации
  const { sendAction, isConnected } = useModerationWebSocket(
    // onActionSuccess
    (data) => {
      // Успех по WS — обновляем список/статистику и закрываем модалку
      fetchItems()
      fetchStats()
      setShowActionModal(false)
      setSelectedItem(null)
      setActionType(null)
      setActionReason('')
      setBanUser(false)
    },
    // onError
    (message) => {
      console.error('WS moderation error:', message)
    }
  )

  useEffect(() => {
    fetchItems()
    fetchStats()
  }, [currentPage, currentMode])

  const fetchStats = async () => {
    try {
      const response = await getModerationStats()
      if (response.ok) {
        setStats(response.stats)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchItems = async () => {
    try {
      setLoading(true)
      
      // Фильтруем по режиму
      let typeFilter: ModerationItemType
      if (currentMode === 'new') {
        typeFilter = 'INITIAL' // По умолчанию показываем новые анкеты
      } else {
        typeFilter = 'PROFILE_DESCRIPTION' // По умолчанию показываем изменения
      }
      
      const response = await getModerationItems(
        'PENDING', // По умолчанию показываем только ожидающие
        typeFilter,
        currentPage,
        20
      )
      
      if (response.ok) {
        setItems(response.items)
        setTotalPages(response.pagination.pages)
      }
    } catch (error) {
      console.error('Failed to fetch items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (itemId: string, status: ModerationStatus, reason?: string, shouldBan = false) => {
    try {
      // Пытаемся отправить через WebSocket; при недоступности — фолбэк на HTTP
      const action = status === 'APPROVED' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : 'DISCREPANT'
      const wsSent = isConnected && sendAction({
        itemId,
        action: action as 'APPROVE' | 'REJECT' | 'DISCREPANT',
        reason,
        banUser: status === 'REJECTED' ? shouldBan : undefined
      })

      if (wsSent) {
        return
      }

      const response = await updateModerationStatus({ 
        itemId, 
        status, 
        reason,
        banUser: status === 'REJECTED' ? shouldBan : undefined
      })
      
      if (response.ok) {
        fetchItems()
        fetchStats()
        setShowActionModal(false)
        setSelectedItem(null)
        setActionType(null)
        setActionReason('')
        setBanUser(false)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const getTypeLabel = (type: ModerationItemType): string => {
    switch (type) {
      case 'INITIAL': return 'Первичная модерация'
      case 'PROFILE_DESCRIPTION': return 'Описание профиля'
      case 'PROFILE_EDIT': return 'Редактирование профиля'
      case 'PHOTOS': return 'Фотографии'
      default: return type
    }
  }

  const getStatusColor = (status: ModerationStatus): string => {
    switch (status) {
      case 'PENDING': return 'text-blue-500'
      case 'APPROVED': return 'text-green-500'
      case 'REJECTED': return 'text-red-500'
      case 'DISCREPANT': return 'text-yellow-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusLabel = (status: ModerationStatus): string => {
    switch (status) {
      case 'PENDING': return 'Ожидает'
      case 'APPROVED': return 'Одобрено'
      case 'REJECTED': return 'Отклонено'
      case 'DISCREPANT': return 'Некорректные данные'
      default: return status
    }
  }

  const openActionModal = (type: 'APPROVE' | 'REJECT' | 'DISCREPANT') => {
    setActionType(type)
    setActionReason('')
    setBanUser(false)
    setShowActionModal(true)
  }

  const executeAction = () => {
    if (!selectedItem || !actionType) return
    
    let status: ModerationStatus
    let shouldBan = false
    
    switch (actionType) {
      case 'APPROVE':
        status = 'APPROVED'
        break
      case 'REJECT':
        status = 'REJECTED'
        shouldBan = banUser
        break
      case 'DISCREPANT':
        status = 'DISCREPANT'
        break
    }
    
    handleStatusUpdate(selectedItem.id, status, actionReason || undefined, shouldBan)
  }

  // Обработчики для ModerationCard
  const handleApprove = (itemId: string) => {
    handleStatusUpdate(itemId, 'APPROVED')
  }

  const handleReject = (itemId: string, reason: string, banUser: boolean) => {
    handleStatusUpdate(itemId, 'REJECTED', reason, banUser)
  }

  const handleDiscrepant = (itemId: string, reason: string) => {
    handleStatusUpdate(itemId, 'DISCREPANT', reason)
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">
          Модерация контента
        </h1>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.pending}</div>
            <div className="text-sm text-[var(--color-fg-secondary)]">Ожидают</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
            <div className="text-sm text-[var(--color-fg-secondary)]">Одобрено</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
            <div className="text-sm text-[var(--color-fg-secondary)]">Отклонено</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.discrepant}</div>
            <div className="text-sm text-[var(--color-fg-secondary)]">Переделать</div>
          </div>
        </div>
      )}

      {/* Переключатели режимов */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setCurrentMode('new')}
          className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
            currentMode === 'new' 
              ? 'bg-[var(--color-accent)] text-white' 
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-fg)] hover:bg-[var(--color-accent)] hover:text-white'
          }`}
        >
          <RiUserAddLine size={20} />
          Модерировать новые анкеты
        </button>
        <button
          onClick={() => setCurrentMode('changes')}
          className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
            currentMode === 'changes' 
              ? 'bg-[var(--color-accent)] text-white' 
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-fg)] hover:bg-[var(--color-accent)] hover:text-white'
          }`}
        >
          <RiEditLine size={20} />
          Модерировать изменения
        </button>
      </div>

      {/* Список элементов */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-xl text-[var(--color-fg)] mb-2">
            {currentMode === 'new' ? 'Нет новых анкет для модерации!' : 'Нет изменений для модерации!'}
          </div>
          <div className="text-[var(--color-fg-secondary)]">
            Все {currentMode === 'new' ? 'анкеты' : 'изменения'} уже обработаны
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <ModerationCard
              key={item.id}
              data={{
                id: item.id,
                userId: item.userId,
                displayName: (item.payload as any)?.displayName || null,
                age: (item.payload as any)?.age || null,
                city: (item.payload as any)?.city || null,
                photos: (item.payload as any)?.photos || [],
                bio: (item.payload as any)?.description || null,
                heightCm: (item.payload as any)?.heightCm || null,
                weightKg: (item.payload as any)?.weightKg || null,
                wandSizeCm: (item.payload as any)?.wandSizeCm || null,
                gender: (item.payload as any)?.gender || null,
                type: item.type,
                createdAt: item.createdAt,
                user: item.user,
                payload: item.payload // Передаем обогащенный payload
              }}
              onApprove={handleApprove}
              onReject={handleReject}
              onDiscrepant={handleDiscrepant}
            />
          ))}
        </div>
      )}

      {/* Пагинация */}
      {items.length > 0 && totalPages > 1 && (
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

      {/* Модальное окно для действий */}
      {showActionModal && selectedItem && actionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg)] rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">
                {actionType === 'APPROVE' && 'Одобрить анкету'}
                {actionType === 'REJECT' && 'Отклонить анкету'}
                {actionType === 'DISCREPANT' && 'Отметить некорректные данные'}
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-[var(--color-fg-secondary)] hover:text-[var(--color-fg)]"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-fg-secondary)] mb-2">
                  Причина {actionType === 'DISCREPANT' ? '(описание проблемы)' : '(опционально)'}
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={actionType === 'DISCREPANT' ? 'Опишите, какие данные некорректны...' : 'Укажите причину отклонения...'}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] resize-none"
                  rows={3}
                />
              </div>
              
              {actionType === 'REJECT' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="banUser"
                    checked={banUser}
                    onChange={(e) => setBanUser(e.target.checked)}
                    className="rounded border-[var(--color-border)]"
                  />
                  <label htmlFor="banUser" className="text-sm text-[var(--color-fg)]">
                    Заблокировать пользователя
                  </label>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-fg)] hover:opacity-80 transition-opacity"
                >
                  Отмена
                </button>
                <button
                  onClick={executeAction}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${
                    actionType === 'APPROVE' ? 'bg-green-500 hover:bg-green-600' :
                    actionType === 'REJECT' ? 'bg-red-500 hover:bg-red-600' :
                    'bg-yellow-500 hover:bg-yellow-600'
                  }`}
                >
                  {actionType === 'APPROVE' && 'Одобрить'}
                  {actionType === 'REJECT' && 'Отклонить'}
                  {actionType === 'DISCREPANT' && 'Отметить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

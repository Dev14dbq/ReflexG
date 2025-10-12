import { useEffect, useState, type JSX } from 'react'
import { RiHeartLine, RiUserLine, RiTimeLine, RiEyeLine, RiDeleteBinLine } from 'react-icons/ri'
import { toast } from 'sonner'
import { fetchLikesHistory, clearOldLikes, type LikeHistoryItem } from '@/shared/api/likes'

type FilterType = 'my-likes' | 'received-likes' | 'matched' | 'unmatched'

export default function LikesHistoryPage(): JSX.Element {
  const [likes, setLikes] = useState<LikeHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('received-likes')
  const [clearing, setClearing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [stats, setStats] = useState({
    totalCount: 0,
    myLikesCount: 0,
    receivedLikesCount: 0,
    matchedCount: 0
  })

  // Загрузка истории лайков
  useEffect(() => {
    setPage(1)
    loadLikesHistory(true)
  }, [filter])

  const loadLikesHistory = async (reset = false) => {
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const currentPage = reset ? 1 : page
      
      // Попробуем загрузить реальные данные, если API доступен
      try {
        const response = await fetchLikesHistory(initData, filter, currentPage, 20)
        
        if (reset) {
          setLikes(response.likes)
          setPage(1)
        } else {
          setLikes(prev => [...prev, ...response.likes])
        }
        
        setStats({
          totalCount: response.totalCount,
          myLikesCount: response.myLikesCount,
          receivedLikesCount: response.receivedLikesCount,
          matchedCount: response.matchedCount
        })
        
        setHasMore(response.pagination.hasNext)
        if (!reset) setPage(prev => prev + 1)
      } catch (apiError) {
        // Если API недоступен, используем тестовые данные
        console.log('API недоступен, используем тестовые данные')
        const mockData: LikeHistoryItem[] = [
          {
            id: '1',
            userId: 'user1',
            username: 'alex_k',
            firstName: 'Алексей',
            lastName: 'Кузнецов',
            photoUrl: null,
            likedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            isMatched: true,
            matchedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            isMyLike: false
          },
          {
            id: '2',
            userId: 'user2',
            username: 'maria_s',
            firstName: 'Мария',
            lastName: 'Смирнова',
            photoUrl: null,
            likedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            isMatched: false,
            matchedAt: null,
            isMyLike: true
          },
          {
            id: '3',
            userId: 'user3',
            username: 'dmitry_v',
            firstName: 'Дмитрий',
            lastName: 'Волков',
            photoUrl: null,
            likedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            isMatched: true,
            matchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            isMyLike: false
          },
          {
            id: '4',
            userId: 'user4',
            username: 'anna_p',
            firstName: 'Анна',
            lastName: 'Петрова',
            photoUrl: null,
            likedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            isMatched: false,
            matchedAt: null,
            isMyLike: true
          }
        ]
        
        // Фильтруем тестовые данные в зависимости от выбранного фильтра
        let filteredData = mockData
        switch (filter) {
          case 'my-likes':
            filteredData = mockData.filter(like => like.isMyLike)
            break
          case 'received-likes':
            filteredData = mockData.filter(like => !like.isMyLike)
            break
          case 'matched':
            filteredData = mockData.filter(like => like.isMatched)
            break
          case 'unmatched':
            filteredData = mockData.filter(like => !like.isMatched)
            break
        }
        
        setLikes(filteredData)
        setStats({
          totalCount: mockData.length,
          myLikesCount: mockData.filter(l => l.isMyLike).length,
          receivedLikesCount: mockData.filter(l => !l.isMyLike).length,
          matchedCount: mockData.filter(l => l.isMatched).length
        })
      }
    } catch (error) {
      console.error('Likes history error:', error)
      toast.error('Ошибка загрузки истории лайков')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Только что'
    if (diffInHours < 24) return `${diffInHours}ч назад`
    if (diffInHours < 48) return 'Вчера'
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const loadMoreLikes = async () => {
    if (loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      await loadLikesHistory(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleClearOldLikes = async () => {
    if (clearing) return
    
    const confirmed = window.confirm(
      'Удалить все ваши лайки старше 2 недель?\n\nЭто действие нельзя отменить. Будут удалены только ваши лайки, полученные лайки останутся.'
    )
    
    if (!confirmed) return
    
    setClearing(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const response = await clearOldLikes(initData)
      
      toast.success(response.message)
      
      // Перезагружаем данные
      await loadLikesHistory()
    } catch (error) {
      console.error('Clear old likes error:', error)
      toast.error('Ошибка очистки старых лайков')
    } finally {
      setClearing(false)
    }
  }

  const filteredLikes = likes // Данные уже отфильтрованы на сервере или в loadLikesHistory

  if (loading) {
    return (
      <div className="max-w-md mx-auto h-full bg-[var(--color-bg)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-fg)]">
          <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          Загрузка...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto h-full bg-[var(--color-bg)] overflow-y-auto">
      <div className="px-4 py-6">
        {(() => {
          const unmatchedCount = Math.max(stats.totalCount - stats.matchedCount, 0)
          return (
            <>
              {/* Фильтры (сверху) */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setFilter('received-likes')}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                    filter === 'received-likes' 
                      ? 'bg-[var(--color-accent)] text-white' 
                      : 'bg-[color-mix(in_oklab,var(--color-bg)97%,var(--color-accent)3%)] text-[var(--color-fg)]'
                  }`}
                >
                  <span>Полученные</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${filter === 'received-likes' ? 'bg-white/20' : 'bg-[color-mix(in_oklab,var(--color-fg)8%,transparent)]'}`}>{stats.receivedLikesCount}</span>
                </button>
                <button
                  onClick={() => setFilter('my-likes')}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                    filter === 'my-likes' 
                      ? 'bg-[var(--color-accent)] text-white' 
                      : 'bg-[color-mix(in_oklab,var(--color-bg)97%,var(--color-accent)3%)] text-[var(--color-fg)]'
                  }`}
                >
                  <span>Мои лайки</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${filter === 'my-likes' ? 'bg-white/20' : 'bg-[color-mix(in_oklab,var(--color-fg)8%,transparent)]'}`}>{stats.myLikesCount}</span>
                </button>
                <button
                  onClick={() => setFilter('matched')}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                    filter === 'matched' 
                      ? 'bg-[var(--color-accent)] text-white' 
                      : 'bg-[color-mix(in_oklab,var(--color-bg)97%,var(--color-accent)3%)] text-[var(--color-fg)]'
                  }`}
                >
                  <span>Матчи</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${filter === 'matched' ? 'bg-white/20' : 'bg-[color-mix(in_oklab,var(--color-fg)8%,transparent)]'}`}>{stats.matchedCount}</span>
                </button>
                <button
                  onClick={() => setFilter('unmatched')}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                    filter === 'unmatched' 
                      ? 'bg-[var(--color-accent)] text-white' 
                      : 'bg-[color-mix(in_oklab,var(--color-bg)97%,var(--color-accent)3%)] text-[var(--color-fg)]'
                  }`}
                >
                  <span>Без ответа</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${filter === 'unmatched' ? 'bg-white/20' : 'bg-[color-mix(in_oklab,var(--color-fg)8%,transparent)]'}`}>{unmatchedCount}</span>
                </button>
              </div>

              {/* Статистика (сдержанный контейнер) */}
              {stats.totalCount > 0 && (
                <div className="mb-6 p-4 bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-[var(--color-fg)]">Статистика</h4>
                    <button
                      onClick={handleClearOldLikes}
                      disabled={clearing}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-[color-mix(in_oklab,var(--color-accent)30%,transparent)] text-[var(--color-fg)] rounded hover:bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] transition-colors disabled:opacity-50"
                    >
                      <RiDeleteBinLine size={12} />
                      {clearing ? 'Очистка...' : 'Удалить старые лайки'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-[var(--color-fg)]">{stats.totalCount}</div>
                      <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">Всего лайков</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[var(--color-fg)]">{stats.matchedCount}</div>
                      <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">Матчи</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[var(--color-fg)]">{stats.myLikesCount}</div>
                      <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">Мои лайки</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[var(--color-fg)]">{stats.receivedLikesCount}</div>
                      <div className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">Полученные</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {/* Список лайков */}
        {filteredLikes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] flex items-center justify-center mx-auto mb-4">
              <RiHeartLine size={24} className="text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">
              {filter === 'my-likes' ? 'Нет ваших лайков' :
               filter === 'received-likes' ? 'Нет полученных лайков' :
               filter === 'matched' ? 'Нет матчей' : 'Нет лайков без ответа'}
            </h3>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
              {filter === 'my-likes' ? 'Здесь будут отображаться лайки, которые вы поставили' :
               filter === 'received-likes' ? 'Здесь будут отображаться лайки, которые вам поставили' :
               filter === 'matched' ? 'Здесь будут отображаться ваши матчи' :
               'Здесь будут отображаться лайки без ответа'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLikes.map((like) => {
              const displayName = [like.firstName, like.lastName].filter(Boolean).join(' ') || like.username || 'Пользователь'
              return (
                <div key={like.id} className="flex items-center gap-3 p-4 bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg">
                  
                  {/* Аватар */}
                  <div className="w-12 h-12 rounded-full border border-[var(--color-accent)] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {like.photoUrl ? (
                      <img src={like.photoUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <RiUserLine size={20} className="text-[var(--color-accent)]" />
                    )}
                  </div>

                  {/* Информация о пользователе */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-[var(--color-fg)] truncate">
                      {displayName}
                    </h3>
                    {like.username && (
                      <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)] truncate">
                        @{like.username}
                      </p>
                    )}
                    
                    {/* Статус и время */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <RiTimeLine size={12} className="text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]" />
                        <span className="text-xs text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
                          {formatDate(like.likedAt)}
                        </span>
                      </div>
                      
                      {like.isMatched && (
                        <div className="flex items-center gap-1">
                          <RiHeartLine size={12} className="text-green-500" />
                          <span className="text-xs text-green-500 font-medium">
                            Матч
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Статус лайка */}
                  <div className="flex flex-col gap-1">
                    {like.isMatched ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-[color-mix(in_oklab,var(--color-accent)12%,transparent)] text-[var(--color-accent)] text-xs rounded">
                        <RiHeartLine size={12} />
                        Матч
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 bg-[color-mix(in_oklab,var(--color-fg)10%,transparent)] text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)] text-xs rounded">
                        <RiEyeLine size={12} />
                        Просмотрено
                      </div>
                    )}
                    
                    {/* Тип лайка */}
                    <div className={`flex items-center gap-1 px-2 py-1 text-xs rounded border border-[color-mix(in_oklab,var(--color-accent)25%,transparent)] text-[color-mix(in_oklab,var(--color-fg)75%,var(--color-muted)25%)]`}>
                      <RiHeartLine size={10} />
                      {like.isMyLike ? 'Мой лайк' : 'Получен'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Кнопка загрузки дополнительных данных */}
        {hasMore && likes.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMoreLikes}
              disabled={loadingMore}
              className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm rounded-lg hover:bg-[color-mix(in_oklab,var(--color-accent)90%,black)] transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Загрузка...
                </div>
              ) : (
                'Загрузить еще'
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

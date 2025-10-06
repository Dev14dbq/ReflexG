import { type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  RiArrowLeftSLine, 
  RiUser3Line, 
  RiHeartLine, 
  RiCloseLine, 
  RiEditLine,
  RiSettings3Line,
  RiQuestionLine,
  RiInformationLine
} from 'react-icons/ri'

export default function HelpPage(): JSX.Element {
  const navigate = useNavigate()

  const helpSections = [
    {
      id: 'swiping',
      title: 'Поиск и знакомства',
      icon: <RiHeartLine size={20} />,
      content: [
        'На странице "Анкеты" нажимайте кнопки лайка и дизлайка',
        'Если вас что-то смутило, отправьте репорт через кнопку репорта в правом верхнем углу',
        'Чтобы посмотреть кто вас лайкнул, зайдите на страницу "Лайки"',
        'Взаимно лайкните понравившихся людей для начала общения',
        'Ваши лайки видны только при взаимной симпатии'
      ]
    },
    {
      id: 'settings',
      title: 'Настройки',
      icon: <RiSettings3Line size={20} />,
      content: [
        'Измените фото профиля в выпадающем меню',
        'Используйте админ-панель (для модераторов)',
        'При проблемах обращайтесь к @Spectrmod',
        'Если что-то зависло, попробуйте перезагрузить приложение',
        'Для сброса данных нажмите 5 раз на текст версии в профиле'
      ]
    },
    {
      id: 'editing',
      title: 'Редактирование профиля',
      icon: <RiEditLine size={20} />,
      content: [
        'Нажмите на любое поле в анкете для редактирования',
        'Перетаскивайте фото для изменения их порядка',
        'Кликайте на фото для замены',
        'Все изменения сохраняются автоматически',
        'Изменения отправляются на модерацию'
      ]
    }
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[var(--color-bg)]">
      {/* Верхний бар */}
      <div className="sticky top-0 left-0 right-0 bg-[var(--color-bg)] z-20 border-b border-[color-mix(in_oklab,var(--color-accent)10%,transparent)]">
        <div className="flex items-center justify-center h-14 px-4 relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 text-[var(--color-fg)] hover:opacity-70 transition-opacity"
          >
            <RiArrowLeftSLine size={24} />
          </button>
          <h1 className="text-lg font-semibold text-[var(--color-fg)]">Справка</h1>
        </div>
      </div>

      {/* Контент */}
      <div className="px-4 py-6 space-y-6">
        {/* Приветствие */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center mx-auto mb-4">
            <RiQuestionLine size={32} className="text-[var(--color-accent)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-fg)] mb-2">
            Справка по Okeano!
          </h2>
          <p className="text-sm text-[color-mix(in_oklab,var(--color-fg)70%,var(--color-muted)30%)]">
            Здесь вы найдете всю необходимую информацию о том, как пользоваться приложением
          </p>
        </div>

                {/* Дополнительная информация */}
        <div className="bg-[color-mix(in_oklab,var(--color-bg)95%,var(--color-accent)5%)] border border-[color-mix(in_oklab,var(--color-accent)15%,transparent)] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
              <div className="text-[var(--color-accent)]">
                <RiInformationLine size={20} />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-fg)]">
              Важная информация
            </h3>
          </div>
          
          <div className="space-y-3 text-sm text-[color-mix(in_oklab,var(--color-fg)80%,var(--color-muted)20%)]">
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-accent)] font-bold">•</span>
              <span>Все данные проходят модерацию перед публикацией</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-accent)] font-bold">•</span>
              <span>Используйте только свои фотографии!</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-accent)] font-bold">•</span>
              <span>Будьте вежливы и уважительны в общении</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-accent)] font-bold">•</span>
              <span>При проблемах обращайтесь к </span>
              <a 
                href="https://t.me/spectrmod" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline font-medium"
              >
                @Spectrmod
              </a>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-accent)] font-bold">•</span>
              <span>Если что-то зависло, попробуйте перезагрузить приложение</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-accent)] font-bold">•</span>
              <span>Для сброса данных нажмите 5 раз на текст версии на странице профиля (в самом низу)</span>
            </div>
          </div>
        </div>

        {/* Разделы справки */}
        {helpSections.map((section) => (
          <div key={section.id} className="bg-[var(--color-bg)] border border-[color-mix(in_oklab,var(--color-accent)10%,transparent)] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-md bg-[color-mix(in_oklab,var(--color-accent)10%,transparent)] flex items-center justify-center">
                <div className="text-[var(--color-accent)]">
                  {section.icon}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">
                {section.title}
              </h3>
            </div>
            
            <ul className="space-y-2">
              {section.content.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-[color-mix(in_oklab,var(--color-fg)80%,var(--color-muted)20%)]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Контакты */}
        <div className="text-center py-4">
          <p className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)]">
            Версия приложения: v0.14.2
          </p>
          <p className="text-xs text-[color-mix(in_oklab,var(--color-fg)50%,var(--color-muted)50%)] mt-1">
            Если у вас есть вопросы, напишите нам
          </p>
        </div>
      </div>
    </div>
  )
}

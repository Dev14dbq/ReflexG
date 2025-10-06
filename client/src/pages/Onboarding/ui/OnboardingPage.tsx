import type { JSX, ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import DaDataCityAutocomplete, { type DaDataCityItem } from '@/shared/ui/DaDataCityAutocomplete'
import { PhotoPreviewModal } from './PhotoPreviewModal'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { GenderEnum, SexEnum, submitBaseProfile } from '@/shared/api/profile'
import { uploadImage } from '@/shared/api/cdn'
import { compressImageToJpeg, cropImageTo9x16 } from '@/shared/lib/image'
import { GENDER_FLAG } from '@/shared/lib/gender'

type Step = 'NAME' | 'BIRTHDATE' | 'SEX' | 'GENDER' | 'CITY' | 'PHOTOS' | 'SUBMITTING'

function isGenderRequiresSex(g: typeof GenderEnum._type): boolean {
  return g === 'GAY' || g === 'LESBIAN'
}

function parseBirthDateDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]); const mo = Number(m[2]); const y = Number(m[3])
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCDate() !== d || date.getUTCMonth() !== mo - 1 || date.getUTCFullYear() !== y) return null
  return date
}

function calcAge(date: Date | null): number | null {
  if (!date) return null
  const now = new Date()
  let age = now.getUTCFullYear() - date.getUTCFullYear()
  const m = now.getUTCMonth() - date.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < date.getUTCDate())) age--
  return age
}

export default function OnboardingPage(): JSX.Element {
  const { ready, isWebApp } = useTelegramAuth()
  const [step, setStep] = useState<Step>('NAME')
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Функция для плавного перехода между шагами
  const transitionToStep = (newStep: Step) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setStep(newStep)
      setIsTransitioning(false)
    }, 150)
  }

  const [city, setCity] = useState<string>(() => {
    try { return localStorage.getItem('onb.city') ?? '' } catch { return '' }
  })
  const [cityId, setCityId] = useState<string | null>(() => {
    try { return localStorage.getItem('onb.cityId') ?? null } catch { return null }
  })
  const [displayName, setDisplayName] = useState<string>(() => {
    try { return localStorage.getItem('onb.displayName') ?? '' } catch { return '' }
  })
  const [birthDate, setBirthDate] = useState<string>(() => {
    try { return localStorage.getItem('onb.birthDate') ?? '' } catch { return '' }
  }) // DD/MM/YYYY
  
  // Отдельные состояния для полей даты
  const [day, setDay] = useState<string>(() => {
    try { 
      const stored = localStorage.getItem('onb.birthDate') ?? ''
      const parts = stored.split('/')
      return parts[0] || ''
    } catch { return '' }
  })
  const [month, setMonth] = useState<string>(() => {
    try { 
      const stored = localStorage.getItem('onb.birthDate') ?? ''
      const parts = stored.split('/')
      return parts[1] || ''
    } catch { return '' }
  })
  const [year, setYear] = useState<string>(() => {
    try { 
      const stored = localStorage.getItem('onb.birthDate') ?? ''
      const parts = stored.split('/')
      return parts[2] || '' // Берем полный год
    } catch { return '' }
  })
  const [gender, setGender] = useState<typeof GenderEnum._type | null>(() => {
    try {
      const v = localStorage.getItem('onb.gender')
      return v && (GenderEnum.options as readonly string[]).includes(v) ? (v as any) : null
    } catch { return null }
  })
  const [sex, setSex] = useState<typeof SexEnum._type | null>(() => {
    try {
      const v = localStorage.getItem('onb.sex')
      return v && (SexEnum.options as readonly string[]).includes(v) ? (v as any) : null
    } catch { return null }
  })
  const [photoUrls, setPhotoUrls] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('onb.photos')
      const arr = raw ? JSON.parse(raw) : null
      if (Array.isArray(arr) && arr.length === 3 && arr.every(s => typeof s === 'string')) return arr as string[]
      return ['', '', '']
    } catch { return ['', '', ''] }
  })
  const [photoUploading, setPhotoUploading] = useState<boolean[]>([false, false, false])
  const [photoPreview, setPhotoPreview] = useState<{file: File, index: number} | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Функции для подтверждения загрузки фото
  const confirmPhotoUpload = async () => {
    if (!photoPreview) return
    
    const { file, index } = photoPreview
    setPhotoUploading(prev => prev.map((v, idx) => idx === index ? true : v))
    setPhotoPreview(null)
    
    try {
      // Обрезаем фото под формат 9:16 и уменьшаем до HD
      const processedImage = await cropImageTo9x16(file, 0.9)
      const up = await uploadImage(processedImage)
      if (!up.ok) throw new Error(up.message || 'Не удалось загрузить')
      setPhotoUrls(prev => {
        if (prev.includes(up.url)) { toast.error('Это фото уже добавлено'); return prev }
        return prev.map((v, idx) => idx === index ? up.url : v)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setPhotoUploading(prev => prev.map((v, idx) => idx === index ? false : v))
    }
  }

  const cancelPhotoUpload = () => {
    setPhotoPreview(null)
  }

  // авто-установка пола для уже определенных ориентаций (кроме Гей/Лесби)
  useEffect(() => {
    if (!gender) return
    // НЕ устанавливаем пол автоматически для GAY и LESBIAN
    // Пользователь должен выбрать пол самостоятельно
    // Для других ориентаций пол не устанавливается автоматически
  }, [gender])

  // Логика для Гей/Лесби: при выборе пола определяем ориентацию
  useEffect(() => {
    // Если выбрана ориентация Гей/Лесби (GAY) и выбран пол
    if (gender === 'GAY' && sex) {
      if (sex === 'MALE') {
        // Мужской пол = Гей (оставляем GAY)
        // setGender('GAY') - уже установлен, ничего не меняем
      } else if (sex === 'FEMALE') {
        // Женский пол = Лесби
        setGender('LESBIAN')
      }
    }
  }, [gender, sex])

  const canContinue = useMemo(() => {
    switch (step) {
      case 'NAME': return /^[А-Яа-яЁё]{2,16}$/.test(displayName)
      case 'BIRTHDATE': {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) return false
        const age = calcAge(parseBirthDateDDMMYYYY(birthDate))
        return age !== null && age >= 13 && age <= 19
      }
      case 'SEX': return Boolean(sex)
      case 'GENDER': return Boolean(gender)
      case 'CITY': return Boolean(cityId)
      case 'PHOTOS': return photoUrls.every(Boolean)
      default: return true
    }
  }, [step, displayName, birthDate, sex, gender, cityId, photoUrls])

  function notifyValidation(): void {
    if (step === 'NAME') {
      if (!/^[А-Яа-яЁё]+$/.test(displayName)) toast.error('Только кириллица!')
      if (displayName.length < 2) toast.error('Не менее 2 символов!')
      if (displayName.length > 16) toast.error('Не более 16 символов!')
      return
    }
    if (step === 'BIRTHDATE') {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) { toast.error('Дата в формате ДД/ММ/ГГГГ'); return }
      const age = calcAge(parseBirthDateDDMMYYYY(birthDate))
      if (age === null) { toast.error('Некорректная дата'); return }
      if (age < 13 || age > 19) { toast.error('Доступно только для 13–19 лет'); return }
      return
    }
    if (step === 'SEX' && !sex) toast.error('Укажите пол')
    if (step === 'GENDER' && !gender) toast.error('Выберите ориентацию')
    if (step === 'CITY') {
      if (!cityId) toast.error('Выберите город из списка')
      return
    }
    if (step === 'PHOTOS' && !photoUrls.every(Boolean)) toast.error('Загрузите 3 фото')
  }

  useEffect(() => {
    if (!ready) return
    if (!isWebApp) return
  }, [ready, isWebApp])

  useEffect(() => { try { localStorage.setItem('onb.city', city) } catch {} }, [city])
  useEffect(() => { try { cityId ? localStorage.setItem('onb.cityId', cityId) : localStorage.removeItem('onb.cityId') } catch {} }, [cityId])
  useEffect(() => { try { localStorage.setItem('onb.displayName', displayName) } catch {} }, [displayName])
  useEffect(() => { try { localStorage.setItem('onb.birthDate', birthDate) } catch {} }, [birthDate])
  
  // Синхронизация отдельных полей с общим состоянием
  useEffect(() => {
    const newBirthDate = [day, month, year].filter(Boolean).join('/')
    if (newBirthDate !== birthDate) {
      setBirthDate(newBirthDate)
    }
  }, [day, month, year])
  useEffect(() => { try { localStorage.setItem('onb.gender', gender ?? '') } catch {} }, [gender])
  useEffect(() => { try { localStorage.setItem('onb.sex', sex ?? '') } catch {} }, [sex])
  useEffect(() => { try { localStorage.setItem('onb.photos', JSON.stringify(photoUrls)) } catch {} }, [photoUrls])

  function onBirthDateInput(e: ChangeEvent<HTMLInputElement>): void {
    let v = e.target.value.replace(/[^\d]/g, '')
    if (v.length > 8) v = v.slice(0, 8)
    const parts = [v.slice(0, 2), v.slice(2, 4), v.slice(4, 8)].filter(Boolean)
    setBirthDate(parts.join('/'))
  }

  // Функции для обработки ввода в отдельные поля
  function onDayInput(e: ChangeEvent<HTMLInputElement>): void {
    let value = e.target.value.replace(/[^\d]/g, '')
    if (value.length > 2) value = value.slice(0, 2)
    setDay(value)
    
    // Автоматический переход к следующему полю
    if (value.length === 2) {
      const nextField = e.target.parentElement?.querySelector('input[placeholder="ММ"]') as HTMLInputElement
      nextField?.focus()
    }
  }

  function onMonthInput(e: ChangeEvent<HTMLInputElement>): void {
    let value = e.target.value.replace(/[^\d]/g, '')
    if (value.length > 2) value = value.slice(0, 2)
    setMonth(value)
    
    // Автоматический переход к следующему полю
    if (value.length === 2) {
      const nextField = e.target.parentElement?.querySelector('input[placeholder="ГГГГ"]') as HTMLInputElement
      nextField?.focus()
    }
  }

  function onYearInput(e: ChangeEvent<HTMLInputElement>): void {
    let value = e.target.value.replace(/[^\d]/g, '')
    
    // Если первая цифра не 1 или 2, не принимаем ввод
    if (value.length > 0 && value[0] !== '1' && value[0] !== '2') {
      return
    }
    
    if (value.length > 4) value = value.slice(0, 4)
    setYear(value)
  }

  // Функции для обработки нажатий клавиш
  function onDayKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Backspace' && day === '') {
      // Если поле дня пустое и нажали Backspace, переходим к предыдущему полю
      const prevField = e.currentTarget.parentElement?.querySelector('input[placeholder="ГГГГ"]') as HTMLInputElement
      if (prevField) {
        prevField.focus()
        prevField.setSelectionRange(prevField.value.length, prevField.value.length)
      }
    }
  }

  function onMonthKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Backspace' && month === '') {
      // Если поле месяца пустое и нажали Backspace, переходим к полю дня
      const prevField = e.currentTarget.parentElement?.querySelector('input[placeholder="ДД"]') as HTMLInputElement
      if (prevField) {
        prevField.focus()
        prevField.setSelectionRange(prevField.value.length, prevField.value.length)
      }
    }
  }

  function onYearKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Backspace' && year === '') {
      // Если поле года пустое и нажали Backspace, переходим к полю месяца
      const prevField = e.currentTarget.parentElement?.querySelector('input[placeholder="ММ"]') as HTMLInputElement
      if (prevField) {
        prevField.focus()
        prevField.setSelectionRange(prevField.value.length, prevField.value.length)
      }
    }
  }

  async function submit(): Promise<void> {
    setError(null)
    setStep('SUBMITTING')
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      const payload = {
        initData,
        city: city.trim(),
        displayName: displayName.trim(),
        birthDate,
        gender: gender!,
        sex: isGenderRequiresSex(gender!) ? sex : null,
        photos: photoUrls.map(url => ({ url })),
      }
      const resp = await submitBaseProfile(payload as any)
      if (!resp.ok) throw new Error(resp.message || 'Ошибка отправки')
      // Перенаправляем на страницу ожидания модерации
      window.location.reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Неизвестная ошибка'
      setError(msg)
      if (/birthdate|возраст|age/i.test(msg)) setStep('BIRTHDATE')
      else if (/sex|пол/i.test(msg)) setStep('SEX')
      else setStep('PHOTOS')
    }
  }

  const title = useMemo(() => {
    switch (step) {
      case 'NAME': return 'Как вас зовут?'
      case 'BIRTHDATE': return 'Сколько вам лет?'
      case 'SEX': return 'Какой у вас пол?'
      case 'GENDER': return 'Какая у вас ориентация?'
      case 'CITY': return 'Откуда вы?'
      case 'PHOTOS': return 'Добавьте фото'
      case 'SUBMITTING': return 'Отправка анкеты…'
      default: return ''
    }
  }, [step])

  const stepsOrder: Step[] = ['NAME','BIRTHDATE','SEX','GENDER','CITY','PHOTOS']
  const activeIdx = stepsOrder.indexOf(step as any)
  const isFlowStep = stepsOrder.includes(step as any)

  function openTelegramChannel(url: string): void {
    try {
      if (window?.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url)
        return
      }
    } catch {}
    window.open(url, '_blank', 'noopener')
  }

  // Новый layout — центральное поле + фиксированная нижняя панель с кнопками
  return (
    <div className="min-h-screen flex flex-col">
      <div className="pt-4">
        {isFlowStep ? (
          <div className="progress-segments max-w-md mx-auto">
            {stepsOrder.map((_, i) => (
              <div key={i} className={`seg transition-all duration-500 ease-in-out ${i <= activeIdx ? 'active' : ''}`} />
            ))}
          </div>
        ) : null}
      </div>
      <div className={`mt-3 text-center text-2xl font-semibold transition-all duration-150 ease-in-out ${isTransitioning ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>{title}</div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className={`w-full max-w-md transition-all duration-150 ease-in-out ${isTransitioning ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
          {error ? <div className="mb-3 text-red-500 text-sm text-center">{error}</div> : null}


          {step === 'NAME' ? (
            <div>
              <input className="input" placeholder="Введите имя..." value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
          ) : null}

          {step === 'BIRTHDATE' ? (
            <div className="flex items-center justify-center gap-3">
              <input 
                className="w-20 text-center text-4xl font-medium bg-transparent border-none outline-none focus:outline-none placeholder:text-muted" 
                placeholder="ДД" 
                value={day} 
                onChange={onDayInput} 
                onKeyDown={onDayKeyDown}
                inputMode="numeric" 
                maxLength={2}
              />
              <span className="text-4xl font-medium">/</span>
              <input 
                className="w-20 text-center text-4xl font-medium bg-transparent border-none outline-none focus:outline-none placeholder:text-muted" 
                placeholder="ММ" 
                value={month} 
                onChange={onMonthInput} 
                onKeyDown={onMonthKeyDown}
                inputMode="numeric" 
                maxLength={2}
              />
              <span className="text-4xl font-medium">/</span>
              <input 
                className="w-24 text-center text-4xl font-medium bg-transparent border-none outline-none focus:outline-none placeholder:text-muted" 
                placeholder="ГГГГ" 
                value={year} 
                onChange={onYearInput} 
                onKeyDown={onYearKeyDown}
                inputMode="numeric" 
                maxLength={4}
              />
            </div>
          ) : null}

          {step === 'SEX' ? (
            <div className="grid grid-cols-2 gap-2">
              {SexEnum.options.map(s => (
                <button key={s} className={`btn ${sex === s ? 'btn-primary' : ''}`} onClick={() => setSex(s)}>{s === 'MALE' ? 'Мужской' : 'Женский'}</button>
              ))}
            </div>
          ) : null}

          {step === 'GENDER' ? (
            <div className="grid grid-cols-2 gap-2">
              {/* Гей/Лесби - сдвоенная кнопка */}
              <button 
                className={`btn col-span-2 ${gender === 'GAY' || gender === 'LESBIAN' ? 'btn-primary' : ''}`} 
                onClick={() => setGender('GAY')}
              >
                Гей/Лесби
              </button>
              
              {/* Бисексуал */}
              <button 
                className={`btn ${gender === 'BISEXUAL' ? 'btn-primary' : ''}`} 
                onClick={() => setGender('BISEXUAL')}
              >
                Бисексуал
              </button>
              
              {/* Пансексуал */}
              <button 
                className={`btn ${gender === 'PANSEXUAL' ? 'btn-primary' : ''}`} 
                onClick={() => setGender('PANSEXUAL')}
              >
                Пансексуал
              </button>
              
              {/* Квир */}
              <button 
                className={`btn ${gender === 'QUEER' ? 'btn-primary' : ''}`} 
                onClick={() => setGender('QUEER')}
              >
                Квир
              </button>
              
              {/* Асексуал */}
              <button 
                className={`btn ${gender === 'ASEXUAL' ? 'btn-primary' : ''}`} 
                onClick={() => setGender('ASEXUAL')}
              >
                Асексуал
              </button>
            </div>
          ) : null}

          {step === 'CITY' ? (
            <DaDataCityAutocomplete
              value={city}
              onChange={v => { setCity(v); setCityId(null) }}
              onSelect={(c: DaDataCityItem) => { setCity(c.name); setCityId(c.id) }}
              placeholder="Введите город..."
            />
          ) : null}

          {step === 'PHOTOS' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3 justify-center">
                {[0, 1, 2].map(i => (
                  <label key={i} className="block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setPhotoPreview({ file, index: i })
                      }}
                    />
                    <div className="h-32 w-24 rounded-lg border border-accent flex items-center justify-center overflow-hidden" style={{ background: 'color-mix(in oklab, var(--color-bg) 92%, var(--color-accent) 8%)' }}>
                      {photoUploading[i] ? (
                        <div className="text-xs text-muted">...</div>
                      ) : (photoUrls[i] ? (
                        <img src={photoUrls[i]} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-2xl">+</span>
                      ))}
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-xs text-muted text-center max-w-sm">
                Только ваши фото, рисунки или природа. Не принимаются NSFW, текст/буквы и т.п.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Модальное окно для подтверждения загрузки фото */}
      <PhotoPreviewModal 
        file={photoPreview?.file || null}
        onConfirm={confirmPhotoUpload}
        onCancel={cancelPhotoUpload}
      />

      <div className="sticky bottom-0 left-0 right-0 px-4 pb-4 pt-2" style={{ background: 'var(--color-bg)' }}>
        {isFlowStep ? (
          <div className="max-w-md mx-auto flex gap-2">
            {step !== 'NAME' ? (
              <button className="btn w-1/2" onClick={() => {
                if (step === 'BIRTHDATE') transitionToStep('NAME')
                else if (step === 'SEX') transitionToStep('BIRTHDATE')
                else if (step === 'GENDER') transitionToStep('SEX')
                else if (step === 'CITY') transitionToStep('GENDER')
                else if (step === 'PHOTOS') transitionToStep('CITY')
              }}>Назад</button>
            ) : <div className="w-1/2" />}

            {step === 'PHOTOS' ? (
              <button className="btn btn-primary w-1/2" onClick={() => { if (!canContinue) { notifyValidation(); return } void submit() }}>Отправить</button>
            ) : (
              <button className="btn btn-primary w-1/2" onClick={() => {
                if (!canContinue) { notifyValidation(); return }
                if (step === 'NAME') transitionToStep('BIRTHDATE')
                else if (step === 'BIRTHDATE') transitionToStep('SEX')
                else if (step === 'SEX') transitionToStep('GENDER')
                else if (step === 'GENDER') transitionToStep('CITY')
                else if (step === 'CITY') transitionToStep('PHOTOS')
              }}>Далее</button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}



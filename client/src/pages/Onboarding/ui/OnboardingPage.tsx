import type { JSX, ChangeEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Container from '@/shared/ui/layout/Container'
import CityAutocomplete from '@/shared/ui/CityAutocomplete/CityAutocomplete'
import { useTelegramAuth } from '@/app/providers/TelegramAuthProvider'
import { GenderEnum, SexEnum, submitBaseProfile } from '@/shared/api/profile'
import { uploadImage } from '@/shared/api/cdn'
import { compressImageToJpeg } from '@/shared/lib/image'
import { toast } from 'sonner'
import { GENDER_FLAG } from '@/shared/lib/gender'

type Step = 'CITY' | 'NAME' | 'BIRTHDATE' | 'GENDER' | 'SEX' | 'PHOTOS' | 'SUBMITTING' | 'DONE'

function isGenderRequiresSex(g: typeof GenderEnum._type): boolean {
  return g === 'GAY' || g === 'LESBIAN'
}

export default function OnboardingPage(): JSX.Element {
  const { ready, isWebApp } = useTelegramAuth()
  const [step, setStep] = useState<Step>('CITY')

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
  const [error, setError] = useState<string | null>(null)

  // авто-установка пола для GAY/LESBIAN и пропуск шага SEX
  useEffect(() => {
    if (!gender) return
    if (gender === 'GAY') {
      setSex('MALE')
    } else if (gender === 'LESBIAN') {
      setSex('FEMALE')
    }
  }, [gender])

  const canContinue = useMemo(() => {
    switch (step) {
      case 'CITY': return Boolean(cityId)
      case 'NAME': return /^[А-Яа-яЁё]{2,16}$/.test(displayName)
      case 'BIRTHDATE': return /^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)
      case 'GENDER': return Boolean(gender)
      case 'SEX': return !gender || !isGenderRequiresSex(gender) || Boolean(sex)
      case 'PHOTOS': return photoUrls.every(Boolean)
      default: return true
    }
  }, [step, cityId, displayName, birthDate, gender, sex, photoUrls])

  function notifyValidation(): void {
    if (step === 'NAME') {
      if (!/^[А-Яа-яЁё]+$/.test(displayName)) toast.error('Только кириллица!')
      if (displayName.length < 2) toast.error('Не менее 2 символов!')
      if (displayName.length > 16) toast.error('Не более 16 символов!')
      return
    }
    if (step === 'CITY') {
      if (!cityId) toast.error('Выберите город из списка')
      return
    }
    if (step === 'BIRTHDATE') {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) toast.error('Дата в формате ДД/ММ/ГГГГ')
      return
    }
    if (step === 'GENDER' && !gender) toast.error('Выберите гендер')
    if (step === 'SEX' && isGenderRequiresSex(gender!) && !sex) toast.error('Укажите пол')
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
  useEffect(() => { try { localStorage.setItem('onb.gender', gender ?? '') } catch {} }, [gender])
  useEffect(() => { try { localStorage.setItem('onb.sex', sex ?? '') } catch {} }, [sex])
  useEffect(() => { try { localStorage.setItem('onb.photos', JSON.stringify(photoUrls)) } catch {} }, [photoUrls])

  function onBirthDateInput(e: ChangeEvent<HTMLInputElement>): void {
    let v = e.target.value.replace(/[^\d]/g, '')
    if (v.length > 8) v = v.slice(0, 8)
    const parts = [v.slice(0, 2), v.slice(2, 4), v.slice(4, 8)].filter(Boolean)
    setBirthDate(parts.join('/'))
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
      setStep('DONE')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      setStep('PHOTOS')
    }
  }

  const title = useMemo(() => {
    switch (step) {
      case 'CITY': return 'Откуда вы?'
      case 'NAME': return 'Как вас зовут?'
      case 'BIRTHDATE': return 'Сколько вам лет?'
      case 'GENDER': return 'Какая у вас ориентация?'
      case 'SEX': return 'Какой у вас пол?'
      case 'PHOTOS': return 'Добавьте фото'
      case 'SUBMITTING': return 'Отправка анкеты…'
      case 'DONE': return 'Анкета отправлена на модерацию'
      default: return ''
    }
  }, [step])

  const stepsOrder: Step[] = ['CITY','NAME','BIRTHDATE','GENDER','SEX','PHOTOS']
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
              <div key={i} className={`seg ${i <= activeIdx ? 'active' : ''}`} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3 text-center text-2xl font-semibold">{title}</div>
      <div className="flex-1 flex items-center justify-center px-4" style={step === 'DONE' ? { transform: 'translateY(-8%)' } : undefined}>
        <div className="w-full max-w-md">
          {error ? <div className="mb-3 text-red-500 text-sm text-center">{error}</div> : null}

          {step === 'DONE' ? (
            <div className="text-center space-y-2">
              <div className="text-lg">Анкета на модерации</div>
              <div className="text-sm text-muted">
                Мы проверяем вашу анкету. Мы проверим быстрее, если вы будете участником нашего телеграм‑канала.
              </div>
            </div>
          ) : null}

          {step === 'CITY' ? (
            <CityAutocomplete
              value={city}
              onChange={v => { setCity(v); setCityId(null) }}
              onSelect={c => { setCity(c.name); setCityId(c.id) }}
              placeholder="Введите город..."
            />
          ) : null}

          {step === 'NAME' ? (
            <div>
              <input className="input" placeholder="Введите имя..." value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
          ) : null}

          {step === 'BIRTHDATE' ? (
            <div>
              <input className="input" placeholder="ДД/ММ/ГГГГ" value={birthDate} onChange={onBirthDateInput} inputMode="numeric" />
            </div>
          ) : null}

          {step === 'GENDER' ? (
            <div className="grid grid-cols-2 gap-2">
              {GenderEnum.options.map(g => (
                <button key={g} className={`btn ${gender === g ? 'btn-primary' : ''}`} onClick={() => setGender(g)}>
                  <span className="inline-flex items-center gap-2">
                    <img src={`/flags/${GENDER_FLAG[g]}`} alt="" width={18} height={18} style={{ borderRadius: '999px' }} />
                    {g}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {step === 'SEX' ? (
            <div className="grid grid-cols-2 gap-2">
              {SexEnum.options.map(s => (
                <button key={s} className={`btn ${sex === s ? 'btn-primary' : ''}`} onClick={() => setSex(s)}>{s === 'MALE' ? 'Мужской' : 'Женский'}</button>
              ))}
            </div>
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
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setPhotoUploading(prev => prev.map((v, idx) => idx === i ? true : v))
                        try {
                          let input: File | Blob = file
                          try { input = await compressImageToJpeg(file, 1080, 0.82) } catch {}
                          const up = await uploadImage(input)
                          if (!up.ok) throw new Error(up.message || 'Не удалось загрузить')
                          setPhotoUrls(prev => {
                            if (prev.includes(up.url)) { toast.error('Это фото уже добавлено'); return prev }
                            return prev.map((v, idx) => idx === i ? up.url : v)
                          })
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Ошибка загрузки')
                        } finally {
                          setPhotoUploading(prev => prev.map((v, idx) => idx === i ? false : v))
                        }
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

      <div className="sticky bottom-0 left-0 right-0 px-4 pb-4 pt-2" style={{ background: 'var(--color-bg)' }}>
        {isFlowStep ? (
          <div className="max-w-md mx-auto flex gap-2">
            {step !== 'CITY' ? (
              <button className="btn w-1/2" onClick={() => {
                if (step === 'NAME') setStep('CITY')
                else if (step === 'BIRTHDATE') setStep('NAME')
                else if (step === 'GENDER') setStep('BIRTHDATE')
                else if (step === 'SEX') setStep('GENDER')
                else if (step === 'PHOTOS') setStep('SEX')
              }}>Назад</button>
            ) : <div className="w-1/2" />}

            {step === 'PHOTOS' ? (
              <button className="btn btn-primary w-1/2" onClick={() => { if (!canContinue) { notifyValidation(); return } void submit() }}>Отправить</button>
            ) : (
              <button className="btn btn-primary w-1/2" onClick={() => {
                if (!canContinue) { notifyValidation(); return }
                if (step === 'CITY') setStep('NAME')
                else if (step === 'NAME') setStep('BIRTHDATE')
                else if (step === 'BIRTHDATE') setStep('GENDER')
                else if (step === 'GENDER') setStep('SEX')
                else if (step === 'SEX') setStep('PHOTOS')
              }}>Далее</button>
            )}
          </div>
        ) : step === 'DONE' ? (
          <div className="max-w-md mx-auto">
            <button className="btn btn-primary w-full" onClick={() => openTelegramChannel('https://t.me/spectr_info')}>
              <span className="inline-flex items-center gap-2 justify-center">
                <img src="https://cdn.spectrmod.ru/Spectr.jpg" alt="Spectr Reflex" width={24} height={24} style={{ borderRadius: '999px' }} />
                Spectr Reflex
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}



import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LookingForEnum, submitProfileDetails } from '@/shared/api/profile'

function parseBirthDateDDMMYYYY(s: string | null): Date | null {
  if (!s) return null
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

const RU_LABELS: Record<typeof LookingForEnum._type, string> = {
  LONG_DISTANCE: 'Отношения на расстоянии',
  LOCAL: 'Отношения локальные',
  SEX: 'Секс',
  COMMUNICATION: 'Общение',
  EXCHANGE: 'Обмен',
}

type DetailsStep = 'DESC' | 'LOOKING' | 'EXTRA'

export default function DetailsPage(): JSX.Element {
  const [step, setStep] = useState<DetailsStep>('DESC')

  const birthDateStr = (typeof window !== 'undefined') ? localStorage.getItem('onb.birthDate') : null
  const birthDate = parseBirthDateDDMMYYYY(birthDateStr)
  const age = calcAge(birthDate)
  const gender = (typeof window !== 'undefined') ? localStorage.getItem('onb.gender') : null
  const isAsexual = gender === 'ASEXUAL'

  const allowSex = (age !== null && age >= 16) && !isAsexual
  const allowExchange = (age !== null && age >= 14)

  const [description, setDescription] = useState<string>(() => {
    try { return localStorage.getItem('details.description') ?? '' } catch { return '' }
  })
  const [consent, setConsent] = useState<boolean>(() => {
    try { return localStorage.getItem('details.consent') === '1' } catch { return false }
  })
  const [lookingFor, setLookingFor] = useState<Set<typeof LookingForEnum._type>>(() => {
    try {
      const raw = localStorage.getItem('details.lookingFor')
      const arr = raw ? JSON.parse(raw) : []
      return new Set((Array.isArray(arr) ? arr : []).filter((v: unknown) => (LookingForEnum.options as readonly string[]).includes(String(v))) as any)
    } catch { return new Set() }
  })
  const [height, setHeight] = useState<number | ''>(() => {
    try { const v = localStorage.getItem('details.height'); return v ? Number(v) : '' } catch { return '' }
  })
  const [weight, setWeight] = useState<number | ''>(() => {
    try { const v = localStorage.getItem('details.weight'); return v ? Number(v) : '' } catch { return '' }
  })
  const [wand, setWand] = useState<number | ''>(() => {
    try { const v = localStorage.getItem('details.wand'); return v ? Number(v) : '' } catch { return '' }
  })
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return consent && description.trim().length >= 24 && description.trim().length <= 1200
  }, [consent, description])

  const canNextFromDesc = description.trim().length >= 24

  async function onSubmit(): Promise<void> {
    if (!consent) { toast.error('Нужно согласиться с правилами'); return }
    if (!canSubmit) {
      if (description.trim().length < 24) toast.error('Описание слишком короткое')
      return
    }
    setSubmitting(true)
    try {
      const initData = window?.Telegram?.WebApp?.initData || ''
      // sanitize lookingFor by age/gender
      const validLooking = Array.from(lookingFor).filter(v => {
        if (v === 'SEX' && !allowSex) return false
        if (v === 'EXCHANGE' && !allowExchange) return false
        return true
      })
      const resp = await submitProfileDetails({
        initData,
        description: description.trim(),
        consentAccepted: true,
        lookingFor: validLooking as any,
        heightCm: typeof height === 'number' ? height : undefined,
        weightKg: typeof weight === 'number' ? weight : undefined,
        wandSizeCm: typeof wand === 'number' ? wand : undefined,
      } as any)
      if (!resp.ok) throw new Error(resp.message || 'Ошибка отправки')
      toast.success('Отправлено на модерацию')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleLooking(v: typeof LookingForEnum._type): void {
    if (v === 'SEX' && !allowSex) return
    if (v === 'EXCHANGE' && !allowExchange) return
    setLookingFor(prev => {
      const n = new Set(prev)
      if (n.has(v)) n.delete(v); else n.add(v)
      return n
    })
  }

  // persist state
  useEffect(() => { try { localStorage.setItem('details.description', description) } catch {} }, [description])
  useEffect(() => { try { localStorage.setItem('details.consent', consent ? '1' : '0') } catch {} }, [consent])
  useEffect(() => { try { localStorage.setItem('details.lookingFor', JSON.stringify(Array.from(lookingFor))) } catch {} }, [lookingFor])
  useEffect(() => { try { localStorage.setItem('details.height', typeof height === 'number' ? String(height) : '') } catch {} }, [height])
  useEffect(() => { try { localStorage.setItem('details.weight', typeof weight === 'number' ? String(weight) : '') } catch {} }, [weight])
  useEffect(() => { try { localStorage.setItem('details.wand', typeof wand === 'number' ? String(wand) : '') } catch {} }, [wand])

  const heading = step === 'DESC' ? 'Почти готово' : step === 'LOOKING' ? 'Что ищете?' : 'Дополнительная информация'

  const lookingOptions = LookingForEnum.options.filter(v => {
    if (v === 'SEX' && !allowSex) return false
    if (v === 'EXCHANGE' && !allowExchange) return false
    return true
  })

  return (
    <div className="min-h-screen flex flex-col">
      <div className="pt-5 text-center text-2xl font-semibold">{heading}</div>
      {step === 'LOOKING' ? (
        <div className="mt-1 text-center text-sm text-muted">Также вы можете заполнить дополнительную информацию</div>
      ) : null}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          {step === 'DESC' ? (
            <div>
              <div className="label mb-1">Описание</div>
              <textarea className="input" rows={6} placeholder="Расскажите о себе..." value={description} onChange={e => setDescription(e.target.value)} />
              <div className="text-xs text-muted mt-1">От 24 до 1200 символов</div>
            </div>
          ) : null}

          {step === 'LOOKING' ? (
            <div>
              <div className="grid grid-cols-1 gap-2">
                {lookingOptions.map(v => (
                  <button key={v} className={`btn ${lookingFor.has(v) ? 'btn-primary' : ''}`} onClick={() => toggleLooking(v)}>{RU_LABELS[v]}</button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'EXTRA' ? (
            <div className="space-y-6">
              <div>
                <div className="text-3xl font-bold text-center cursor-pointer" onClick={() => setHeight('')}>{typeof height === 'number' ? `${height} см` : '-'}</div>
                <div className="label mb-1 text-center">Рост</div>
                <input type="range" min={130} max={220} value={typeof height === 'number' ? height : 175} onChange={e => setHeight(Number(e.target.value))} className="w-full slider" />
              </div>
              <div>
                <div className="text-3xl font-bold text-center cursor-pointer" onClick={() => setWeight('')}>{typeof weight === 'number' ? `${weight} кг` : '-'}</div>
                <div className="label mb-1 text-center">Вес</div>
                <input type="range" min={30} max={300} value={typeof weight === 'number' ? weight : 70} onChange={e => setWeight(Number(e.target.value))} className="w-full slider" />
              </div>
              {allowSex ? (
                <div>
                  <div className="text-3xl font-bold text-center cursor-pointer" onClick={() => setWand('')}>{typeof wand === 'number' ? `${wand} см` : '-'}</div>
                  <div className="label mb-1 text-center">Размер</div>
                  <input type="range" min={3} max={30} value={typeof wand === 'number' ? wand : 15} onChange={e => setWand(Number(e.target.value))} className="w-full slider" />
                </div>
              ) : null}
              <div className="flex items-center justify-center">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                  <span className="text-sm">Согласен с правилами и принимаю сбор данных (cookies)</span>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="sticky bottom-0 left-0 right-0 px-4 pb-4 pt-2" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-md mx-auto flex gap-2 items-center">
          {step !== 'DESC' ? (
            <button className="btn w-1/2" onClick={() => setStep(step === 'LOOKING' ? 'DESC' : 'LOOKING')}>Назад</button>
          ) : <div className="w-1/2" />}

          {step === 'DESC' ? (
            <button className="btn btn-primary w-1/2" onClick={() => { if (!canNextFromDesc) { toast.error('Описание слишком короткое'); return } setStep('LOOKING') }}>Далее</button>
          ) : step === 'LOOKING' ? (
            <button className="btn btn-primary w-1/2" onClick={() => { if (lookingFor.size === 0) { toast.error('Выберите хотя бы один вариант'); return } setStep('EXTRA') }}>Далее</button>
          ) : (
            <button className="btn btn-primary w-1/2" onClick={() => void onSubmit()}>Отправить</button>
          )}
        </div>
      </div>
    </div>
  )
}



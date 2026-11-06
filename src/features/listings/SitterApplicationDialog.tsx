import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { PhotoUploadField } from './PhotoUploadField'

const LANGUAGES = ['en', 'fr', 'de', 'es']
const EXPERIENCE = ['cats', 'dogs', 'medical_care', 'large_dogs', 'puppies']

type SitterApplicationDialogProps = {
  userId: string
  onClose: () => void
}

export function SitterApplicationDialog({ userId, onClose }: SitterApplicationDialogProps) {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [photo, setPhoto] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [published, setPublished] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    if (photo.length !== 1) {
      setErrorMessage(t('sitterPhotoRequired'))
      return
    }
    const formData = new FormData(event.currentTarget)
    const destinations = [1, 2, 3].map((number) => String(formData.get(`destination_${number}`) ?? '').trim()).filter(Boolean)
    if (destinations.length === 0) {
      setErrorMessage(t('destinationRequired'))
      return
    }
    setBusy(true)
    setErrorMessage('')
    let uploadedPath = ''
    try {
      const file = photo[0]
      const extension = file.type === 'image/png' ? 'png'
        : file.type === 'image/webp' ? 'webp'
          : file.type === 'image/avif' ? 'avif'
            : 'jpg'
      uploadedPath = `${userId}/${crypto.randomUUID()}-sitter.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(uploadedPath, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { data: publicUrl } = supabase.storage.from('listing-photos').getPublicUrl(uploadedPath)
      const { error } = await supabase.from('sitter_applications').insert({
        sitter_id: userId,
        destinations,
        starts_on: String(formData.get('starts_on')),
        ends_on: String(formData.get('ends_on')),
        party_type: String(formData.get('party_type')) as 'single' | 'couple' | 'family',
        languages: formData.getAll('languages').map(String),
        experience: formData.getAll('experience').map(String),
        about: String(formData.get('about')).trim(),
        photo_url: publicUrl.publicUrl,
      })
      if (error) throw error
      setPublished(true)
    } catch (error) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('listing-photos').remove([uploadedPath])
        if (cleanupError) console.error('Unable to remove sitter photo after a failed application:', cleanupError.message)
      }
      setErrorMessage(getSitterError(error, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog create-dialog" role="dialog" aria-modal="true" aria-labelledby="sitter-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        {published ? (
          <div className="listing-success">
            <span aria-hidden="true">✓</span>
            <h2 id="sitter-title">{t('sitterPublishedTitle')}</h2>
            <p>{t('sitterPublishedText')}</p>
            <button className="button button-primary full-button" type="button" onClick={onClose}>{t('close')}</button>
          </div>
        ) : (
          <>
            <p className="eyebrow">{t('sitterFormEyebrow')}</p>
            <h2 id="sitter-title">{t('sitterFormTitle')}</h2>
            <form className="listing-form" onSubmit={(event) => void submit(event)}>
              <fieldset className="destination-fieldset">
                <legend>{t('sitterDestinations')}</legend>
                {[1, 2, 3].map((number) => (
                  <label className="form-label" key={number}>
                    {t('destinationNumber', { number })}
                    <input className="form-input" name={`destination_${number}`} maxLength={100} placeholder={t('cityCountryPlaceholder')} />
                  </label>
                ))}
              </fieldset>
              <div className="form-row">
                <label className="form-label">{t('startDate')}<SitterDateInput name="starts_on" value={startDate} onChange={setStartDate} /></label>
                <label className="form-label">{t('endDate')}<SitterDateInput name="ends_on" value={endDate} min={startDate || undefined} onChange={setEndDate} /></label>
              </div>
              <fieldset className="choice-fieldset">
                <legend>{t('whoAreYou')}</legend>
                <div className="choice-grid choice-inline">
                  {(['single', 'couple', 'family'] as const).map((value) => <label key={value}><input type="radio" name="party_type" value={value} required />{t(`partyTypes.${value}`)}</label>)}
                </div>
              </fieldset>
              <fieldset className="choice-fieldset">
                <legend>{t('languagesYouSpeak')}</legend>
                <div className="choice-grid choice-inline">
                  {LANGUAGES.map((value) => <label key={value}><input type="checkbox" name="languages" value={value} />{value.toUpperCase()}</label>)}
                </div>
              </fieldset>
              <fieldset className="choice-fieldset">
                <legend>{t('experience')}</legend>
                <div className="choice-grid">
                  {EXPERIENCE.map((value) => <label key={value}><input type="checkbox" name="experience" value={value} />{t(`sitterExperience.${value}`)}</label>)}
                </div>
              </fieldset>
              <label className="form-label">{t('aboutYou')}<textarea className="form-input form-textarea" name="about" required minLength={20} maxLength={2000} rows={4} placeholder={t('aboutSitterPlaceholder')} /></label>
              <div className="form-label">{t('yourPhoto')}<PhotoUploadField files={photo} onChange={setPhoto} disabled={busy || photo.length === 1} maxFiles={1} /></div>
              {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
              <button className="button button-primary full-button" type="submit" disabled={busy || !supabase}>{busy ? t('publishing') : t('publishSitterProfile')}</button>
              {!supabase && <p className="form-error" role="alert">{t('supabaseMissing')}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function SitterDateInput({ name, value, min, onChange }: { name: string; value: string; min?: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return (
    <span className={`date-field ${value ? '' : 'has-placeholder'}`}>
      {!value && <span className="date-placeholder">{t('selectDate')}</span>}
      <input className="form-input" name={name} type="date" required min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </span>
  )
}

function getSitterError(error: unknown, t: (key: string) => string) {
  if (error && typeof error === 'object' && 'code' in error && (error.code === 'PGRST205' || error.code === 'PGRST204')) {
    return t('databaseMigrationRequired')
  }
  if (error instanceof Error) return error.message
  return t('sitterApplicationFailed')
}

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { Listing } from '../../types/database'
import { PhotoUploadField } from './PhotoUploadField'

const MAX_PHOTOS = 6
const CARE_NEEDS = ['feeding_twice_daily', 'walks_twice_daily', 'medical_care', 'anxious_pet', 'no_special_needs']
const OFFERS = ['free_stay', 'wifi', 'car', 'bikes', 'garden']
const HOUSE_RULES = ['non_smoker_only', 'no_parties', 'couple_preferred', 'female_preferred']

type CreateListingDialogProps = {
  userId: string
  onClose: () => void
  onCreated: (listing: Listing) => void
  onViewListing: (listing: Listing) => void
  listing?: Listing
}

export function CreateListingDialog({ userId, onClose, onCreated, onViewListing, listing }: CreateListingDialogProps) {
  const { t } = useTranslation()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState(listing?.starts_on ?? '')
  const [endDate, setEndDate] = useState(listing?.ends_on ?? '')
  const [city, setCity] = useState(listing?.city ?? '')
  const [petName, setPetName] = useState(listing?.pet_name ?? '')
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [savedListing, setSavedListing] = useState<Listing | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    const formData = new FormData(event.currentTarget)
    const title = t('generatedListingTitle', { city: city.trim(), pet: petName.trim() }).slice(0, 100).trim()
    const listingFields = {
      title,
      city: city.trim(),
      country: String(formData.get('country')).trim(),
      pet_type: String(formData.get('pet_type')) as Listing['pet_type'],
      pet_name: petName.trim(),
      pet_details: String(formData.get('pet_details')).trim(),
      pet_care_needs: formData.getAll('pet_care_needs').map(String),
      house_type: String(formData.get('house_type')) as NonNullable<Listing['house_type']>,
      offers: formData.getAll('offers').map(String),
      house_rules: formData.getAll('house_rules').map(String),
      starts_on: String(formData.get('starts_on')),
      ends_on: String(formData.get('ends_on')),
      description: String(formData.get('description')).trim(),
      status: listing?.status ?? 'active' as const,
    }

    setBusy(true)
    setErrorMessage('')
    const uploadedPaths: string[] = []
    try {
      const photoUrls: string[] = [...(listing?.photo_urls ?? (listing?.photo_url ? [listing.photo_url] : []))]
      for (const [index, photo] of photos.entries()) {
        const extension = photo.type === 'image/png' ? 'png'
          : photo.type === 'image/webp' ? 'webp'
            : photo.type === 'image/avif' ? 'avif'
              : 'jpg'
        const path = `${userId}/${crypto.randomUUID()}-${index + 1}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(path, photo, { contentType: photo.type, upsert: false })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
        const { data: publicUrl } = supabase.storage.from('listing-photos').getPublicUrl(path)
        photoUrls.push(publicUrl.publicUrl)
      }

      const save = listing
        ? supabase.from('listings').update({
          ...listingFields,
          photo_urls: photoUrls,
          photo_url: photoUrls[0] ?? null,
        }).eq('id', listing.id).eq('owner_id', userId).select().single()
        : supabase.from('listings').insert({
          owner_id: userId,
          ...listingFields,
          photo_urls: photoUrls,
          photo_url: photoUrls[0] ?? null,
        }).select().single()
      const { data, error } = await save
      if (error) throw error
      onCreated(data)
      setSavedListing(data)
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage.from('listing-photos').remove(uploadedPaths)
        if (cleanupError) {
          console.error('Unable to remove listing images after a failed listing submission:', cleanupError.message)
        }
      }
      setErrorMessage(getListingError(error, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        {savedListing ? (
          <div className="listing-success">
            <span aria-hidden="true">✓</span>
            <h2 id="create-title">{t(listing ? 'listingUpdatedTitle' : 'listingPublishedTitle')}</h2>
            <p>{t('listingPublishedText')}</p>
            <button className="button button-primary full-button" type="button" onClick={() => onViewListing(savedListing)}>
              {t('viewMyListing')}
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">{t('createListingEyebrow')}</p>
            <h2 id="create-title">{t(listing ? 'editListingTitle' : 'ownerFormTitle')}</h2>
            <form className="listing-form" onSubmit={(event) => void submit(event)}>
              <p className="generated-title"><strong>{t('listingTitle')}:</strong> {t('generatedListingTitle', { city: city.trim() || '…', pet: petName.trim() || '…' })}</p>
              <div className="form-row">
                <label className="form-label">{t('city')}<input className="form-input" name="city" required maxLength={80} value={city} onChange={(event) => setCity(event.target.value)} /></label>
                <label className="form-label">{t('country')}<input className="form-input" name="country" required maxLength={80} defaultValue={listing?.country} /></label>
              </div>
              <div className="form-row">
                <label className="form-label">{t('petType')}<select className="form-input" name="pet_type" defaultValue={listing?.pet_type ?? 'cat'}><option value="cat">{t('petTypes.cat')}</option><option value="dog">{t('petTypes.dog')}</option><option value="bird">{t('petTypes.bird')}</option><option value="other">{t('petTypes.other')}</option></select></label>
                <label className="form-label">{t('petName')}<input className="form-input" name="pet_name" required maxLength={80} value={petName} onChange={(event) => setPetName(event.target.value)} /></label>
              </div>
              <label className="form-label">{t('petDetails')}<input className="form-input" name="pet_details" required maxLength={160} defaultValue={listing?.pet_details} placeholder={t('petDetailsPlaceholder')} /></label>
              <fieldset className="choice-fieldset">
                <legend>{t('petCareNeeds')}</legend>
                <div className="choice-grid">
                  {CARE_NEEDS.map((value) => <label key={value}><input type="checkbox" name="pet_care_needs" value={value} defaultChecked={listing?.pet_care_needs?.includes(value)} />{t(`careOptions.${value}`)}</label>)}
                </div>
              </fieldset>
              <div className="form-row">
                <label className="form-label">{t('houseType')}<select className="form-input" name="house_type" required defaultValue={listing?.house_type ?? ''}><option value="" disabled>{t('selectHouseType')}</option><option value="apartment">{t('houseTypes.apartment')}</option><option value="house">{t('houseTypes.house')}</option><option value="farm">{t('houseTypes.farm')}</option><option value="studio">{t('houseTypes.studio')}</option></select></label>
                <div className="form-label">{t('whatYouOffer')}<div className="choice-grid compact-choices">{OFFERS.map((value) => <label key={value}><input type="checkbox" name="offers" value={value} defaultChecked={listing?.offers?.includes(value)} />{t(`offerOptions.${value}`)}</label>)}</div></div>
              </div>
              <fieldset className="choice-fieldset">
                <legend>{t('houseRules')}</legend>
                <div className="choice-grid">
                  {HOUSE_RULES.map((value) => <label key={value}><input type="checkbox" name="house_rules" value={value} defaultChecked={listing?.house_rules?.includes(value)} />{t(`ruleOptions.${value}`)}</label>)}
                </div>
              </fieldset>
              <div className="form-row">
                <label className="form-label">{t('startDate')}<DateInput name="starts_on" value={startDate} min={today} onChange={setStartDate} /></label>
                <label className="form-label">{t('endDate')}<DateInput name="ends_on" value={endDate} min={startDate || today} onChange={setEndDate} /></label>
              </div>
              <p className="night-count">{startDate && endDate && endDate >= startDate ? t('nightsCount', { count: nightsBetween(startDate, endDate) }) : '\u00a0'}</p>
              <label className="form-label">{t('description')}<textarea className="form-input form-textarea" name="description" required minLength={20} maxLength={2000} rows={4} defaultValue={listing?.description} /></label>
              {listing?.photo_urls.length ? <div className="existing-photos">{listing.photo_urls.map((photo) => <img key={photo} src={photo} alt="" />)}</div> : null}
              <div className="form-label">{t('listingPhotos')}<PhotoUploadField files={photos} onChange={setPhotos} disabled={busy || photos.length >= MAX_PHOTOS - (listing?.photo_urls.length ?? (listing?.photo_url ? 1 : 0))} maxFiles={MAX_PHOTOS - (listing?.photo_urls.length ?? (listing?.photo_url ? 1 : 0))} /></div>
              {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
              <button className="button button-primary full-button" type="submit" disabled={busy || !supabase}>{busy ? t('publishing') : t(listing ? 'saveListingChanges' : 'publishListing')}</button>
              {!supabase && <p className="form-error" role="alert">{t('supabaseMissing')}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function DateInput({ name, value, min, onChange }: { name: string; value: string; min: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return (
    <span className={`date-field ${value ? '' : 'has-placeholder'}`}>
      {!value && <span className="date-placeholder">{t('selectDate')}</span>}
      <input className="form-input" name={name} type="date" required min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </span>
  )
}

function nightsBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
}

function getListingError(error: unknown, t: (key: string) => string) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('bucket not found')
  ) {
    return t('listingPhotosBucketMissing')
  }
  if (error && typeof error === 'object' && 'code' in error && (error.code === 'PGRST205' || error.code === 'PGRST204')) {
    return t('databaseMigrationRequired')
  }
  if (error instanceof Error) return error.message
  return t('listingCreateFailed')
}

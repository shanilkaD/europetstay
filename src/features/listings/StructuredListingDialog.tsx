import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { capitalizeWords } from '../../lib/text'
import type { Listing } from '../../types/database'
import { PhotoUploadField } from './PhotoUploadField'

const PET_TYPES = ['cat', 'dog', 'bird', 'other']
const LANGUAGES = ['en', 'es', 'fr', 'de', 'other']
const SKILLS = ['medical_care', 'anxiety', 'large_dogs', 'puppies', 'elderly_pets']
const HOME_HAS = ['wifi', 'garden', 'car', 'washing_machine']
const CARE_NEEDS = ['feeding_twice_daily', 'walks_twice_daily', 'medical_care', 'anxious_pet', 'no_special_needs']
const HOUSE_TYPES = ['house', 'apartment', 'farm', 'studio'] as const
const SITTER_TYPES = ['single', 'couple', 'family'] as const
const SMOKER_OPTIONS = ['non_smoker', 'smoker'] as const
const BRING_OWN_PET_OPTIONS = ['no', 'dog', 'cat'] as const
const VET_COST_OPTIONS = [['owner', 'ownerPays'], ['shared', 'sharedVetCosts']] as const
const LISTING_TYPES = ['need_sitter', 'offer_sitting'] as const
type ListingType = (typeof LISTING_TYPES)[number]

function isHouseType(value: string): value is Exclude<Listing['house_type'], null> {
  return HOUSE_TYPES.some((item) => item === value)
}

function isSitterType(value: string): value is NonNullable<Listing['sitter_type']> {
  return SITTER_TYPES.some((item) => item === value)
}

function isBringOwnPet(value: string): value is NonNullable<Listing['bring_own_pet']> {
  return BRING_OWN_PET_OPTIONS.some((item) => item === value)
}

function isWhoPaysVet(value: string): value is 'owner' | 'shared' {
  return value === 'owner' || value === 'shared'
}

function getWhoPaysVet(value: string, errorMessage: string): 'owner' | 'shared' {
  if (!isWhoPaysVet(value)) throw new Error(errorMessage)
  return value
}

type Props = {
  userId: string
  initialListingType: ListingType
  listing?: Listing
  onClose: () => void
  onCreated: (listing: Listing) => void
  onViewListing: (listing: Listing) => void
}

export function StructuredListingDialog({ userId, initialListingType, listing, onClose, onCreated, onViewListing }: Props) {
  const { t, i18n } = useTranslation()
  const [type, setType] = useState<ListingType>(listing?.listing_type ?? initialListingType)
  const [step, setStep] = useState(listing ? 1 : 0)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [city, setCity] = useState(listing?.city ?? '')
  const [country, setCountry] = useState(listing?.country ?? '')
  const [startsOn, setStartsOn] = useState(listing?.starts_on ?? '')
  const [endsOn, setEndsOn] = useState(listing?.ends_on ?? '')
  const [petTypes, setPetTypes] = useState(listing?.pet_types ?? (listing?.pet_type ? [listing.pet_type] : []))
  const [petName, setPetName] = useState(listing?.pet_name ?? '')
  const [petAge, setPetAge] = useState(listing?.pet_age ?? '')
  const [breed, setBreed] = useState(listing?.pet_breed ?? '')
  const [careNeeds, setCareNeeds] = useState(listing?.pet_care_needs ?? [])
  const [houseType, setHouseType] = useState<Exclude<Listing['house_type'], null> | ''>(listing?.house_type ?? '')
  const [homeHas, setHomeHas] = useState(listing?.offers?.filter((item) => item !== 'free_stay') ?? [])
  const [languages, setLanguages] = useState(listing?.languages ?? [])
  const [description, setDescription] = useState(listing?.description ?? '')
  const [sitterType, setSitterType] = useState<NonNullable<Listing['sitter_type']> | ''>(listing?.sitter_type ?? '')
  const [experienceYears, setExperienceYears] = useState(listing?.experience_years ?? '')
  const [canCareFor, setCanCareFor] = useState(listing?.can_care_for ?? [])
  const [specialSkills, setSpecialSkills] = useState(listing?.special_skills ?? [])
  const [smoker, setSmoker] = useState<NonNullable<Listing['smoker']> | ''>(listing?.smoker ?? '')
  const [bringOwnPet, setBringOwnPet] = useState<NonNullable<Listing['bring_own_pet']> | ''>(listing?.bring_own_pet ?? '')
  const [photos, setPhotos] = useState<File[]>([])
  const [idDocument, setIdDocument] = useState<File | null>(null)
  const [existingDocumentPath, setExistingDocumentPath] = useState('')
  const [referenceName, setReferenceName] = useState('')
  const [referenceContact, setReferenceContact] = useState('')
  const [agreeToRules, setAgreeToRules] = useState(false)
  const [medicalNeeds, setMedicalNeeds] = useState('')
  const [medicalCareNeeded, setMedicalCareNeeded] = useState<'yes' | 'no' | ''>('')
  const [vetName, setVetName] = useState('')
  const [vetPhone, setVetPhone] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [whoPaysVet, setWhoPaysVet] = useState<'owner' | 'shared' | ''>('')
  const [stepError, setStepError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [privateDataLoading, setPrivateDataLoading] = useState(Boolean(listing && supabase))
  const [savedListing, setSavedListing] = useState<Listing | null>(null)
  const previewPhoto = useMemo(() => photos[0] ? URL.createObjectURL(photos[0]) : '', [photos])

  useEffect(() => () => { if (previewPhoto) URL.revokeObjectURL(previewPhoto) }, [previewPhoto])

  useEffect(() => {
    if (!listing || !supabase) return
    const listingToLoad = listing
    const client = supabase
    const active = { current: true }
    async function loadPrivateFields() {
      try {
        const [careResult, verificationResult] = await Promise.all([
          listingToLoad.listing_type === 'need_sitter'
            ? client.from('listing_private_details').select('*').eq('listing_id', listingToLoad.id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          listingToLoad.listing_type === 'offer_sitting'
            ? client.from('sitter_verification_submissions').select('*').eq('sitter_id', userId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ])
        if (!active.current) return
        if (careResult.error) setErrorMessage(careResult.error.message)
        else if (careResult.data) {
          const [medicalAnswer, ...medicalDescription] = careResult.data.medical_needs.split(':')
          setMedicalCareNeeded(medicalAnswer === 'yes' || medicalAnswer === 'no' ? medicalAnswer : '')
          setMedicalNeeds(medicalDescription.join(':').trim())
          setVetName(careResult.data.vet_name)
          setVetPhone(careResult.data.vet_phone)
          setEmergencyName(careResult.data.emergency_contact_name)
          setEmergencyPhone(careResult.data.emergency_contact_phone)
          setWhoPaysVet(careResult.data.who_pays_vet)
        }
        if (verificationResult.error) setErrorMessage(verificationResult.error.message)
        else if (verificationResult.data) {
          setExistingDocumentPath(verificationResult.data.id_document_path)
          setReferenceName(verificationResult.data.reference_name)
          setReferenceContact(verificationResult.data.reference_contact)
          setAgreeToRules(verificationResult.data.agreed_to_rules)
        }
      } catch (error) {
        if (active.current) setErrorMessage(error instanceof Error ? error.message : t('listingLoadFailed'))
      } finally {
        if (active.current) setPrivateDataLoading(false)
      }
    }
    void loadPrivateFields()
    return () => { active.current = false }
  }, [listing, t, userId])

  function toggle(values: string[], setValues: (next: string[]) => void, value: string, checked: boolean) {
    setValues(checked ? [...new Set([...values, value])] : values.filter((item) => item !== value))
  }

  function toggleCareNeed(value: string, checked: boolean) {
    setCareNeeds((current) => {
      if (value === 'no_special_needs') return checked ? [value] : []
      const needs = current.filter((need) => need !== 'no_special_needs')
      return checked ? [...new Set([...needs, value])] : needs.filter((need) => need !== value)
    })
  }

  function continueToLocation() {
    if (!type) {
      setStepError(t('listingTypeRequired'))
      return
    }
    setStepError('')
    setStep(1)
  }

  function continueToDetails() {
    if (!city.trim() || !country.trim() || !startsOn || !endsOn || endsOn <= startsOn) {
      setStepError(t('completeLocationAndDates'))
      return
    }
    setStepError('')
    setStep(2)
  }

  function continueToPreview() {
    if (privateDataLoading) return setStepError(t('privateFieldsLoading'))
    if (errorMessage) return setStepError(errorMessage)
    const validLanguages = languages.length > 0
    if (!validLanguages) return setStepError(t('languagesRequired'))
    if (type === 'need_sitter') {
      if (petTypes.length === 0) return setStepError(t('petTypeRequired'))
      if (careNeeds.length === 0) return setStepError(t('careNeedsRequired'))
      if (!petName.trim() || !petAge || !breed.trim() || !houseType) return setStepError(t('completePetAndHome'))
      if (description.trim().length < 20) return setStepError(t('descriptionMinimum'))
      if (!medicalCareNeeded) return setStepError(t('medicalNeedsRequired'))
      if (medicalCareNeeded === 'yes' && !medicalNeeds.trim()) return setStepError(t('medicalNeedsDetailsRequired'))
      if (!vetName.trim() || !vetPhone.trim() || !emergencyName.trim() || !emergencyPhone.trim() || !whoPaysVet) {
        return setStepError(t('careContactsRequired'))
      }
    } else {
      if (canCareFor.length === 0) return setStepError(t('sitterAnimalsRequired'))
      if (description.trim().length < 50) return setStepError(t('aboutMinimum'))
      if (!experienceYears || !sitterType || !smoker || !bringOwnPet) return setStepError(t('completeSitterPreferences'))
      if (!photos.length && !listing?.photo_urls?.length && !listing?.photo_url) return setStepError(t('sitterPhotoRequired'))
      if (!idDocument && !existingDocumentPath) return setStepError(t('idDocumentRequired'))
      if (idDocument && !['image/jpeg', 'image/png', 'application/pdf'].includes(idDocument.type)) return setStepError(t('idDocumentTypeError'))
      if (idDocument && idDocument.size > 10 * 1024 * 1024) return setStepError(t('idDocumentSizeError'))
      if (!referenceName.trim() || !referenceContact.trim() || !agreeToRules) return setStepError(t('completeTrustChecklist'))
    }
    setStepError('')
    setStep(3)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 0) return continueToLocation()
    if (step === 1) return continueToDetails()
    if (step === 2) return continueToPreview()
    if (!supabase) return setErrorMessage(t('supabaseMissing'))
    if (type === 'need_sitter' && !isWhoPaysVet(whoPaysVet)) {
      setErrorMessage(t('careContactsRequired'))
      setStep(2)
      return
    }

    const normalizedCity = capitalizeWords(city)
    const petTypesForListing = type === 'need_sitter' ? petTypes : canCareFor
    const normalizedPetName = type === 'need_sitter' ? capitalizeWords(petName) : null
    const title = type === 'need_sitter'
      ? t('generatedListingTitle', {
          city: normalizedCity,
          pet: normalizedPetName,
          type: petTypesForListing.map((item) => t(`petTypes.${item}`)).join(' & '),
          start: formatDate(startsOn, i18n.language),
          end: formatDate(endsOn, i18n.language),
        })
      : t('generatedSitterTitle', { city: normalizedCity, start: formatDate(startsOn, i18n.language), end: formatDate(endsOn, i18n.language) })
    const fields = {
      listing_type: type,
      title: title.slice(0, 100),
      city: normalizedCity,
      country: capitalizeWords(country),
      pet_type: (type === 'need_sitter' ? (petTypes.includes('cat') && petTypes.includes('dog') ? 'both' : petTypes[0]) : 'other') as Listing['pet_type'],
      pet_types: petTypesForListing,
      pet_name: normalizedPetName,
      pet_age: type === 'need_sitter' ? petAge : '',
      pet_breed: type === 'need_sitter' ? capitalizeWords(breed) : '',
      pet_details: '',
      pet_care_needs: type === 'need_sitter' ? careNeeds : [],
      house_type: type === 'need_sitter' ? houseType as Listing['house_type'] : null,
      offers: type === 'need_sitter' ? [...homeHas, 'free_stay'] : [],
      house_rules: [],
      can_care_for: type === 'offer_sitting' ? canCareFor : [],
      experience_years: type === 'offer_sitting' ? experienceYears : '',
      special_skills: type === 'offer_sitting' ? specialSkills : [],
      smoker: type === 'offer_sitting' ? smoker as Listing['smoker'] : null,
      sitter_type: type === 'offer_sitting' ? sitterType as Listing['sitter_type'] : null,
      bring_own_pet: type === 'offer_sitting' ? bringOwnPet as Listing['bring_own_pet'] : null,
      languages,
      starts_on: startsOn,
      ends_on: endsOn,
      description: description.trim(),
      status: listing?.status ?? 'live' as const,
    }
    setBusy(true)
    setErrorMessage('')
    const uploadedPaths: string[] = []
    let newVerificationPath = ''
    let newlyCreatedListingId = ''
    let verificationSaved = false
    try {
      let duplicateQuery = supabase.from('listings').select('id').eq('owner_id', userId)
        .eq('listing_type', type).ilike('city', normalizedCity).ilike('country', capitalizeWords(country))
        .eq('starts_on', startsOn).eq('ends_on', endsOn).limit(1)
      if (type === 'need_sitter') duplicateQuery = duplicateQuery.ilike('pet_name', normalizedPetName ?? '')
      if (listing) duplicateQuery = duplicateQuery.neq('id', listing.id)
      const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle()
      if (duplicateError) throw duplicateError
      if (duplicate) throw new Error(t('duplicateListing'))

      const photoUrls = type === 'offer_sitting' && photos.length > 0
        ? []
        : [...(listing?.photo_urls ?? (listing?.photo_url ? [listing.photo_url] : []))]
      for (const [index, photo] of photos.entries()) {
        const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : photo.type === 'image/avif' ? 'avif' : 'jpg'
        const path = `${userId}/${crypto.randomUUID()}-${index + 1}.${ext}`
        const { error } = await supabase.storage.from('listing-photos').upload(path, photo, { contentType: photo.type })
        if (error) throw error
        uploadedPaths.push(path)
        photoUrls.push(supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl)
      }

      if (type === 'offer_sitting') {
        let documentPath = existingDocumentPath
        if (idDocument) {
          const extension = idDocument.type === 'application/pdf' ? 'pdf' : idDocument.type === 'image/png' ? 'png' : 'jpg'
          documentPath = `${userId}/${crypto.randomUUID()}.${extension}`
          const { error } = await supabase.storage.from('private-verification-documents').upload(documentPath, idDocument, { contentType: idDocument.type })
          if (error) throw error
          newVerificationPath = documentPath
        }
        const { error } = await supabase.from('sitter_verification_submissions').upsert({
          sitter_id: userId,
          id_document_path: documentPath,
          reference_name: referenceName.trim(),
          reference_contact: referenceContact.trim(),
          agreed_to_rules: agreeToRules,
        }, { onConflict: 'sitter_id' })
        if (error) throw error
        verificationSaved = true
        if (idDocument && existingDocumentPath) {
          const { error: removeError } = await supabase.storage.from('private-verification-documents').remove([existingDocumentPath])
          if (removeError) console.error('Unable to remove the replaced private verification document:', removeError.message)
        }
      }

      const result = listing
        ? await supabase.from('listings').update({ ...fields, photo_urls: photoUrls, photo_url: photoUrls[0] ?? null }).eq('id', listing.id).eq('owner_id', userId).select().single()
        : await supabase.from('listings').insert({ owner_id: userId, ...fields, photo_urls: photoUrls, photo_url: photoUrls[0] ?? null }).select().single()
      if (result.error) throw result.error
      const saved = result.data
      if (!listing) newlyCreatedListingId = saved.id

      if (type === 'need_sitter') {
        const { error } = await supabase.from('listing_private_details').upsert({
          listing_id: saved.id,
          owner_id: userId,
          medical_needs: medicalCareNeeded === 'yes' ? `yes: ${medicalNeeds.trim()}` : 'no:',
          vet_name: vetName.trim(),
          vet_phone: vetPhone.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          who_pays_vet: getWhoPaysVet(whoPaysVet, t('careContactsRequired')),
        }, { onConflict: 'listing_id' })
        if (error) throw new Error(`${t('listingSavedPrivateDetailsFailed')}: ${error.message}`)
      }
      onCreated(saved)
      setSavedListing(saved)
    } catch (error) {
      let cleanupUploads = !listing
      let failureMessage = error instanceof Error ? error.message : t('listingCreateFailed')
      if (newlyCreatedListingId) {
        const { error: rollbackError } = await supabase.from('listings').delete().eq('id', newlyCreatedListingId).eq('owner_id', userId)
        if (rollbackError) {
          cleanupUploads = false
          failureMessage = `${failureMessage} ${t('listingRollbackFailed')}: ${rollbackError.message}`
        }
      }
      if (uploadedPaths.length && cleanupUploads) {
        const { error: cleanupError } = await supabase.storage.from('listing-photos').remove(uploadedPaths)
        if (cleanupError) console.error('Unable to remove listing images after a failed listing submission:', cleanupError.message)
      }
      if (newVerificationPath && !verificationSaved) {
        const { error: cleanupError } = await supabase.storage.from('private-verification-documents').remove([newVerificationPath])
        if (cleanupError) console.error('Unable to remove verification document after a failed submission:', cleanupError.message)
      }
      setErrorMessage(failureMessage)
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
            <span aria-hidden="true">✓</span><h2 id="create-title">{t(listing ? 'listingUpdatedTitle' : 'listingPublishedTitle')}</h2>
            <p>{t('listingPublishedText')}</p>
            <button className="button button-primary full-button" type="button" onClick={() => onViewListing(savedListing)}>{t('viewMyListing')}</button>
          </div>
        ) : (
          <>
            <p className="eyebrow">{t('createListingEyebrow')}</p>
            <h2 id="create-title">{t(listing ? 'editListingTitle' : 'structuredPostTitle')}</h2>
            <p className="listing-step-indicator">{t('listingStep', { step: step + 1 })}</p>
            <form className="listing-form" autoComplete="new-password" onSubmit={(event) => void submit(event)}>
              {step === 0 && (
                <fieldset className="choice-fieldset">
                  <legend>{t('whatIsThisPost')}</legend>
                  {LISTING_TYPES.map((value) => (
                    <label className="listing-type-choice" key={value}>
                      <input type="radio" name="listing_type" checked={type === value} onChange={() => setType(value)} />
                      <span>{value === 'need_sitter' ? '🏠' : '🧳'} {t(`listingTypes.${value}`)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {step === 1 && (
                <>
                  <div className="form-row">
                    <label className="form-label">{t('city')}<input className="form-input" required maxLength={80} value={city} onChange={(event) => setCity(event.target.value)} /></label>
                    <label className="form-label">{t('country')}<input className="form-input" required maxLength={80} value={country} onChange={(event) => setCountry(event.target.value)} /></label>
                  </div>
                  <div className="form-row">
                    <label className="form-label">{t('startDate')}<input className="form-input" type="date" min={today} required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
                    <label className="form-label">{t('endDate')}<input className="form-input" type="date" min={startsOn || today} required value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  {type === 'need_sitter' ? (
                    <>
                      <fieldset className="choice-fieldset"><legend>{t('petType')}</legend><div className="choice-grid choice-inline">{PET_TYPES.map((value) => <label key={value}><input type="checkbox" checked={petTypes.includes(value)} onChange={(event) => toggle(petTypes, setPetTypes, value, event.target.checked)} />{t(`petTypes.${value}`)}</label>)}</div></fieldset>
                      <div className="form-row">
                        <label className="form-label">{t('petName')}<input className="form-input" required maxLength={80} value={petName} onChange={(event) => setPetName(event.target.value)} placeholder={t('petNamePlaceholder')} /></label>
                        <label className="form-label">{t('petAge')}<input className="form-input" type="number" min="0" max="40" required value={petAge} onChange={(event) => setPetAge(event.target.value)} /></label>
                      </div>
                      <label className="form-label">{t('petBreed')}<input className="form-input" required maxLength={100} value={breed} onChange={(event) => setBreed(event.target.value)} /></label>
                      <fieldset className="choice-fieldset"><legend>{t('petCareNeeds')}</legend><div className="choice-grid">{CARE_NEEDS.map((value) => <label key={value}><input type="checkbox" checked={careNeeds.includes(value)} onChange={(event) => toggleCareNeed(value, event.target.checked)} />{t(`careOptions.${value}`)}</label>)}</div></fieldset>
                      <label className="form-label">{t('houseType')}<select className="form-input" required value={houseType} onChange={(event) => setHouseType(isHouseType(event.target.value) ? event.target.value : '')}><option value="">{t('selectHouseType')}</option>{HOUSE_TYPES.map((value) => <option key={value} value={value}>{t(`houseTypes.${value}`)}</option>)}</select></label>
                      <fieldset className="choice-fieldset"><legend>{t('yourHomeHas')}</legend><div className="choice-grid choice-inline">{HOME_HAS.map((value) => <label key={value}><input type="checkbox" checked={homeHas.includes(value)} onChange={(event) => toggle(homeHas, setHomeHas, value, event.target.checked)} />{t(`offerOptions.${value}`)}</label>)}</div></fieldset>
                      <fieldset className="choice-fieldset"><legend>{t('medicalCareNeeded')}</legend><div className="choice-grid choice-inline">{(['yes', 'no'] as const).map((value) => <label key={value}><input type="radio" name="medical_care_needed" checked={medicalCareNeeded === value} onChange={() => setMedicalCareNeeded(value)} />{t(`yesNo.${value}`)}</label>)}</div></fieldset>
                      {medicalCareNeeded === 'yes' && <label className="form-label">{t('medicalNeeds')}<textarea className="form-input form-textarea" rows={2} value={medicalNeeds} onChange={(event) => setMedicalNeeds(event.target.value)} /></label>}
                      <div className="form-row">
                        <label className="form-label">{t('vetName')}<input className="form-input" required value={vetName} onChange={(event) => setVetName(event.target.value)} /></label>
                        <label className="form-label">{t('vetPhone')}<input className="form-input" type="tel" required value={vetPhone} onChange={(event) => setVetPhone(event.target.value)} /></label>
                      </div>
                      <div className="form-row">
                        <label className="form-label">{t('emergencyContactName')}<input className="form-input" required value={emergencyName} onChange={(event) => setEmergencyName(event.target.value)} /></label>
                        <label className="form-label">{t('emergencyContactPhone')}<input className="form-input" type="tel" required value={emergencyPhone} onChange={(event) => setEmergencyPhone(event.target.value)} /></label>
                      </div>
                      <fieldset className="choice-fieldset"><legend>{t('whoPaysVet')}</legend><div className="choice-grid choice-inline">{VET_COST_OPTIONS.map(([value, key]) => <label key={value}><input type="radio" name="who_pays_vet" checked={whoPaysVet === value} onChange={() => setWhoPaysVet(value)} />{t(key)}</label>)}</div></fieldset>
                      <label className="form-label">{t('whatSitterShouldKnow')}<textarea className="form-input form-textarea" required minLength={20} maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                      <p className="character-guidance">{t('descriptionMinimum')} <span>{description.length} / 20</span></p>
                      <p className="photo-field-hint">{t('listingPhotos')}</p>
                      <PhotoUploadField files={photos} onChange={setPhotos} maxFiles={Math.max(0, 6 - (listing?.photo_urls?.length ?? (listing?.photo_url ? 1 : 0)))} addLabel="listingPhotos" />
                    </>
                  ) : (
                    <>
                      <fieldset className="choice-fieldset"><legend>{t('animalsYouCanCareFor')}</legend><div className="choice-grid choice-inline">{PET_TYPES.map((value) => <label key={value}><input type="checkbox" checked={canCareFor.includes(value)} onChange={(event) => toggle(canCareFor, setCanCareFor, value, event.target.checked)} />{t(`petTypes.${value}`)}</label>)}</div></fieldset>
                      <fieldset className="choice-fieldset"><legend>{t('experienceYears')}</legend><div className="choice-grid choice-inline">{['0-1', '1-3', '3+'].map((value) => <label key={value}><input type="radio" name="experience_years" checked={experienceYears === value} onChange={() => setExperienceYears(value)} />{t(`experienceRanges.${value}`)}</label>)}</div></fieldset>
                      <fieldset className="choice-fieldset"><legend>{t('specialSkills')}</legend><div className="choice-grid">{SKILLS.map((value) => <label key={value}><input type="checkbox" checked={specialSkills.includes(value)} onChange={(event) => toggle(specialSkills, setSpecialSkills, value, event.target.checked)} />{t(`specialSkillOptions.${value}`)}</label>)}</div></fieldset>
                      <fieldset className="choice-fieldset"><legend>{t('smoking')}</legend><div className="choice-grid choice-inline">{SMOKER_OPTIONS.map((value) => <label key={value}><input type="radio" name="smoker" checked={smoker === value} onChange={() => setSmoker(value)} />{t(`smokerOptions.${value}`)}</label>)}</div></fieldset>
                      <fieldset className="choice-fieldset"><legend>{t('whoAreYou')}</legend><div className="choice-grid choice-inline">{SITTER_TYPES.map((value) => <label key={value}><input type="radio" name="sitter_type" checked={sitterType === value} onChange={() => setSitterType(isSitterType(value) ? value : '')} />{t(`partyTypes.${value}`)}</label>)}</div></fieldset>
                      <fieldset className="choice-fieldset"><legend>{t('bringOwnPet')}</legend><div className="choice-grid choice-inline">{BRING_OWN_PET_OPTIONS.map((value) => <label key={value}><input type="radio" name="bring_own_pet" checked={bringOwnPet === value} onChange={() => setBringOwnPet(isBringOwnPet(value) ? value : '')} />{t(`bringOwnPetOptions.${value}`)}</label>)}</div></fieldset>
                      <label className="form-label">{t('aboutYou')}<textarea className="form-input form-textarea" minLength={50} maxLength={2000} required rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                      <p className="character-guidance">{t('aboutMinimum')} <span>{description.length} / 50</span></p>
                      <p className="photo-field-hint">{t('sitterPhotoHint')}</p>
                      <PhotoUploadField files={photos} onChange={setPhotos} maxFiles={1} addLabel="chooseYourPhoto" />
                      {(listing?.photo_urls?.length || listing?.photo_url) && <p className="form-hint">{t('currentListingPhotoSaved')}</p>}
                      <label className="form-label">{t('idDocument')}<input className="form-input" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setIdDocument(event.currentTarget.files?.[0] ?? null)} /><small>{t('idDocumentPrivate')}</small></label>
                      {existingDocumentPath && !idDocument && <p className="form-hint">{t('idDocumentAlreadyUploaded')}</p>}
                      <div className="form-row">
                        <label className="form-label">{t('referenceName')}<input className="form-input" required value={referenceName} onChange={(event) => setReferenceName(event.target.value)} /></label>
                        <label className="form-label">{t('referenceContact')}<input className="form-input" required value={referenceContact} onChange={(event) => setReferenceContact(event.target.value)} /></label>
                      </div>
                      <label className="choice-checkbox"><input type="checkbox" checked={agreeToRules} onChange={(event) => setAgreeToRules(event.target.checked)} />{t('agreeToRules')}</label>
                    </>
                  )}
                  <fieldset className="choice-fieldset"><legend>{t('languagesForListing')}</legend><div className="choice-grid choice-inline">{LANGUAGES.map((value) => <label key={value}><input type="checkbox" checked={languages.includes(value)} onChange={(event) => toggle(languages, setLanguages, value, event.target.checked)} />{value.toUpperCase()}</label>)}</div></fieldset>
                  {stepError && <p className="form-error" role="alert">{stepError}</p>}
                  <div className="form-row listing-step-actions"><button className="button button-outline" type="button" onClick={() => setStep(1)}>{t('back')}</button><button className="button button-primary" type="button" onClick={continueToPreview}>{t('previewListing')}</button></div>
                </>
              )}
              {step === 3 && (
                <>
                  <p className="dialog-intro">{t('previewListingIntro')}</p>
                  <article className="listing-preview-card">
                    {previewPhoto ? <img src={previewPhoto} alt="" /> : listing?.photo_urls?.[0] || listing?.photo_url ? <img src={listing.photo_urls?.[0] ?? listing.photo_url ?? ''} alt="" /> : <div className="listing-preview-empty">🐾</div>}
                    <h3>{type === 'need_sitter' ? t('generatedListingTitle', { city: capitalizeWords(city), pet: capitalizeWords(petName), type: petTypes.map((item) => t(`petTypes.${item}`)).join(' & '), start: formatDate(startsOn, i18n.language), end: formatDate(endsOn, i18n.language) }) : t('generatedSitterTitle', { city: capitalizeWords(city), start: formatDate(startsOn, i18n.language), end: formatDate(endsOn, i18n.language) })}</h3>
                    <p>{city}, {country} · {formatDate(startsOn, i18n.language)} – {formatDate(endsOn, i18n.language)}</p>
                    <p>{type === 'need_sitter' ? `${petTypes.map((item) => t(`petTypes.${item}`)).join(', ')} · ${petName}, ${petAge} ${t('years')} · ${breed}` : `${canCareFor.map((item) => t(`petTypes.${item}`)).join(', ')} · ${t(`partyTypes.${sitterType}`)} · ${languages.map((language) => language.toUpperCase()).join(' ')}`}</p>
                    <p>{description}</p>
                  </article>
                  {stepError && <p className="form-error" role="alert">{stepError}</p>}
                  {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
                  <div className="form-row listing-step-actions"><button className="button button-outline" type="button" onClick={() => { setStep(2); setErrorMessage('') }}>{t('backToDetails')}</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? t('publishing') : t(listing ? 'saveListingChanges' : 'publishListing')}</button></div>
                </>
              )}
              {step < 2 && (
                <>
                  {stepError && <p className="form-error" role="alert">{stepError}</p>}
                  <div className="form-row listing-step-actions">
                    {step > 0 && <button className="button button-outline" type="button" onClick={() => setStep(step - 1)}>{t('back')}</button>}
                    <button className="button button-primary" type="button" onClick={step === 0 ? continueToLocation : continueToDetails}>{t('continue')}</button>
                  </div>
                </>
              )}
              {!supabase && <p className="form-error" role="alert">{t('supabaseMissing')}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function formatDate(value: string, locale: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Listing, Profile } from '../../types/database'

type ListingCardProps = {
  listing: Listing
  owner: Profile | null
  currentUserId?: string
  onChat: (listing: Listing) => void
}

export function ListingCard({ listing, owner, currentUserId, onChat }: ListingCardProps) {
  const { t } = useTranslation()
  const photos = [...new Set([...(listing.photo_urls ?? []), ...(listing.photo_url ? [listing.photo_url] : [])])]
  const photo = photos[0]
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const galleryDialogRef = useRef<HTMLDialogElement>(null)
  const animals = listing.listing_type === 'offer_sitting'
    ? listing.can_care_for
    : listing.pet_types?.length ? listing.pet_types : [listing.pet_type]
  const animalNames = animals.map((type) => t(`petTypes.${type}`)).join(' & ')

  useEffect(() => {
    const dialog = galleryDialogRef.current
    if (galleryOpen && dialog && !dialog.open) dialog.showModal()
  }, [galleryOpen])

  async function copyFacebookPost() {
    const details = listing.listing_type === 'need_sitter'
      ? `🐾 PETS: ${animalNames} — ${listing.pet_name}, ${listing.pet_age} ${t('years')}, ${listing.pet_breed}\n🏠 HOME: ${listing.house_type ? t(`houseTypes.${listing.house_type}`) : ''} — ${listing.offers.filter((offer) => offer !== 'free_stay').map((offer) => t(`offerOptions.${offer}`)).join(', ')}`
      : `🧳 SIT: ${animalNames}\n👥 ${t(`partyTypes.${listing.sitter_type ?? 'single'}`)} · ${t(`smokerOptions.${listing.smoker ?? 'non_smoker'}`)} · ${listing.special_skills.map((skill) => t(`specialSkillOptions.${skill}`)).join(', ')}`
    const text = [
      `📍 WHERE: ${listing.city}, ${listing.country}`,
      `📅 WHEN: ${listing.starts_on} to ${listing.ends_on}`,
      details,
      ...(listing.listing_type === 'need_sitter' ? [t('vetPlanShare')] : []),
      `💬 LANGUAGES: ${listing.languages.map((language) => language.toUpperCase()).join(' ')}`,
      t('facebookMessageHint'),
      `${window.location.origin}/#listing-${listing.id}`,
    ].join('\n')
    setShareMessage('')
    try {
      await navigator.clipboard.writeText(text)
      setShareMessage(t('facebookPostCopied'))
    } catch {
      setShareMessage(t('facebookCopyFailed'))
    }
  }

  return (
    <article className="listing-card" id={`listing-${listing.id}`}>
      <div className="listing-image-wrap">
        {photo ? (
          <button className="listing-photo-button" type="button" onClick={() => setGalleryOpen(true)} aria-label={t('viewListingPhotos', { count: photos.length })}>
            <img className="listing-photo" src={photo} alt={t('petAtHome', { pet: listing.pet_name ?? t('availableSitter'), city: listing.city })} />
          </button>
        ) : <div className="listing-photo listing-photo-empty" aria-hidden="true">🐾</div>}
        {photos.length > 1 && <button className="photo-count" type="button" onClick={() => setGalleryOpen(true)} aria-label={t('viewListingPhotos', { count: photos.length })}>{t('photoCountBadge', { count: photos.length })}</button>}
      </div>
      <div className="listing-body">
        <p className="listing-location"><span aria-hidden="true">📍</span> {listing.city}, {listing.country}</p>
        <h3>{listing.title}</h3>
        <p className="listing-pet">
          <span aria-hidden="true">{listing.listing_type === 'offer_sitting' ? '🧳' : '🐾'}</span>{' '}
          {listing.listing_type === 'need_sitter'
            ? t('petAndName', { type: animalNames, name: listing.pet_name ?? '' })
            : `${t('availableSitter')}: ${animalNames} · ${t(`experienceRanges.${listing.experience_years}`)}`}
          {listing.listing_type === 'need_sitter' && (listing.pet_age || listing.pet_breed) && <span> · {[listing.pet_age ? `${listing.pet_age} ${t('years')}` : '', listing.pet_breed].filter(Boolean).join(' · ')}</span>}
        </p>
        <p className={`listing-description ${descriptionExpanded ? 'is-expanded' : ''}`}>{listing.description}</p>
        {listing.description.length > 120 && <button className="read-more-button" type="button" aria-expanded={descriptionExpanded} onClick={() => setDescriptionExpanded((expanded) => !expanded)}>{t(descriptionExpanded ? 'readLess' : 'readMore')}</button>}
        <div className="listing-trust">
          {listing.listing_type === 'offer_sitting' && owner?.id_verified && <span className="trust-badge"><span aria-hidden="true">✓</span> {t('idVerified')}</span>}
          {listing.listing_type === 'offer_sitting' && owner?.references_count ? <span className="trust-badge">{t('referencesCount', { count: owner.references_count })}</span> : null}
          {owner && <span className="trust-badge"><span aria-hidden="true">✓</span> {t('memberProfile')}</span>}
        </div>
        {listing.listing_type === 'offer_sitting' && <p className="reviews-placeholder">{t('reviewsComingTrustHint')}</p>}
        <aside className="chat-trust-hint">
          <strong>{t('chatTrustTitle')}</strong>
          <span>{t('chatTrustDescription')}</span>
        </aside>
        <div className="listing-meta">
          <span><span aria-hidden="true">📅</span> {formatDate(listing.starts_on)} – {formatDate(listing.ends_on)} · {t('nightsCount', { count: nightsBetween(listing.starts_on, listing.ends_on) })}</span>
          {listing.listing_type === 'need_sitter' && listing.house_type && <span><span aria-hidden="true">🏠</span> {t(`houseTypes.${listing.house_type}`)}</span>}
        </div>
        {listing.languages.length > 0 && <p className="listing-languages" aria-label={t('languagesYouSpeak')}>{listing.languages.map((language) => language.toUpperCase()).join(' · ')}</p>}
        <div className="listing-card-footer">
          <span>{t('hostedBy', { name: owner?.display_name || t('petOwner') })}</span>
          <div className="listing-card-actions">
            {currentUserId === listing.owner_id && <button className="button button-small button-outline" type="button" onClick={() => void copyFacebookPost()}>{t('copyFacebookPost')}</button>}
            {currentUserId !== listing.owner_id && <button className="button button-small" type="button" onClick={() => onChat(listing)}>{t('messageReply')}</button>}
          </div>
        </div>
        {shareMessage && <p className={shareMessage === t('facebookPostCopied') ? 'form-hint' : 'form-error'} role="status">{shareMessage}</p>}
      </div>
      <dialog
        ref={galleryDialogRef}
        className="photo-gallery-dialog"
        aria-label={t('listingPhotosGallery', { title: listing.title })}
        onClose={() => setGalleryOpen(false)}
        onCancel={() => setGalleryOpen(false)}
      >
        <div className="photo-gallery-header">
          <h2>{t('listingPhotosGallery', { title: listing.title })}</h2>
          <button className="photo-gallery-close" type="button" onClick={() => galleryDialogRef.current?.close()} aria-label={t('close')}>×</button>
        </div>
        <div className="photo-gallery-grid">
          {photos.map((url, index) => <img key={url} src={url} alt={`${listing.title} ${index + 1}`} />)}
        </div>
      </dialog>
    </article>
  )
}

function nightsBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

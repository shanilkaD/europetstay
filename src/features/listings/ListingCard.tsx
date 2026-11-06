import { useState } from 'react'
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
  const photo = listing.photo_urls?.[0] || listing.photo_url
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

  return (
    <article className="listing-card" id={`listing-${listing.id}`}>
      <div className="listing-image-wrap">
        {photo ? (
          <img className="listing-photo" src={photo} alt={t('petAtHome', { pet: listing.pet_name, city: listing.city })} />
        ) : (
          <div className="listing-photo listing-photo-empty" aria-hidden="true">🐾</div>
        )}
        {(listing.photo_urls?.length ?? 0) > 1 && <span className="photo-count">{t('photoCountBadge', { count: listing.photo_urls.length })}</span>}
      </div>
      <div className="listing-body">
        <p className="listing-location"><span aria-hidden="true">📍</span> {listing.city}, {listing.country}</p>
        <h3>{t('generatedListingTitle', { city: listing.city, pet: listing.pet_name })}</h3>
        <p className="listing-pet">
          <span aria-hidden="true">{listing.pet_type === 'cat' ? '🐱' : listing.pet_type === 'dog' ? '🐶' : '🐾'}</span>
          {' '}{t('petAndName', { type: t(`petTypes.${listing.pet_type}`), name: listing.pet_name })}
          {listing.pet_details && <span> · {listing.pet_details}</span>}
        </p>
        <p className={`listing-description ${descriptionExpanded ? 'is-expanded' : ''}`}>{listing.description}</p>
        {listing.description.length > 120 && (
          <button className="read-more-button" type="button" aria-expanded={descriptionExpanded} onClick={() => setDescriptionExpanded((expanded) => !expanded)}>
            {t(descriptionExpanded ? 'readLess' : 'readMore')}
          </button>
        )}
        <div className="listing-trust">
          <span className="trust-badge"><span aria-hidden="true">✦</span> {t('reviewsComing')}</span>
          {owner && <span className="trust-badge"><span aria-hidden="true">✓</span> {t('memberProfile')}</span>}
        </div>
        <div className="listing-meta">
          <span><span aria-hidden="true">📅</span> {formatDate(listing.starts_on)} – {formatDate(listing.ends_on)} · {t('nightsCount', { count: nightsBetween(listing.starts_on, listing.ends_on) })}</span>
          {listing.house_type && <span><span aria-hidden="true">🏠</span> {t(`houseTypes.${listing.house_type}`)}</span>}
        </div>
        <div className="listing-card-footer">
          <span>{t('hostedBy', { name: owner?.display_name || t('petOwner') })}</span>
          {currentUserId !== listing.owner_id && (
            <button className="button button-small" type="button" onClick={() => onChat(listing)}>
              {t('chatWithOwner')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function nightsBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T12:00:00`),
  )
}

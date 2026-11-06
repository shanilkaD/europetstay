import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { Listing } from '../../types/database'

type MyListingsDialogProps = {
  userId: string
  onClose: () => void
  onEdit: (listing: Listing) => void
  onDeleted: (listingId: string) => void
}

export function MyListingsDialog({ userId, onClose, onEdit, onDeleted }: MyListingsDialogProps) {
  const { t } = useTranslation()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) {
        setErrorMessage(t('supabaseMissing'))
        setLoading(false)
        return
      }
      const { data, error } = await supabase.from('listings').select('*').eq('owner_id', userId).order('created_at', { ascending: false })
      if (!active) return
      if (error) setErrorMessage(error.code === 'PGRST205' || error.code === 'PGRST204' ? t('databaseMigrationRequired') : error.message)
      else setListings(data)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [t, userId])

  async function deleteListing(listing: Listing) {
    if (!supabase || !window.confirm(t('confirmDeleteListing'))) return
    setDeletingId(listing.id)
    setErrorMessage('')
    const { error } = await supabase.from('listings').delete().eq('id', listing.id).eq('owner_id', userId)
    if (error) setErrorMessage(error.message)
    else {
      setListings((current) => current.filter((item) => item.id !== listing.id))
      onDeleted(listing.id)
    }
    setDeletingId('')
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog my-listings-dialog" role="dialog" aria-modal="true" aria-labelledby="my-listings-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        <p className="eyebrow">{t('myListingsEyebrow')}</p>
        <h2 id="my-listings-title">{t('myListings')}</h2>
        {loading ? <p className="listing-state">{t('loadingListings')}</p> : listings.length === 0 ? <p className="listing-state">{t('myListingsEmpty')}</p> : (
          <div className="my-listings-list">
            {listings.map((listing) => (
              <article className="my-listing-item" key={listing.id}>
                <div>
                  <h3>{t('generatedListingTitle', { city: listing.city, pet: listing.pet_name })}</h3>
                  <p>{listing.city}, {listing.country} · {formatDate(listing.starts_on)} – {formatDate(listing.ends_on)}</p>
                </div>
                <div className="my-listing-actions">
                  <button className="button button-outline" type="button" onClick={() => onEdit(listing)}>{t('editListing')}</button>
                  <button className="button button-outline delete-listing-button" type="button" disabled={deletingId === listing.id} onClick={() => void deleteListing(listing)}>
                    {deletingId === listing.id ? t('deleting') : t('deleteListing')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </section>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { Listing } from '../../types/database'

const LISTING_STATUSES = ['live', 'booked', 'completed', 'cancelled'] as const

function isListingStatus(value: string): value is Listing['status'] {
  return LISTING_STATUSES.some((status) => status === value)
}

type MyListingsDialogProps = {
  userId: string
  onClose: () => void
  onEdit: (listing: Listing) => void
  onMessages: () => void
  onView: (listing: Listing) => void
  onDeleted: (listingId: string) => void
}

export function MyListingsDialog({ userId, onClose, onEdit, onMessages, onView, onDeleted }: MyListingsDialogProps) {
  const { t } = useTranslation()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) {
        setLoadError(t('supabaseMissing'))
        setLoading(false)
        return
      }
      const listingsResult = await supabase.from('listings').select('*').eq('owner_id', userId).order('created_at', { ascending: false })
      if (!active) return
      const error = listingsResult.error
      if (error) setLoadError(error.code === 'PGRST205' || error.code === 'PGRST204' ? t('databaseMigrationRequired') : error.message)
      else if (!listingsResult.data) setLoadError(t('myPostsLoadFailed'))
      else {
        setListings(listingsResult.data)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [t, userId])

  async function deleteListing() {
    if (!supabase || !deleteTarget) return
    const listing = deleteTarget
    setDeletingId(listing.id)
    setErrorMessage('')
    const { error } = await supabase.from('listings').delete().eq('id', listing.id).eq('owner_id', userId)
    if (error) setErrorMessage(error.message)
    else {
      setListings((current) => current.filter((item) => item.id !== listing.id))
      onDeleted(listing.id)
      setDeleteTarget(null)
    }
    setDeletingId('')
  }

  async function updateStatus(listing: Listing, status: Listing['status']) {
    if (!supabase) return
    setErrorMessage('')
    const { error } = await supabase.from('listings').update({ status }).eq('id', listing.id).eq('owner_id', userId)
    if (error) setErrorMessage(error.message)
    else setListings((current) => current.map((item) => item.id === listing.id ? { ...item, status } : item))
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog my-listings-dialog" role="dialog" aria-modal="true" aria-labelledby="my-listings-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        <p className="eyebrow">{t('myListingsEyebrow')}</p>
        <h2 id="my-listings-title">{t('myPosts')}</h2>
        <div className="post-tabs" role="tablist" aria-label={t('myPostsSections')}>
          <button className="post-tab is-active" role="tab" aria-selected="true" type="button">{t('myPosts')}</button>
          <button className="post-tab" role="tab" aria-selected="false" type="button" onClick={onMessages}>{t('messages')}</button>
        </div>
        {loading ? <p className="listing-state">{t('loadingListings')}</p> : loadError ? <p className="form-error" role="alert">{loadError}</p> : (
          <div className="my-posts-sections">
            <section>
              <h3>{t('myListings')} <span>({listings.length})</span></h3>
              {listings.length === 0 ? <p className="my-posts-empty">{t('myListingsEmpty')}</p> : (
                <div className="my-listings-list">
                  {listings.map((listing) => (
                    <article className="my-listing-item" key={listing.id}>
                      {listing.photo_urls?.[0] || listing.photo_url ? <img className="my-listing-photo" src={listing.photo_urls?.[0] ?? listing.photo_url ?? ''} alt="" /> : <div className="my-listing-photo my-listing-photo-empty" aria-hidden="true">🐾</div>}
                      <div>
                        <h4>{listing.title}</h4>
                        <p>{listing.city}, {listing.country} · {formatDate(listing.starts_on)} – {formatDate(listing.ends_on)} · {t(`listingStatuses.${listing.status}`)}</p>
                        <label className="listing-status-control">{t('listingStatus')}<select value={listing.status} onChange={(event) => { if (isListingStatus(event.target.value)) void updateStatus(listing, event.target.value) }}>{LISTING_STATUSES.map((status) => <option key={status} value={status}>{t(`listingStatuses.${status}`)}</option>)}</select></label>
                      </div>
                      <div className="my-listing-actions">
                        <button className="button button-outline" type="button" onClick={() => onView(listing)}>{t('viewMyListing')}</button>
                        <button className="button button-outline" type="button" onClick={() => onEdit(listing)}>{t('editListing')}</button>
                        <button className="button button-outline delete-listing-button" type="button" onClick={() => setDeleteTarget(listing)}>{t('deleteListing')}</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {deleteTarget && (
              <div className="dialog-backdrop delete-confirm-backdrop">
                <section className="dialog delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-listing-title" aria-describedby="delete-listing-warning">
                  <button className="dialog-close" type="button" aria-label={t('close')} disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>×</button>
                  <p className="eyebrow">{t('deleteListing')}</p>
                  <h2 id="delete-listing-title">{t('deleteListingQuestion')}</h2>
                  <div className="delete-listing-summary">
                    {deleteTarget.photo_urls?.[0] || deleteTarget.photo_url ? <img src={deleteTarget.photo_urls?.[0] ?? deleteTarget.photo_url ?? ''} alt="" /> : <div className="delete-listing-photo-empty" aria-hidden="true">🐾</div>}
                    <div>
                      <h3>{deleteTarget.title}</h3>
                      <p>{deleteTarget.city}, {deleteTarget.country} · {formatDate(deleteTarget.starts_on)} – {formatDate(deleteTarget.ends_on)}</p>
                      {deleteTarget.listing_type === 'need_sitter' && <p>{t('petAndName', { type: t(`petTypes.${deleteTarget.pet_type}`), name: deleteTarget.pet_name ?? '' })}</p>}
                    </div>
                  </div>
                  <p id="delete-listing-warning" className="delete-listing-warning">{t('deleteListingWarning')}</p>
                  {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
                  <div className="delete-confirm-actions">
                    <button className="button button-outline" type="button" disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>{t('cancelKeepListing')}</button>
                    <button className="button button-danger" type="button" disabled={Boolean(deletingId)} onClick={() => void deleteListing()}>{deletingId ? t('deleting') : t('deleteForever')}</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
        {errorMessage && !deleteTarget && <p className="form-error" role="alert">{errorMessage}</p>}
      </section>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

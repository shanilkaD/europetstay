import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { Conversation, Listing, Profile } from '../../types/database'

type InboxItem = {
  conversation: Conversation
  listing: Listing
  otherPerson: Profile | undefined
}

type InboxDialogProps = {
  userId: string
  onClose: () => void
  onOpenConversation: (listing: Listing, conversationId: string) => void
}

export function InboxDialog({ userId, onClose, onOpenConversation }: InboxDialogProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) return

    let active = true
    async function loadInbox() {
      if (!client) return
      try {
        const { data: conversations, error: conversationsError } = await client
          .from('conversations')
          .select('*')
          .or(`owner_id.eq.${userId},sitter_id.eq.${userId}`)
          .order('created_at', { ascending: false })
        if (conversationsError) throw conversationsError
        if (conversations.length === 0) {
          if (active) setItems([])
          return
        }

        const listingIds = [...new Set(conversations.map((conversation) => conversation.listing_id))]
        const personIds = [...new Set(conversations.map((conversation) =>
          conversation.owner_id === userId ? conversation.sitter_id : conversation.owner_id,
        ))]
        const [listingsResult, profilesResult] = await Promise.all([
          client.from('listings').select('*').in('id', listingIds),
          client.from('profiles').select('id, display_name, avatar_url, created_at, updated_at').in('id', personIds),
        ])
        if (listingsResult.error) throw listingsResult.error
        if (profilesResult.error) throw profilesResult.error

        const listingById = new Map(listingsResult.data.map((listing) => [listing.id, listing]))
        const profileById = new Map(profilesResult.data.map((profile) => [profile.id, profile]))
        const nextItems = conversations.flatMap((conversation): InboxItem[] => {
          const listing = listingById.get(conversation.listing_id)
          if (!listing) return []
          return [{
            conversation,
            listing,
            otherPerson: profileById.get(conversation.owner_id === userId ? conversation.sitter_id : conversation.owner_id),
          }]
        })
        if (active) setItems(nextItems)
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : t('inboxLoadFailed'))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInbox()
    return () => { active = false }
  }, [t, userId])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog inbox-dialog" role="dialog" aria-modal="true" aria-labelledby="inbox-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        <p className="eyebrow">{t('yourConversations')}</p>
        <h2 id="inbox-title">{t('messages')}</h2>
        {loading && <p className="dialog-intro">{t('loadingConversations')}</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        {!loading && !errorMessage && items.length === 0 && <p className="dialog-intro">{t('noConversations')}</p>}
        {!supabase && <p className="form-error" role="status">{t('supabaseMissing')}</p>}
        <div className="inbox-list">
          {items.map(({ conversation, listing, otherPerson }) => (
            <button className="inbox-item" key={conversation.id} type="button" onClick={() => onOpenConversation(listing, conversation.id)}>
              <span className="inbox-avatar">{otherPerson?.display_name?.charAt(0) || '•'}</span>
              <span><strong>{otherPerson?.display_name || t('communityMember')}</strong><small>{listing.title} · {listing.city}</small></span>
              <span className="inbox-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

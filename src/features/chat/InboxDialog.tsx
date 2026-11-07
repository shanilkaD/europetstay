import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { Conversation, Listing, Profile } from '../../types/database'

type InboxItem = {
  conversation: Conversation
  listing: Listing
  otherPerson: Profile | undefined
  unreadCount: number
}

type InboxDialogProps = {
  userId: string
  onClose: () => void
  onExplore: () => void
  onOpenConversation: (listing: Listing, conversationId: string) => void
}

export function InboxDialog({ userId, onClose, onExplore, onOpenConversation }: InboxDialogProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) return

    let active = true
    let timedOut = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
      if (active) {
        setErrorMessage(t('inboxLoadTimedOut'))
        setLoading(false)
      }
    }, 15000)
    async function loadInbox() {
      if (!client) return
      try {
        const { data: conversations, error: conversationsError } = await client
          .from('conversations')
          .select('*')
          .or(`owner_id.eq.${userId},sitter_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal)
        if (conversationsError) throw conversationsError
        if (conversations.length === 0) {
          if (active) setItems([])
          return
        }

        const listingIds = [...new Set(conversations.map((conversation) => conversation.listing_id))]
        const personIds = [...new Set(conversations.map((conversation) =>
          conversation.owner_id === userId ? conversation.sitter_id : conversation.owner_id,
        ))]
        const [listingsResult, profilesResult, readsResult, messagesResult] = await Promise.all([
          client.from('listings').select('*').in('id', listingIds).abortSignal(controller.signal),
          client.from('profiles').select('id, display_name, avatar_url, created_at, updated_at').in('id', personIds).abortSignal(controller.signal),
          client.from('conversation_reads').select('conversation_id,last_read_at').eq('user_id', userId).in('conversation_id', conversations.map((conversation) => conversation.id)).abortSignal(controller.signal),
          client.from('messages').select('conversation_id,sender_id,created_at').in('conversation_id', conversations.map((conversation) => conversation.id)).order('created_at', { ascending: false }).limit(1000).abortSignal(controller.signal),
        ])
        if (listingsResult.error) throw listingsResult.error
        if (profilesResult.error) throw profilesResult.error
        if (readsResult.error) throw readsResult.error
        if (messagesResult.error) throw messagesResult.error

        const listingById = new Map(listingsResult.data.map((listing) => [listing.id, listing]))
        const profileById = new Map(profilesResult.data.map((profile) => [profile.id, profile]))
        const readAtByConversation = new Map(readsResult.data.map((read) => [read.conversation_id, read.last_read_at]))
        const unreadByConversation = new Map<string, number>()
        for (const message of messagesResult.data) {
          if (message.sender_id === userId) continue
          const readAt = readAtByConversation.get(message.conversation_id)
          if (!readAt || message.created_at > readAt) {
            unreadByConversation.set(message.conversation_id, (unreadByConversation.get(message.conversation_id) ?? 0) + 1)
          }
        }
        const nextItems = conversations.flatMap((conversation): InboxItem[] => {
          const listing = listingById.get(conversation.listing_id)
          if (!listing) return []
          return [{
            conversation,
            listing,
            otherPerson: profileById.get(conversation.owner_id === userId ? conversation.sitter_id : conversation.owner_id),
            unreadCount: unreadByConversation.get(conversation.id) ?? 0,
          }]
        })
        if (active) setItems(nextItems)
      } catch (error) {
        if (active && !timedOut) setErrorMessage(error instanceof Error ? error.message : t('inboxLoadFailed'))
      } finally {
        window.clearTimeout(timeout)
        if (active && !timedOut) setLoading(false)
      }
    }

    void loadInbox()
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [t, userId])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog inbox-dialog" role="dialog" aria-modal="true" aria-labelledby="inbox-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        <p className="eyebrow">{t('yourConversations')}</p>
        <h2 id="inbox-title">{t('messages')}</h2>
        {loading && <p className="dialog-intro">{t('loadingConversations')}</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        {!loading && !errorMessage && supabase && items.length === 0 && (
          <div className="inbox-empty">
            <p className="dialog-intro">{t('noConversations')}</p>
            <button className="button button-primary" type="button" onClick={onExplore}>{t('exploreStays')}</button>
          </div>
        )}
        {!supabase && <p className="form-error" role="status">{t('supabaseMissing')}</p>}
        <div className="inbox-list">
          {items.map(({ conversation, listing, otherPerson, unreadCount }) => (
            <button className="inbox-item" key={conversation.id} type="button" onClick={() => onOpenConversation(listing, conversation.id)}>
              <span className="inbox-avatar">{otherPerson?.display_name?.charAt(0) || '•'}</span>
              <span><strong>{otherPerson?.display_name || t('communityMember')}</strong><small>{listing.title} · {listing.city}</small></span>
              {unreadCount > 0 && <span className="unread-badge" aria-label={t('unreadMessageCount', { count: unreadCount })}>{unreadCount}</span>}
              <span className="inbox-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

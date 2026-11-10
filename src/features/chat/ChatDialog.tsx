import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Listing, ListingPrivateDetails, Message } from '../../types/database'

type ChatDialogProps = {
  listing: Listing
  user: User
  conversationId?: string
  onClose: () => void
}

export function ChatDialog({ listing, user, conversationId: existingConversationId, onClose }: ChatDialogProps) {
  const { t } = useTranslation()
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [privateCareDetails, setPrivateCareDetails] = useState<ListingPrivateDetails | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const markAsRead = useCallback(async (id: string) => {
    if (!supabase) return
    const { error } = await supabase.from('conversation_reads').upsert({
      conversation_id: id,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id,user_id' })
    if (error) throw error
  }, [user.id])

  useEffect(() => {
    const client = supabase
    if (!client) return

    const cancelled = { current: false }
    const channel = { current: null as RealtimeChannel | null }

    async function startChat() {
      if (!client) return
      try {
        let id = existingConversationId
        const ownerId = listing.listing_type === 'need_sitter' ? listing.owner_id : user.id
        const sitterId = listing.listing_type === 'need_sitter' ? user.id : listing.owner_id
        if (!id) {
          const { data: existing, error: existingError } = await client
            .from('conversations')
            .select('id')
            .eq('listing_id', listing.id)
            .eq('owner_id', ownerId)
            .eq('sitter_id', sitterId)
            .maybeSingle()
          if (existingError) throw existingError
          if (cancelled.current) return
          id = existing?.id
        }
        if (!id) {
          const { data: created, error: createError } = await client
            .from('conversations')
            .insert({ listing_id: listing.id, owner_id: ownerId, sitter_id: sitterId })
            .select('id')
            .single()
          if (cancelled.current) return
          if (createError?.code === '23505') {
            const { data: concurrent, error: retryError } = await client
              .from('conversations')
              .select('id')
              .eq('listing_id', listing.id)
              .eq('owner_id', ownerId)
              .eq('sitter_id', sitterId)
              .single()
            if (retryError) throw retryError
            id = concurrent.id
          } else if (createError) {
            throw createError
          } else {
            id = created.id
          }
        }
        if (cancelled.current || !id) return
        setConversationId(id)
        const conversationIdValue = id
        if (listing.listing_type === 'need_sitter') {
          const { data: careDetails, error: careError } = await client
            .from('listing_private_details')
            .select('*')
            .eq('listing_id', listing.id)
            .maybeSingle()
          if (careError) throw careError
          if (cancelled.current) return
          setPrivateCareDetails(careDetails)
        }
        channel.current = client.channel(`conversation:${conversationIdValue}:${crypto.randomUUID()}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationIdValue}`,
          }, (payload) => {
            const nextMessage = payload.new as Message
            setMessages((current) => current.some((message) => message.id === nextMessage.id)
              ? current
              : [...current, nextMessage])
            if (nextMessage.sender_id !== user.id) {
              void markAsRead(conversationIdValue).catch((error: unknown) => {
                setErrorMessage(error instanceof Error ? error.message : t('markReadFailed'))
              })
            }
          })
          .subscribe((status, subscriptionError) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setErrorMessage(subscriptionError?.message || t('realtimeFailed'))
            }
          })

        const { data: initialMessages, error: messagesError } = await client
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationIdValue)
          .order('created_at', { ascending: true })
        if (messagesError) throw messagesError
        if (!cancelled.current) {
          setMessages((current) => mergeMessages(initialMessages, current))
          await markAsRead(conversationIdValue)
        }
      } catch (error) {
        if (!cancelled.current) setErrorMessage(getErrorMessage(error, t('chatLoadFailed')))
      } finally {
        if (!cancelled.current) setLoading(false)
      }
    }

    void startChat()
    return () => {
      cancelled.current = true
      if (channel.current) void client.removeChannel(channel.current)
    }
  }, [existingConversationId, listing.id, listing.listing_type, listing.owner_id, markAsRead, t, user.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!supabase || !conversationId || !body || sending) return
    setSending(true)
    setErrorMessage('')
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: user.id, body })
        .select()
        .single()
      if (error) throw error
      setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data])
      setDraft('')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('sendMessageFailed')))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog chat-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <header className="chat-header">
          <div><p className="eyebrow">{t('conversationAbout')}</p><h2 id="chat-title">{listing.title}</h2><p>{listing.city}, {listing.country}</p><p className="chat-header-hint">{t('chatHeaderMeetHint')}</p></div>
          <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        </header>
        {privateCareDetails && (
          <aside className="private-care-summary">
            <strong>{t('privateCarePlan')}</strong>
            <span>{t('medicalNeeds')}: {privateCareDetails.medical_needs || t('noMedicalNeeds')}</span>
            <span>{t('vetName')}: {privateCareDetails.vet_name} · {privateCareDetails.vet_phone}</span>
            <span>{t('emergencyContactName')}: {privateCareDetails.emergency_contact_name} · {privateCareDetails.emergency_contact_phone}</span>
            <span>{t('whoPaysVet')}: {t(privateCareDetails.who_pays_vet === 'owner' ? 'ownerPays' : 'sharedVetCosts')}</span>
          </aside>
        )}
        <div className="chat-messages" aria-live="polite">
          {loading && <p className="chat-state">{t('loadingMessages')}</p>}
          {!loading && messages.length === 0 && <p className="chat-state">{t('startConversation')}</p>}
          {messages.map((message) => (
            <div className={`chat-message ${message.sender_id === user.id ? 'is-mine' : ''}`} key={message.id}>
              <p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {(errorMessage || !supabase) && <p className="form-error chat-error" role="alert">{errorMessage || t('supabaseMissing')}</p>}
        <form className="chat-form" autoComplete="new-password" onSubmit={(event) => void sendMessage(event)}>
          <label className="sr-only" htmlFor="chat-draft">{t('message')}</label>
          <input id="chat-draft" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('writeMessage')} maxLength={2000} disabled={loading || !conversationId} />
          <button className="button button-primary" type="submit" disabled={sending || loading || !draft.trim()}>{sending ? t('chatSending') : t('send')}</button>
        </form>
      </section>
    </div>
  )
}

function mergeMessages(first: Message[], second: Message[]) {
  const merged = new Map<string, Message>()
  for (const message of [...first, ...second]) merged.set(message.id, message)
  return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

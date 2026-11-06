import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthDialog } from '../features/auth/AuthDialog'
import { useAuth } from '../features/auth/useAuth'
import { ChatDialog } from '../features/chat/ChatDialog'
import { InboxDialog } from '../features/chat/InboxDialog'
import { CreateListingDialog } from '../features/listings/CreateListingDialog'
import { ListingCard } from '../features/listings/ListingCard'
import { MyListingsDialog } from '../features/listings/MyListingsDialog'
import { SitterApplicationDialog } from '../features/listings/SitterApplicationDialog'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Listing, Profile } from '../types/database'
import './App.css'

type Dialog = 'auth' | 'create' | 'sitter' | 'mine' | 'inbox' | null
type ChatTarget = { listing: Listing; conversationId?: string } | null

export default function App() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [petFilter, setPetFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [loadingListings, setLoadingListings] = useState(Boolean(supabase))
  const [listingError, setListingError] = useState('')
  const [actionError, setActionError] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [chatTarget, setChatTarget] = useState<ChatTarget>(null)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentYear] = useState(() => new Date().getFullYear())

  const loadListings = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .gte('ends_on', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) {
      setListingError(error.code === 'PGRST205' || error.code === 'PGRST204' ? t('databaseMigrationRequired') : error.message)
      setListings([])
      setLoadingListings(false)
      return
    }

    setListingError('')
    setListings(data)
    if (data.length > 0) {
      const ownerIds = [...new Set(data.map((listing) => listing.owner_id))]
      const { data: owners, error: ownersError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, created_at, updated_at')
        .in('id', ownerIds)
      if (ownersError) setListingError(ownersError.message)
      else setProfiles(Object.fromEntries(owners.map((owner) => [owner.id, owner])))
    }
    setLoadingListings(false)
  }, [t])

  // This effect starts an async Supabase request; it updates state only after that request resolves.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { void loadListings() }, [loadListings])

  useEffect(() => {
    document.documentElement.lang = i18n.language.slice(0, 2)
    document.title = t('pageTitle')
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = t('pageDescription')
  }, [i18n.language, t])

  const filteredListings = useMemo(() => listings.filter((listing) => {
    const location = locationFilter.trim().toLocaleLowerCase()
    const matchesLocation = !location ||
      listing.city.toLocaleLowerCase().includes(location) ||
      listing.country.toLocaleLowerCase().includes(location)
    const matchesPet = petFilter === 'all' || listing.pet_type === petFilter
    const matchesDates = (!startDateFilter || listing.ends_on >= startDateFilter) &&
      (!endDateFilter || listing.starts_on <= endDateFilter)
    return matchesLocation && matchesPet && matchesDates
  }), [listings, locationFilter, petFilter, startDateFilter, endDateFilter])
  const featuredListing = listings.find((listing) => listing.photo_urls?.[0] || listing.photo_url)
  const featuredPhoto = featuredListing?.photo_urls?.[0] ?? featuredListing?.photo_url

  async function handleSignOut() {
    setActionError('')
    try {
      await signOut()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('signOutFailed'))
    }
  }

  function startChat(listing: Listing, conversationId?: string) {
    if (!user) {
      setDialog('auth')
      return
    }
    setDialog(null)
    setChatTarget({ listing, conversationId })
  }

  function openForm(form: 'create' | 'sitter') {
    setEditingListing(null)
    setDialog(user ? form : 'auth')
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="EuroPetStay">
          <span className="brand-icon" aria-hidden="true">⌂</span>
          <span>euro<span>pet</span>stay</span>
        </a>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label={t('mainNavigation')}>
          <a href="#stays" onClick={() => setMenuOpen(false)}>{t('explore')}</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>{t('howItWorks')}</a>
          {user && (
            <>
              <button className="nav-mobile-action" type="button" onClick={() => { setDialog('inbox'); setMenuOpen(false) }}>{t('messages')}</button>
              <button className="nav-mobile-action" type="button" onClick={() => { setDialog('mine'); setMenuOpen(false) }}>{t('myListings')}</button>
              <button className="nav-mobile-action" type="button" onClick={() => { openForm('create'); setMenuOpen(false) }}>{t('createListing')}</button>
              <button className="nav-mobile-action" type="button" onClick={() => { setMenuOpen(false); void handleSignOut() }}>{t('signOut')}</button>
            </>
          )}
          {!user && <button className="nav-mobile-action" type="button" onClick={() => { setDialog('auth'); setMenuOpen(false) }}>{t('logIn')}</button>}
          {!user && <button className="nav-mobile-action" type="button" onClick={() => { setDialog('auth'); setMenuOpen(false) }}>{t('joinFree')}</button>}
          <label className="mobile-language-control">
            <span>{t('chooseLanguage')}</span>
            <select value={i18n.language.slice(0, 2)} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
              <option value="en">EN</option><option value="fr">FR</option><option value="de">DE</option>
            </select>
          </label>
        </nav>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
        <div className="header-actions">
          <label className="language-control">
            <span className="sr-only">{t('chooseLanguage')}</span>
            <select value={i18n.language.slice(0, 2)} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
              <option value="en">EN</option><option value="fr">FR</option><option value="de">DE</option>
            </select>
          </label>
          {user ? (
            <>
              <button className="button button-outline inbox-action" type="button" onClick={() => setDialog('inbox')}>{t('messages')}</button>
              <button className="button button-outline my-listings-action" type="button" onClick={() => setDialog('mine')}>{t('myListings')}</button>
              <button className="button button-outline create-action" type="button" onClick={() => openForm('create')}>{t('createListing')}</button>
              <button className="button button-dark sign-out-action" type="button" onClick={() => void handleSignOut()}>{t('signOut')}</button>
            </>
          ) : (
            <>
              <button className="button button-outline sign-in-button" type="button" onClick={() => setDialog('auth')}>{t('logIn')}</button>
              <button className="button button-dark" type="button" onClick={() => setDialog('auth')}>{t('joinFree')}</button>
            </>
          )}
        </div>
      </header>

      <main>
        {!isSupabaseConfigured && (
          <div className="setup-notice" role="status">{t('supabaseMissing')}</div>
        )}
        {actionError && <p className="form-error page-error" role="alert">{actionError}</p>}

        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">{t('heroEyebrow')}</p>
            <h1>{t('heroTitle')}<br /><em>{t('heroHighlight')}</em></h1>
            <p className="hero-description">{t('heroDescription')}</p>
            <a className="hero-link" href="#how-it-works">{t('howItWorks')} <span>→</span></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-sun" />
            <div className="hero-home"><span>⌂</span></div>
            <div className="hero-pet">🐈</div>
            <div className="hero-note">{t('stayForCare')}</div>
          </div>
          <form className="search-bar" onSubmit={(event) => { event.preventDefault(); document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' }) }}>
            <label className="search-location"><span>{t('where')}</span><input value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder={t('cityOrCountry')} /></label>
            <fieldset className="search-dates">
              <legend>{t('when')}</legend>
              <label className={`search-date-field ${startDateFilter ? '' : 'has-placeholder'}`}><span className="sr-only">{t('startDate')}</span>{!startDateFilter && <span className="date-placeholder">{t('selectDate')}</span>}<input type="date" aria-label={t('startDate')} value={startDateFilter} max={endDateFilter || undefined} onChange={(event) => setStartDateFilter(event.target.value)} /></label>
              <span aria-hidden="true">–</span>
              <label className={`search-date-field ${endDateFilter ? '' : 'has-placeholder'}`}><span className="sr-only">{t('endDate')}</span>{!endDateFilter && <span className="date-placeholder">{t('selectDate')}</span>}<input type="date" aria-label={t('endDate')} value={endDateFilter} min={startDateFilter || undefined} onChange={(event) => setEndDateFilter(event.target.value)} /></label>
            </fieldset>
            <label><span>{t('petType')}</span><select value={petFilter} onChange={(event) => setPetFilter(event.target.value)}><option value="all">{t('allPets')}</option><option value="cat">{t('petTypes.cat')}</option><option value="dog">{t('petTypes.dog')}</option><option value="bird">{t('petTypes.bird')}</option><option value="other">{t('petTypes.other')}</option></select></label>
            <button className="button button-primary" type="submit">{t('findAStay')} <span>→</span></button>
          </form>
          <div className="hero-actions">
            <button className="button button-dark" type="button" onClick={() => openForm('sitter')}>{t('sitterCta')}</button>
            <button className="button button-outline" type="button" onClick={() => openForm('create')}>{t('ownerCta')}</button>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <p className="eyebrow">{t('howEyebrow')}</p>
          <h2>{t('howTitle')}</h2>
          <div className="steps-grid">
            <article><span>01</span><h3>{t('stepOneTitle')}</h3><p>{t('stepOneText')}</p></article>
            <article><span>02</span><h3>{t('stepTwoTitle')}</h3><p>{t('stepTwoText')}</p></article>
            <article><span>03</span><h3>{t('stepThreeTitle')}</h3><p>{t('stepThreeText')}</p></article>
            <article className="review-step">
              <div className="review-step-photo">
                {featuredPhoto ? <img src={featuredPhoto} alt="" /> : <span aria-hidden="true">🐾</span>}
              </div>
              <div><span>04</span><h3>{t('stepFourTitle')}</h3><p>{t('stepFourText')}</p></div>
            </article>
          </div>
          <aside className="safety-note" id="safety">
            <h3>{t('safetyTitle')}</h3>
            <p>{t('safetyText')}</p>
          </aside>
        </section>

        <section className="stays-section" id="stays">
          <div className="section-heading">
            <div><p className="eyebrow">{t('latestListings')}</p><h2>{t('staysTitle')}</h2></div>
            {user && <button className="button button-dark" type="button" onClick={() => openForm('create')}>{t('createListing')} <span>+</span></button>}
          </div>
          {listingError ? (
            <p className="form-error" role="alert">{t('listingLoadFailed')}: {listingError}</p>
          ) : loadingListings || authLoading ? (
            <p className="listing-state">{t('loadingListings')}</p>
          ) : filteredListings.length > 0 ? (
            <div className="listing-grid">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} owner={profiles[listing.owner_id] ?? null} currentUserId={user?.id} onChat={(selected) => startChat(selected)} />
              ))}
            </div>
          ) : (
            <div className="listing-state empty-listings">
              <span aria-hidden="true">🐾</span>
              <h3>{listings.length === 0 ? t('noListingsTitle') : t('noResultsTitle')}</h3>
              <p>{listings.length === 0 ? t('noListingsText') : t('noResultsText')}</p>
              {listings.length === 0 && user && <button className="button button-primary" type="button" onClick={() => openForm('create')}>{t('createFirstListing')}</button>}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-about">
            <a className="brand footer-brand" href="#">
              <span className="brand-icon" aria-hidden="true">⌂</span>
              <span>euro<span>pet</span>stay</span>
            </a>
            <p>{t('footerText')}</p>
            <a href="mailto:hello@europetstay.com">hello@europetstay.com</a>
          </div>
          <div className="footer-column">
            <h2>{t('footerExplore')}</h2>
            <a href="#stays">{t('explore')}</a>
            <a href="#how-it-works">{t('howItWorks')}</a>
            {user && <button type="button" onClick={() => openForm('create')}>{t('createListing')}</button>}
            {user && <button type="button" onClick={() => setDialog('mine')}>{t('myListings')}</button>}
          </div>
          <div className="footer-column">
            <h2>{t('help')}</h2>
            <a href="#how-it-works">{t('faq')}</a>
            <a href="#safety">{t('safety')}</a>
            <a href="mailto:hello@europetstay.com">{t('contact')}</a>
          </div>
          <div className="footer-column">
            <h2>{t('legal')}</h2>
            <a href="/terms.html">{t('terms')}</a>
            <a href="/privacy.html">{t('privacy')}</a>
            <label className="footer-language-control">
              <span>{t('chooseLanguage')}</span>
              <select value={i18n.language.slice(0, 2)} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
                <option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option>
              </select>
            </label>
          </div>
          <div className="footer-note">
            <span aria-hidden="true">✳</span>
            <p>{t('footerPromise')}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {currentYear} EuroPetStay</span>
          <span>{t('freeStay')} · {t('happyPets')}</span>
        </div>
      </footer>

      {dialog === 'auth' && <AuthDialog onClose={() => setDialog(null)} />}
      {dialog === 'create' && user && <CreateListingDialog
        key={editingListing?.id ?? 'new'}
        userId={user.id}
        listing={editingListing ?? undefined}
        onClose={() => { setDialog(null); setEditingListing(null) }}
        onCreated={(listing) => setListings((current) => [listing, ...current.filter((item) => item.id !== listing.id)])}
        onViewListing={(listing) => {
          setDialog(null)
          setEditingListing(null)
          window.setTimeout(() => document.getElementById(`listing-${listing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
        }}
      />}
      {dialog === 'sitter' && user && <SitterApplicationDialog userId={user.id} onClose={() => setDialog(null)} />}
      {dialog === 'mine' && user && <MyListingsDialog
        userId={user.id}
        onClose={() => setDialog(null)}
        onEdit={(listing) => { setEditingListing(listing); setDialog('create') }}
        onDeleted={(listingId) => setListings((current) => current.filter((listing) => listing.id !== listingId))}
      />}
      {dialog === 'inbox' && user && <InboxDialog userId={user.id} onClose={() => setDialog(null)} onOpenConversation={(listing, conversationId) => startChat(listing, conversationId)} />}
      {chatTarget && user && <ChatDialog key={`${chatTarget.listing.id}:${chatTarget.conversationId ?? 'new'}`} listing={chatTarget.listing} conversationId={chatTarget.conversationId} user={user} onClose={() => setChatTarget(null)} />}
    </div>
  )
}

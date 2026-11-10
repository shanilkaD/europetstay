import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthDialog } from '../features/auth/AuthDialog'
import { useAuth } from '../features/auth/useAuth'
import { ChatDialog } from '../features/chat/ChatDialog'
import { InboxDialog } from '../features/chat/InboxDialog'
import { ListingCard } from '../features/listings/ListingCard'
import { MyListingsDialog } from '../features/listings/MyListingsDialog'
import { StructuredListingDialog } from '../features/listings/StructuredListingDialog'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { Analytics } from '@vercel/analytics/react'
import type { Listing, Profile } from '../types/database'
import './App.css'

type ListingRole = 'create' | 'sitter'
type Dialog = 'auth' | 'role' | ListingRole | 'mine' | 'inbox' | null
type ChatTarget = { listing: Listing; conversationId?: string } | null

function isSitterType(value: string): value is NonNullable<Listing['sitter_type']> {
  return value === 'single' || value === 'couple' || value === 'family'
}

function isSmoker(value: string): value is NonNullable<Listing['smoker']> {
  return value === 'smoker' || value === 'non_smoker'
}

export default function App() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [activePostTab, setActivePostTab] = useState<'stays' | 'sitters'>('stays')
  const [petFilter, setPetFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [sitterTypeFilter, setSitterTypeFilter] = useState<NonNullable<Listing['sitter_type']> | ''>('')
  const [smokerFilter, setSmokerFilter] = useState<NonNullable<Listing['smoker']> | ''>('')
  const [skillFilter, setSkillFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [loadingListings, setLoadingListings] = useState(Boolean(supabase))
  const [listingError, setListingError] = useState('')
  const [actionError, setActionError] = useState('')
  const [dialog, setDialog] = useState<Dialog>(() =>
    new URLSearchParams(window.location.search).has('password-recovery') ? 'auth' : null,
  )
  const [pendingRole, setPendingRole] = useState<ListingRole | null>(null)
  const [profileData, setProfileData] = useState<{ userId: string; userRole: Profile['user_role']; error: string } | null>(null)
  const [chatTarget, setChatTarget] = useState<ChatTarget>(null)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentYear] = useState(() => new Date().getFullYear())
  const listingRequestId = useRef(0)
  const profileMatchesUser = Boolean(user && profileData?.userId === user.id)
  const profileRole = profileMatchesUser && profileData ? profileData.userRole : null
  const roleError = profileMatchesUser && profileData ? profileData.error : ''
  const activeDialog = user && pendingRole && profileRole ? pendingRole : dialog
  const needsRoleChoice = Boolean(user && profileMatchesUser && !profileRole && (!pendingRole || roleError))

  const loadListings = useCallback(async () => {
    if (!supabase) return
    const requestId = ++listingRequestId.current
    setLoadingListings(true)
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'live')
      .eq('listing_type', activePostTab === 'stays' ? 'need_sitter' : 'offer_sitting')
      .gte('ends_on', startDateFilter || new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
    if (locationFilter.trim()) query = query.ilike('city', `%${locationFilter.trim()}%`)
    if (endDateFilter) query = query.lte('starts_on', endDateFilter)
    if (petFilter !== 'all') query = query.contains(activePostTab === 'stays' ? 'pet_types' : 'can_care_for', [petFilter])
    if (activePostTab === 'sitters' && sitterTypeFilter) query = query.eq('sitter_type', sitterTypeFilter)
    if (activePostTab === 'sitters' && smokerFilter) query = query.eq('smoker', smokerFilter)
    if (activePostTab === 'sitters' && skillFilter) query = query.contains('special_skills', [skillFilter])
    if (languageFilter) query = query.contains('languages', [languageFilter])
    const { data, error } = await query.limit(60)

    if (requestId !== listingRequestId.current) return
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
        .select('id, display_name, avatar_url, id_verified, references_count, avg_rating, total_reviews, created_at, updated_at')
        .in('id', ownerIds)
      if (requestId !== listingRequestId.current) return
      if (ownersError) setListingError(ownersError.message)
      else setProfiles(Object.fromEntries(owners.map((owner) => [owner.id, owner])))
    } else setProfiles({})
    setLoadingListings(false)
  }, [activePostTab, endDateFilter, languageFilter, locationFilter, petFilter, skillFilter, smokerFilter, startDateFilter, sitterTypeFilter, t])

  // This effect starts an async Supabase request; it updates state only after that request resolves.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { void loadListings() }, [loadListings])

  useEffect(() => {
    if (!user || !supabase) return

    let active = true
    const client = supabase
    void client.from('profiles').select('user_role').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return
      setProfileData({ userId: user.id, userRole: data?.user_role ?? null, error: error?.message ?? '' })
    })
    return () => { active = false }
  }, [user])

  const saveUserRole = useCallback(async (role: NonNullable<Profile['user_role']>) => {
    if (!supabase || !user) return
    const client = supabase
    const { data, error } = await client
      .from('profiles')
      .upsert({ id: user.id, user_role: role }, { onConflict: 'id' })
      .select('user_role')
      .single()
    if (error) {
      setProfileData({ userId: user.id, userRole: null, error: error.message })
      return
    }
    setProfileData({ userId: user.id, userRole: data.user_role, error: '' })
    setPendingRole(null)
    setDialog(role === 'owner' ? 'create' : 'sitter')
  }, [user])

  // Persist the role implied by a role-specific CTA after authentication finishes.
  useEffect(() => {
    if (!user || !pendingRole || !profileMatchesUser || profileRole || roleError) return
    // eslint-disable-next-line react/set-state-in-effect
    void saveUserRole(pendingRole === 'create' ? 'owner' : 'sitter')
  }, [pendingRole, profileMatchesUser, profileRole, roleError, saveUserRole, user])

  useEffect(() => {
    document.documentElement.lang = i18n.language.slice(0, 2)
    document.title = t('pageTitle')
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = t('pageDescription')
  }, [i18n.language, t])

  useEffect(() => {
    if (!activeDialog && !chatTarget && !needsRoleChoice) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [activeDialog, chatTarget, needsRoleChoice])

  const filteredListings = listings

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

  function openForm(form: ListingRole) {
    setEditingListing(null)
    setPendingRole(null)
    if (!user) {
      setPendingRole(form)
      setDialog('auth')
      return
    }
    setDialog(form)
  }

  function openRoleChooser() {
    setEditingListing(null)
    setDialog('role')
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="EuroPetStay">
          <span className="brand-icon" aria-hidden="true">⌂</span>
          <span>euro<span>pet</span>stay</span>
        </a>
        {menuOpen && <button className="mobile-nav-backdrop" type="button" aria-label={t('closeMenu')} onClick={() => setMenuOpen(false)} />}
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label={t('mainNavigation')}>
          <a href="#stays" onClick={() => setMenuOpen(false)}>{t('explore')}</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>{t('howItWorks')}</a>
          {user && (
            <>
              <button className="nav-mobile-action" type="button" onClick={() => { setDialog('inbox'); setMenuOpen(false) }}>{t('messages')}</button>
              <button className="nav-mobile-action" type="button" onClick={() => { setDialog('mine'); setMenuOpen(false) }}>{t('myListings')}</button>
              <button className="nav-mobile-action" type="button" onClick={() => { openRoleChooser(); setMenuOpen(false) }}>{t('createListing')}</button>
              <button className="nav-mobile-action" type="button" onClick={() => { setMenuOpen(false); void handleSignOut() }}>{t('signOut')}</button>
            </>
          )}
          {!user && !authLoading && <button className="nav-mobile-action" type="button" onClick={() => { setDialog('auth'); setMenuOpen(false) }}>{t('joinFree')}</button>}
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
              <button className="button button-outline create-action" type="button" onClick={openRoleChooser}>{t('createListing')}</button>
              <button className="button button-dark sign-out-action" type="button" onClick={() => void handleSignOut()}>{t('signOut')}</button>
            </>
          ) : !authLoading ? (
            <button className="button button-dark" type="button" onClick={() => setDialog('auth')}>{t('joinFree')}</button>
          ) : null}
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
          <form className="search-bar" autoComplete="new-password" onSubmit={(event) => { event.preventDefault(); document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' }) }}>
            <label className="search-location"><span>{t('where')}</span><input autoComplete="off" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder={t('cityOrCountry')} /></label>
            <fieldset className="search-dates">
              <legend>{t('when')}</legend>
              <label className={`search-date-field ${startDateFilter ? '' : 'has-placeholder'}`}><span className="sr-only">{t('startDate')}</span>{!startDateFilter && <span className="date-placeholder">{t('selectDate')}</span>}<input autoComplete="off" type="date" aria-label={t('startDate')} value={startDateFilter} max={endDateFilter || undefined} onChange={(event) => setStartDateFilter(event.target.value)} /></label>
              <span aria-hidden="true">–</span>
              <label className={`search-date-field ${endDateFilter ? '' : 'has-placeholder'}`}><span className="sr-only">{t('endDate')}</span>{!endDateFilter && <span className="date-placeholder">{t('selectDate')}</span>}<input autoComplete="off" type="date" aria-label={t('endDate')} value={endDateFilter} min={startDateFilter || undefined} onChange={(event) => setEndDateFilter(event.target.value)} /></label>
            </fieldset>
            <label><span>{t('petType')}</span><select value={petFilter} onChange={(event) => setPetFilter(event.target.value)}><option value="all">{t('allPets')}</option><option value="cat">{t('petTypes.cat')}</option><option value="dog">{t('petTypes.dog')}</option><option value="bird">{t('petTypes.bird')}</option><option value="other">{t('petTypes.other')}</option></select></label>
            <button className="button button-primary" type="submit">{t('findYourExchange')} <span>→</span></button>
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
            <article><div className="step-visual" aria-hidden="true">🏠</div><span>01</span><h3>{t('stepOneTitle')}</h3><p>{t('stepOneText')}</p></article>
            <article><div className="step-visual" aria-hidden="true">💬</div><span>02</span><h3>{t('stepTwoTitle')}</h3><p>{t('stepTwoText')}</p></article>
            <article><div className="step-visual" aria-hidden="true">🧳</div><span>03</span><h3>{t('stepThreeTitle')}</h3><p>{t('stepThreeText')}</p></article>
            <article><div className="step-visual" aria-hidden="true">🐾</div><span>04</span><h3>{t('stepFourTitle')}</h3><p>{t('stepFourText')}</p></article>
          </div>
          <aside className="safety-note" id="safety">
            <h3>{t('safetyTitle')}</h3>
            <p>{t('safetyText')}</p>
          </aside>
        </section>

        <section className="stays-section" id="stays">
          <div className="section-heading">
            <div><p className="eyebrow">{t('latestListings')}</p><h2>{t(activePostTab === 'stays' ? 'staysTitle' : 'sittersTitle')}</h2></div>
            {user && <button className="button button-dark" type="button" onClick={openRoleChooser}>{t('createListing')} <span>+</span></button>}
          </div>
          <div className="post-tabs" role="tablist" aria-label={t('availablePosts')}>
            <button className={`post-tab ${activePostTab === 'stays' ? 'is-active' : ''}`} role="tab" aria-selected={activePostTab === 'stays'} type="button" onClick={() => setActivePostTab('stays')}>{t('staysTitle')}</button>
            <button className={`post-tab ${activePostTab === 'sitters' ? 'is-active' : ''}`} role="tab" aria-selected={activePostTab === 'sitters'} type="button" onClick={() => setActivePostTab('sitters')}>{t('sittersTitle')}</button>
          </div>
          <div className="advanced-search-filters">
            {activePostTab === 'sitters' && (
              <>
                <label>{t('sitterType')}<select value={sitterTypeFilter} onChange={(event) => { if (!event.target.value) setSitterTypeFilter(''); else if (isSitterType(event.target.value)) setSitterTypeFilter(event.target.value) }}><option value="">{t('anySitterType')}</option>{['single', 'couple', 'family'].map((value) => <option key={value} value={value}>{t(`partyTypes.${value}`)}</option>)}</select></label>
                <label>{t('smoking')}<select value={smokerFilter} onChange={(event) => { if (!event.target.value) setSmokerFilter(''); else if (isSmoker(event.target.value)) setSmokerFilter(event.target.value) }}><option value="">{t('anySmoking')}</option><option value="non_smoker">{t('smokerOptions.non_smoker')}</option><option value="smoker">{t('smokerOptions.smoker')}</option></select></label>
                <label>{t('specialSkills')}<select value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}><option value="">{t('anySkill')}</option>{['medical_care', 'anxiety', 'large_dogs', 'puppies', 'elderly_pets'].map((value) => <option key={value} value={value}>{t(`specialSkillOptions.${value}`)}</option>)}</select></label>
              </>
            )}
            <label>{t('languagesYouSpeak')}<select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}><option value="">{t('anyLanguage')}</option>{['en', 'es', 'fr', 'de', 'other'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
          </div>
          <div className="active-filter-chips">
            {locationFilter && <button type="button" onClick={() => setLocationFilter('')}>📍 {locationFilter} ×</button>}
            {(startDateFilter || endDateFilter) && <button type="button" onClick={() => { setStartDateFilter(''); setEndDateFilter('') }}>📅 {startDateFilter || '…'} – {endDateFilter || '…'} ×</button>}
            {petFilter !== 'all' && <button type="button" onClick={() => setPetFilter('all')}>🐾 {t(`petTypes.${petFilter}`)} ×</button>}
            {sitterTypeFilter && <button type="button" onClick={() => setSitterTypeFilter('')}>👥 {t(`partyTypes.${sitterTypeFilter}`)} ×</button>}
            {smokerFilter && <button type="button" onClick={() => setSmokerFilter('')}>🚭 {t(`smokerOptions.${smokerFilter}`)} ×</button>}
            {skillFilter && <button type="button" onClick={() => setSkillFilter('')}>✦ {t(`specialSkillOptions.${skillFilter}`)} ×</button>}
            {languageFilter && <button type="button" onClick={() => setLanguageFilter('')}>💬 {languageFilter.toUpperCase()} ×</button>}
            {(locationFilter || startDateFilter || endDateFilter || petFilter !== 'all' || sitterTypeFilter || smokerFilter || skillFilter || languageFilter) && <button className="clear-filter-button" type="button" onClick={() => { setLocationFilter(''); setStartDateFilter(''); setEndDateFilter(''); setPetFilter('all'); setSitterTypeFilter(''); setSmokerFilter(''); setSkillFilter(''); setLanguageFilter('') }}>{t('clearAllFilters')}</button>}
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
              <h3>{t('noResultsTitle')}</h3>
              <p>{t('noMatchingListings', { city: locationFilter || t('anyCity'), dates: [startDateFilter, endDateFilter].filter(Boolean).join(' – ') || t('anyDates'), pet: petFilter === 'all' ? t('anyPet') : t(`petTypes.${petFilter}`) })}</p>
              <button className="button button-outline" type="button" onClick={() => { setLocationFilter(''); setStartDateFilter(''); setEndDateFilter(''); setPetFilter('all'); setSitterTypeFilter(''); setSmokerFilter(''); setSkillFilter(''); setLanguageFilter('') }}>{t('clearAllFilters')}</button>
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
            <a href="mailto:senadhee1999@gmail.com">{t('emailUs')}</a>
          </div>
          <div className="footer-column">
            <h2>{t('footerExplore')}</h2>
            <a href="#stays">{t('explore')}</a>
            <a href="#how-it-works">{t('howItWorks')}</a>
            {user && <button type="button" onClick={openRoleChooser}>{t('createListing')}</button>}
            {user && <button type="button" onClick={() => setDialog('mine')}>{t('myListings')}</button>}
          </div>
          <div className="footer-column">
            <h2>{t('help')}</h2>
            <a href="#how-it-works">{t('faq')}</a>
            <a href="/trust-safety.html">{t('trustSafety')}</a>
            <a href="mailto:senadhee1999@gmail.com">{t('emailUs')}</a>
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

      {activeDialog === 'auth' && <AuthDialog
        onClose={() => { setDialog(null); setPendingRole(null) }}
        onAuthenticated={() => setDialog(null)}
      />}
      {needsRoleChoice && (
        <div className="dialog-backdrop">
          <section className="dialog role-chooser-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-role-title">
            <p className="eyebrow">{t('welcome')}</p>
            <h2 id="welcome-role-title">{t('firstRoleQuestion')}</h2>
            <div className="role-chooser-actions">
              <button className="button button-primary" type="button" disabled={!supabase} onClick={() => void saveUserRole('owner')}>{t('imAnOwner')}</button>
              <button className="button button-dark" type="button" disabled={!supabase} onClick={() => void saveUserRole('sitter')}>{t('imASitter')}</button>
            </div>
            {roleError && <p className="form-error" role="alert">{roleError}</p>}
          </section>
        </div>
      )}
      {activeDialog === 'role' && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}>
          <section className="dialog role-chooser-dialog" role="dialog" aria-modal="true" aria-labelledby="role-chooser-title">
            <button className="dialog-close" type="button" aria-label={t('close')} onClick={() => setDialog(null)}>×</button>
            <p className="eyebrow">{t('createListing')}</p>
            <h2 id="role-chooser-title">{t('chooseListingRole')}</h2>
            <div className="role-chooser-actions">
              <button className="button button-primary" type="button" onClick={() => openForm('create')}>{t('imAnOwner')}</button>
              <button className="button button-dark" type="button" onClick={() => openForm('sitter')}>{t('imASitter')}</button>
            </div>
          </section>
        </div>
      )}
      {(activeDialog === 'create' || activeDialog === 'sitter') && user && <StructuredListingDialog
        key={editingListing?.id ?? 'new'}
        userId={user.id}
        initialListingType={activeDialog === 'sitter' ? 'offer_sitting' : 'need_sitter'}
        listing={editingListing ?? undefined}
        onClose={() => { setDialog(null); setEditingListing(null); setPendingRole(null) }}
        onCreated={(listing) => {
          setActivePostTab(listing.listing_type === 'need_sitter' ? 'stays' : 'sitters')
          setListings((current) => [listing, ...current.filter((item) => item.id !== listing.id)])
        }}
        onViewListing={(listing) => {
          setActivePostTab(listing.listing_type === 'need_sitter' ? 'stays' : 'sitters')
          setDialog(null)
          setEditingListing(null)
          setPendingRole(null)
          window.setTimeout(() => document.getElementById(`listing-${listing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
        }}
      />}
      {activeDialog === 'mine' && user && <MyListingsDialog
        userId={user.id}
        onClose={() => setDialog(null)}
        onEdit={(listing) => { setEditingListing(listing); setDialog('create') }}
        onMessages={() => setDialog('inbox')}
        onView={(listing) => {
          setListings((current) => [listing, ...current.filter((item) => item.id !== listing.id)])
          setActivePostTab(listing.listing_type === 'need_sitter' ? 'stays' : 'sitters')
          setDialog(null)
          window.setTimeout(() => {
            document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' })
            document.getElementById(`listing-${listing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 0)
        }}
        onDeleted={(listingId) => {
          setListings((current) => current.filter((listing) => listing.id !== listingId))
        }}
      />}
      {activeDialog === 'inbox' && user && <InboxDialog
        userId={user.id}
        onClose={() => setDialog(null)}
        onExplore={() => { setDialog(null); window.setTimeout(() => document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' }), 0) }}
        onOpenConversation={(listing, conversationId) => startChat(listing, conversationId)}
      />}
      {chatTarget && user && <ChatDialog key={`${chatTarget.listing.id}:${chatTarget.conversationId ?? 'new'}`} listing={chatTarget.listing} conversationId={chatTarget.conversationId} user={user} onClose={() => setChatTarget(null)} />}
      <Analytics />
    </div>
  )
}

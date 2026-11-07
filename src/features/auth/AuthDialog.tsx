import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

type AuthDialogProps = {
  onClose: () => void
  onAuthenticated: () => void
}

type AuthMode = 'signin' | 'signup' | 'reset'

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const { t } = useTranslation()
  const isPasswordRecovery = new URLSearchParams(window.location.search).has('password-recovery')
  const [mode, setMode] = useState<AuthMode>(() => isPasswordRecovery ? 'reset' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => subscription.unsubscribe()
  }, [])

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setErrorMessage('')
    setSuccessMessage('')
    setPassword('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }

    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      if (mode === 'reset') {
        if (!isPasswordRecovery) throw new Error(t('emailRequiredForReset'))
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        const url = new URL(window.location.href)
        url.searchParams.delete('password-recovery')
        window.history.replaceState({}, '', url)
        onAuthenticated()
        return
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (error) throw error
        if (data.session && data.user) {
          onAuthenticated()
        } else {
          setSuccessMessage(t('accountConfirmationRequired'))
        }
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error
      onAuthenticated()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('authFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    if (!email.trim()) {
      setErrorMessage(t('emailRequiredForReset'))
      return
    }
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const redirectTo = new URL(window.location.origin)
      redirectTo.searchParams.set('password-recovery', '1')
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectTo.toString() })
      if (error) throw error
      setSuccessMessage(t('passwordResetSent'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('authFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    setBusy(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'email profile',
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('authFailed'))
      setBusy(false)
    }
  }

  const title = mode === 'signup' ? t('createAccount') : mode === 'reset' ? t('resetPassword') : t('signIn')

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        <span className="dialog-paw" aria-hidden="true">🐾</span>
        <p className="eyebrow">{t('welcome')}</p>
        <h2 id="auth-title">{title}</h2>
        <p className="dialog-intro">{mode === 'reset' ? t('resetPasswordDescription') : t('authDescription')}</p>

        {mode !== 'reset' && (
          <>
            <button className="google-button" type="button" onClick={() => void signInWithGoogle()} disabled={busy || !supabase}>
              <GoogleMark /> {t('continueWithGoogle')}
            </button>
            <div className="auth-separator"><span>{t('orContinueWithEmail')}</span></div>
          </>
        )}

        <form autoComplete={mode === 'signup' ? 'on' : 'off'} onSubmit={(event) => void submit(event)}>
          {mode === 'signup' && (
            <>
              <label className="form-label" htmlFor="auth-name">{t('yourName')}</label>
              <input id="auth-name" className="form-input" type="text" autoComplete="name" minLength={2} maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} />
            </>
          )}
          {!(mode === 'reset' && isPasswordRecovery) && (
            <>
              <label className="form-label" htmlFor="auth-email">{t('emailAddress')}</label>
              <input id="auth-email" className="form-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </>
          )}
          {mode !== 'reset' && (
            <>
              <label className="form-label" htmlFor="auth-password">{t('password')}</label>
              <input id="auth-password" className="form-input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} />
              {mode === 'signin' && <button className="text-button" type="button" onClick={() => changeMode('reset')}>{t('forgotPassword')}</button>}
            </>
          )}
          {mode === 'reset' && isPasswordRecovery && (
            <>
              <label className="form-label" htmlFor="auth-new-password">{t('newPassword')}</label>
              <input id="auth-new-password" className="form-input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </>
          )}
          {mode !== 'reset' || isPasswordRecovery ? (
            <button className="button button-primary full-button" type="submit" disabled={busy || !supabase}>
              {busy ? t('saving') : mode === 'signup' ? t('createAccount') : mode === 'reset' ? t('saveNewPassword') : t('signIn')}
            </button>
          ) : <button className="button button-primary full-button" type="button" disabled={busy || !supabase} onClick={() => void sendPasswordReset()}>{busy ? t('sending') : t('sendPasswordReset')}</button>}
        </form>

        {mode !== 'reset' && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode(mode === 'signup' ? 'signin' : 'signup')}>
            {mode === 'signup' ? t('alreadyHaveAccount') : t('needAccount')}
          </button>
        )}
        {mode === 'reset' && !isPasswordRecovery && (
          <button className="text-button" type="button" disabled={busy} onClick={() => changeMode('signin')}>{t('backToSignIn')}</button>
        )}

        {successMessage && <p className="form-success" role="status">{successMessage}</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        {!supabase && <p className="form-error" role="status">{t('supabaseMissing')}</p>}
        <p className="auth-footnote">{t('authFootnote')}</p>
      </section>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.28 5.65c4.25-3.93 7.5-9.73 7.5-17.3Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 4)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.28-5.65c-2.02 1.36-4.6 2.17-8.62 2.17-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -3)" />
    </svg>
  )
}

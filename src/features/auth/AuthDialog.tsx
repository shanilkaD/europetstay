import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

type AuthDialogProps = {
  onClose: () => void
  onAuthenticated: () => void
}

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function sendSignInCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setStep('code')
      setSuccessMessage(t('codeSent'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('authFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      })
      if (error) throw error
      onAuthenticated()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('authFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    if (!supabase) {
      setErrorMessage(t('supabaseMissing'))
      return
    }
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setSuccessMessage(t('codeResent'))
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
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('authFailed'))
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close" type="button" aria-label={t('close')} onClick={onClose}>×</button>
        <span className="dialog-paw" aria-hidden="true">🐾</span>
        <p className="eyebrow">{t('welcome')}</p>
        <h2 id="auth-title">{t('authTitle')}</h2>
        <p className="dialog-intro">{t('authDescription')}</p>

        <button className="google-button" type="button" onClick={() => void signInWithGoogle()} disabled={busy || !supabase}>
          <GoogleMark /> {t('continueWithGoogle')}
        </button>
        <div className="auth-separator"><span>{t('orContinueWithEmail')}</span></div>

        {step === 'email' ? (
          <form autoComplete="new-password" onSubmit={(event) => void sendSignInCode(event)}>
            <label className="form-label" htmlFor="auth-email">{t('emailAddress')}</label>
            <input id="auth-email" className="form-input" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <button className="button button-primary full-button" type="submit" disabled={busy || !supabase}>
              {busy ? t('sending') : t('sendSignInCode')}
            </button>
          </form>
        ) : (
          <form autoComplete="new-password" onSubmit={(event) => void verifyCode(event)}>
            <p className="code-sent-to">{t('codeSentTo', { email })}</p>
            <label className="form-label" htmlFor="auth-code">{t('emailCode')}</label>
            <input
              id="auth-code"
              className="form-input otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={token}
              onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
            />
            <button className="button button-primary full-button" type="submit" disabled={busy || !supabase || token.length !== 6}>
              {busy ? t('verifyingCode') : t('verifyCode')}
            </button>
            <button className="text-button" type="button" disabled={busy || !supabase} onClick={() => void resendCode()}>
              {busy ? t('sending') : t('resendCode')}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={() => { setStep('email'); setToken(''); setErrorMessage(''); setSuccessMessage('') }}>{t('useDifferentEmail')}</button>
          </form>
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

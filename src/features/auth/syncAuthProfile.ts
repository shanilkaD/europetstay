import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

function metadataText(user: User, key: string) {
  const value: unknown = user.user_metadata[key]
  return typeof value === 'string' ? value.trim() : ''
}

export async function syncAuthProfile(user: User) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const providerName = metadataText(user, 'full_name') || metadataText(user, 'name')
  const emailName = user.email?.split('@')[0] || ''
  const displayName = providerName || emailName
  const avatarUrl = metadataText(user, 'avatar_url') || metadataText(user, 'picture') || null
  const { data: profile, error: loadError } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  if (loadError) throw loadError

  if (!profile) {
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
    })
    if (error && error.code !== '23505') throw error
    return
  }

  const update: { display_name?: string; avatar_url?: string } = {}
  if ((!profile.display_name.trim() || (providerName && profile.display_name === emailName)) && displayName) {
    update.display_name = displayName
  }
  if (!profile.avatar_url && avatarUrl) update.avatar_url = avatarUrl
  if (Object.keys(update).length === 0) return

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) throw error
}

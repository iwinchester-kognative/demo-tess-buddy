import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'

async function loadOrgData(userId) {
  console.log('step 1 - fetching user profile')

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('display_name, role, org_id')
    .eq('user_id', userId)
    .single()

  console.log('profile:', profile)
  console.log('profile error:', profileError)

  if (profileError) return null

  console.log('step 2 - fetching org')

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('org_id, org_name, tessitura_base_url, tessitura_auth_string')
    .eq('org_id', profile.org_id)
    .single()

  console.log('org:', org)
  console.log('org error:', orgError)

  if (orgError) return null

  return {
    display_name: profile.display_name,
    role: profile.role,
    organizations: org
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [orgData, setOrgData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let orgLoaded = false

    const tryLoadOrg = async (s) => {
      if (orgLoaded || !s) return
      orgLoaded = true
      try {
        const org = await loadOrgData(s.user.id)
        if (mounted) setOrgData(org)
      } catch (err) {
        console.error('loadOrgData error:', err)
      }
      if (mounted) setLoading(false)
    }

    // Listen for auth changes (handles sign-in, sign-out, token refresh, password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        console.log('auth event:', _event)
        if (!mounted) return
        if (_event === 'PASSWORD_RECOVERY') {
          setSession(newSession)
          setLoading(false)
          return
        }
        setSession(newSession)
        if (newSession) {
          tryLoadOrg(newSession)
        } else {
          setOrgData(null)
          setLoading(false)
        }
      }
    )

    // Fallback: if onAuthStateChange hasn't resolved within 3s, try getSession directly
    const timeout = setTimeout(async () => {
      if (!orgLoaded && mounted) {
        console.log('fallback: calling getSession')
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(s)
        if (s) {
          tryLoadOrg(s)
        } else {
          setLoading(false)
        }
      }
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div style={styles.loading}>Loading...</div>
    )
  }

  const isRecovery = session && !orgData && window.location.hash.includes('type=recovery')

  return (
    <div>
      {isRecovery
        ? <ResetPassword />
        : session && orgData
          ? <Dashboard session={session} orgData={orgData} />
          : <Login />
      }
    </div>
  )
}

const styles = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  }
}

export default App
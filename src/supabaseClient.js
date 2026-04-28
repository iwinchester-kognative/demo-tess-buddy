// DEMO MODE — no Supabase SDK, no network calls.
// Pure in-memory mock that mimics the Supabase client interface.

const FAKE_SESSION = {
  user: { id: 'demo-user-001', email: 'demo@tessbuddy.app', role: 'authenticated' },
  access_token: 'demo-token',
  expires_at: Date.now() / 1000 + 86400
}

let _listeners = []
let _session = null

export const supabase = {
  auth: {
    signInWithPassword: async ({ email }) => {
      await new Promise(r => setTimeout(r, 600))
      _session = { ...FAKE_SESSION, user: { ...FAKE_SESSION.user, email: email || 'demo@tessbuddy.app' } }
      setTimeout(() => _listeners.forEach(cb => cb('SIGNED_IN', _session)), 0)
      return { data: { session: _session }, error: null }
    },
    signOut: async () => {
      _session = null
      _listeners.forEach(cb => cb('SIGNED_OUT', null))
      return { error: null }
    },
    onAuthStateChange: (callback) => {
      _listeners.push(callback)
      setTimeout(() => callback(_session ? 'SIGNED_IN' : 'INITIAL_SESSION', _session), 50)
      return {
        data: {
          subscription: {
            unsubscribe: () => { _listeners = _listeners.filter(cb => cb !== callback) }
          }
        }
      }
    },
    getSession: async () => ({ data: { session: _session }, error: null }),
    updateUser: async () => ({ data: { user: FAKE_SESSION.user }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null })
  },
  from: (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => {
          if (table === 'user_profiles') {
            return { data: { display_name: 'Demo User', role: 'Admin', org_id: 1 }, error: null }
          }
          if (table === 'organizations') {
            return {
              data: {
                org_id: 1,
                org_name: 'Spoleto Festival USA',
                tessitura_base_url: 'https://demo.tessbuddy.app/TessituraService',
                tessitura_auth_string: 'DEMO'
              },
              error: null
            }
          }
          return { data: null, error: { message: 'Not found' } }
        }
      })
    })
  })
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

interface Student {
  id: string
  sis_id: string
  legal_first_name: string
  legal_last_name: string
  preferred_name?: string
  status: string
}

interface User {
  username: string
  full_name: string
  roles: string[]
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function App() {
  const [token, setToken] = React.useState<string | null>(() => localStorage.getItem('st_eric_token'))
  const [user, setUser] = React.useState<User | null>(() => {
    const cached = localStorage.getItem('st_eric_user')
    return cached ? JSON.parse(cached) : null
  })

  // Login form state
  const [username, setUsername] = React.useState('admin')
  const [password, setPassword] = React.useState('StEric@2026')
  const [loginLoading, setLoginLoading] = React.useState(false)
  const [loginError, setLoginError] = React.useState<string | null>(null)

  // Dashboard state
  const [activeTab, setActiveTab] = React.useState<'learners' | 'add' | 'sync' | 'audit'>('learners')
  const [students, setStudents] = React.useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [dashboardError, setDashboardError] = React.useState<string | null>(null)

  // Add student form state
  const [newSisId, setNewSisId] = React.useState('')
  const [newFirstName, setNewFirstName] = React.useState('')
  const [newLastName, setNewLastName] = React.useState('')
  const [newPreferredName, setNewPreferredName] = React.useState('')
  const [addLoading, setAddLoading] = React.useState(false)
  const [addMessage, setAddMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load students
  const loadStudents = React.useCallback(async (authToken: string) => {
    setLoadingStudents(true)
    setDashboardError(null)
    try {
      const response = await fetch(`${API}/api/v1/students?limit=200`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (response.status === 401) {
        handleLogout()
        throw new Error('Session expired. Please sign in again.')
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setStudents(data.items || [])
    } catch (err: any) {
      setDashboardError(err.message || 'Could not load student records.')
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  React.useEffect(() => {
    if (token) {
      loadStudents(token)
    }
  }, [token, loadStudents])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Invalid username or password')
      }
      const data = await res.json()
      localStorage.setItem('st_eric_token', data.access_token)
      localStorage.setItem('st_eric_user', JSON.stringify(data.user))
      setToken(data.access_token)
      setUser(data.user)
    } catch (err: any) {
      setLoginError(err.message || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('st_eric_token')
    localStorage.removeItem('st_eric_user')
    setToken(null)
    setUser(null)
    setStudents([])
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setAddLoading(true)
    setAddMessage(null)
    try {
      const res = await fetch(`${API}/api/v1/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sis_id: newSisId.trim(),
          legal_first_name: newFirstName.trim(),
          legal_last_name: newLastName.trim(),
          preferred_name: newPreferredName.trim() || undefined,
        }),
      })
      if (res.status === 409) {
        throw new Error('A learner with this SIS ID already exists.')
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to register learner')
      }
      setAddMessage({ type: 'success', text: `Successfully registered learner ${newFirstName} ${newLastName} (${newSisId})!` })
      setNewSisId('')
      setNewFirstName('')
      setNewLastName('')
      setNewPreferredName('')
      loadStudents(token)
    } catch (err: any) {
      setAddMessage({ type: 'error', text: err.message || 'Error creating learner' })
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDownloadSisZip() {
    if (!token) return
    try {
      const res = await fetch(`${API}/api/v1/students/export-sis`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to export SIS ZIP')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'st_eric_canvas_users.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error exporting Canvas SIS ZIP: ' + err.message)
    }
  }

  // Filter students
  const filteredStudents = students.filter(s => {
    const q = searchTerm.toLowerCase()
    return (
      s.sis_id.toLowerCase().includes(q) ||
      s.legal_first_name.toLowerCase().includes(q) ||
      s.legal_last_name.toLowerCase().includes(q) ||
      (s.preferred_name && s.preferred_name.toLowerCase().includes(q))
    )
  })

  // 1. If not logged in, render St Eric Secondary School Login
  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-header">
            <div className="mark" aria-hidden="true">SE</div>
            <p className="eyebrow">Norton, Zimbabwe</p>
            <h2>St Eric Secondary School</h2>
            <p style={{ color: '#5d707a', fontSize: '0.9rem', marginTop: '0.4rem' }}>
              Official Administration & Registrar Portal
            </p>
          </div>

          {loginError && <div role="alert" className="alert">{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input-text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input-text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loginLoading} style={{ marginTop: '0.8rem' }}>
              {loginLoading ? 'Signing in…' : 'Sign In to Portal'}
            </button>
          </form>

          <div className="login-hint">
            <strong>Default Administrator:</strong><br />
            Username: <code>admin</code><br />
            Password: <code>StEric@2026</code>
          </div>
        </div>
      </div>
    )
  }

  // 2. Main Authenticated Dashboard
  return (
    <div className="shell">
      <header>
        <div className="mark" aria-hidden="true">SE</div>
        <div>
          <p className="eyebrow">Norton, Zimbabwe · Established Platform</p>
          <h1>St Eric Secondary School — Administration</h1>
        </div>
        <div className="user-badge">
          <span>{user?.full_name || 'Staff'} ({user?.roles?.join(', ') || 'Registrar'})</span>
          <button onClick={handleLogout} title="Sign Out">Sign out</button>
        </div>
      </header>

      <nav aria-label="Primary">
        <a
          href="#learners"
          aria-current={activeTab === 'learners' ? 'page' : undefined}
          onClick={e => { e.preventDefault(); setActiveTab('learners') }}
        >
          🎓 Learners Directory
        </a>
        <a
          href="#add"
          aria-current={activeTab === 'add' ? 'page' : undefined}
          onClick={e => { e.preventDefault(); setActiveTab('add') }}
        >
          ➕ Register Learner
        </a>
        <a
          href="#sync"
          aria-current={activeTab === 'sync' ? 'page' : undefined}
          onClick={e => { e.preventDefault(); setActiveTab('sync') }}
        >
          🔄 Canvas LMS Sync
        </a>
        <a
          href="#audit"
          aria-current={activeTab === 'audit' ? 'page' : undefined}
          onClick={e => { e.preventDefault(); setActiveTab('audit') }}
        >
          🛡️ Audit Trail
        </a>
      </nav>

      <main id="main">
        {/* TAB 1: LEARNERS DIRECTORY */}
        {activeTab === 'learners' && (
          <section id="learners">
            <div className="hero">
              <div>
                <p className="eyebrow">St Eric Registrar Desk</p>
                <h2>Official Learner Records</h2>
                <p>
                  Official student identity is governed and recorded here. Changes made in this portal are automatically audited and formatted for synchronization with Canvas LMS.
                </p>
              </div>
              <button onClick={() => loadStudents(token)} disabled={loadingStudents}>
                {loadingStudents ? 'Refreshing…' : 'Refresh Records'}
              </button>
            </div>

            {dashboardError && <div role="alert" className="alert">{dashboardError}</div>}

            <div style={{ marginTop: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="section-title" style={{ margin: 0 }}>
                <div>
                  <p className="eyebrow">Directory</p>
                  <h2>Learners ({filteredStudents.length})</h2>
                </div>
              </div>
              <input
                type="text"
                placeholder="Search by name or SIS ID…"
                className="input-text"
                style={{ width: '18rem' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">SIS ID</th>
                    <th scope="col">Legal Name</th>
                    <th scope="col">Preferred Name</th>
                    <th scope="col">Enrollment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id}>
                      <td><code>{s.sis_id}</code></td>
                      <td><strong>{s.legal_last_name}</strong>, {s.legal_first_name}</td>
                      <td>{s.preferred_name || '—'}</td>
                      <td><span className={`status ${s.status}`}>{s.status}</span></td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        {loadingStudents ? 'Loading student records from PostgreSQL…' : 'No learner records found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: REGISTER LEARNER */}
        {activeTab === 'add' && (
          <section id="add">
            <div className="card">
              <p className="eyebrow">Admissions</p>
              <h2>Register New Learner</h2>
              <p style={{ color: '#5d707a', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
                Add a new student to St Eric Secondary School. This generates an audit entry and prepares the learner for Canvas LMS account provisioning.
              </p>

              {addMessage && (
                <div role="alert" className="alert" style={{ borderLeftColor: addMessage.type === 'success' ? '#087e73' : '#c48400', background: addMessage.type === 'success' ? '#e6f6f3' : '#fff4d5' }}>
                  {addMessage.text}
                </div>
              )}

              <form onSubmit={handleAddStudent} style={{ maxWidth: '38rem' }}>
                <div className="form-group">
                  <label htmlFor="sis_id">Student SIS ID (National / School ID)</label>
                  <input
                    id="sis_id"
                    type="text"
                    className="input-text"
                    placeholder="e.g. SEC-2026-004"
                    value={newSisId}
                    onChange={e => setNewSisId(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label htmlFor="first_name">Legal First Name</label>
                    <input
                      id="first_name"
                      type="text"
                      className="input-text"
                      placeholder="e.g. Tendai"
                      value={newFirstName}
                      onChange={e => setNewFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="last_name">Legal Last Name</label>
                    <input
                      id="last_name"
                      type="text"
                      className="input-text"
                      placeholder="e.g. Moyo"
                      value={newLastName}
                      onChange={e => setNewLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="pref_name">Preferred Name (Optional)</label>
                  <input
                    id="pref_name"
                    type="text"
                    className="input-text"
                    placeholder="e.g. Tee"
                    value={newPreferredName}
                    onChange={e => setNewPreferredName(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={addLoading} style={{ marginTop: '1rem' }}>
                  {addLoading ? 'Registering…' : 'Save Learner Record'}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* TAB 3: CANVAS LMS SYNC */}
        {activeTab === 'sync' && (
          <section id="sync">
            <div className="card">
              <p className="eyebrow">Integration Gateway</p>
              <h2>Canvas LMS Integration Status</h2>
              <p style={{ color: '#5d707a', marginTop: '0.4rem', lineHeight: '1.6' }}>
                St Eric Secondary School uses Canvas LMS as the digital classroom (homework, quizzes, syllabus). 
                Official learners registered here are synchronized into Canvas via standard SIS archives.
              </p>

              <div style={{ marginTop: '1.5rem', padding: '1.2rem', background: '#f8faf9', borderRadius: '.5rem', border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>📦 Generate Canvas SIS ZIP</h3>
                <p style={{ color: '#5d707a', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Download a deterministic, compliant <code>users.csv</code> archive of all currently enrolled St Eric learners. You can upload this directly into Canvas Root Admin under <em>SIS Import</em>.
                </p>
                <button onClick={handleDownloadSisZip} className="btn-primary" style={{ display: 'inline-block', width: 'auto' }}>
                  ⬇️ Download Canvas SIS ZIP (st_eric_canvas_users.zip)
                </button>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>🔗 Direct API Connection</h3>
                <p style={{ color: '#5d707a', fontSize: '0.85rem' }}>
                  When ready to connect directly via Canvas REST API, update <code>CANVAS_BASE_URL</code> and <code>CANVAS_ACCESS_TOKEN</code> in your <code>.env</code> file.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <section id="audit">
            <div className="card">
              <p className="eyebrow">Safeguarding & Governance</p>
              <h2>System Audit & Integrity</h2>
              <p style={{ color: '#5d707a', marginTop: '0.4rem', lineHeight: '1.6' }}>
                Every action taken in St Eric Secondary School (learner creation, profile updates, status changes) is recorded in an immutable, append-only <code>audit_events</code> table.
              </p>
              <ul style={{ color: '#334d5c', fontSize: '0.9rem', lineHeight: '1.8', marginTop: '1rem' }}>
                <li>✅ <strong>Optimistic Locking:</strong> Prevents two staff members from accidentally overwriting the same student profile simultaneously.</li>
                <li>✅ <strong>Actor Tracking:</strong> Records which staff member performed each registration.</li>
                <li>✅ <strong>Transactional Outbox:</strong> Guarantees synchronization consistency with Canvas LMS without dual-write data loss.</li>
              </ul>
            </div>
          </section>
        )}
      </main>

      <footer>
        St Eric Secondary School, Norton · Privacy & Safeguarding by Design · Authenticated Session
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

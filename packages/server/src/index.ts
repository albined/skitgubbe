import { Hono } from 'hono'
import { db } from './db'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/api/profiles/:id/login', async (c) => {
  const profileId = c.req.param('id')

  // Extract info from request
  const userAgent = c.req.header('user-agent') || 'Unknown Device'

  // Location extraction logic - prioritize Cloudflare headers
  const cfCountry = c.req.header('cf-ipcountry')
  let location = cfCountry || 'Unknown Location'

  // IP Extraction
  const cfIp = c.req.header('cf-connecting-ip')
  const forwardedFor = c.req.header('x-forwarded-for')
  // Hono doesn't always have easy access to direct connection IP without adapter specifics,
  // so we rely heavily on standard proxy headers since this will likely be behind cloudflare or nginx
  const ip = cfIp || forwardedFor || 'Unknown IP'

  const time = Date.now()

  try {
    const insertLog = db.prepare(`
      INSERT INTO profile_logins (profile_id, time, user_agent, location, ip)
      VALUES (?, ?, ?, ?, ?)
    `)
    insertLog.run(profileId, time, userAgent, location, ip)

    return c.json({ success: true, message: 'Login recorded' })
  } catch (error) {
    console.error('Error recording login:', error)
    return c.json({ success: false, error: 'Failed to record login' }, 500)
  }
})

app.get('/api/profiles/:id/logins', async (c) => {
  const profileId = c.req.param('id')

  try {
    const getLogins = db.prepare(`
      SELECT * FROM profile_logins
      WHERE profile_id = ?
      ORDER BY time DESC
    `)

    const logins = getLogins.all(profileId)
    return c.json({ success: true, logins })
  } catch (error) {
    console.error('Error fetching logins:', error)
    return c.json({ success: false, error: 'Failed to fetch logins' }, 500)
  }
})

export default app

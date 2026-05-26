// GET /api/vapid-public — öffentlicher VAPID-Key vom Server (für Push-Subscribe)

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=300')

  if (req.method !== 'GET') {
    return res.status(405).end(JSON.stringify({ error: 'Method not allowed' }))
  }

  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? '').trim()
  if (!publicKey) {
    return res.status(500).end(JSON.stringify({
      error: 'missing_vapid',
      hint:  'VAPID_PUBLIC_KEY in Vercel setzen',
    }))
  }

  return res.status(200).end(JSON.stringify({ publicKey }))
}

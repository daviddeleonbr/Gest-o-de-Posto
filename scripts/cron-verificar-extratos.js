/**
 * Script de verificação periódica de extratos — roda via PM2
 * Chama /api/cron/verificar-extratos a cada 30 minutos e loga o resultado.
 */

const http = require('http')

const CRON_SECRET = process.env.CRON_SECRET ?? 'cron-interno-gestao'
const HOST        = process.env.APP_HOST ?? 'localhost'
const PORT        = parseInt(process.env.PORT ?? '3000')
const INTERVALO_MS = 30 * 60 * 1000 // 30 minutos

function chamarCron() {
  const ts = new Date().toISOString()
  const body = ''
  const options = {
    hostname: HOST,
    port:     PORT,
    path:     '/api/cron/verificar-extratos',
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-cron-secret':  CRON_SECRET,
    },
  }

  const req = http.request(options, res => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      try {
        const json = JSON.parse(data)
        console.log(`[cron] ${ts} — status ${res.statusCode} — verificadas: ${json.verificadas ?? '?'}, divergentes: ${json.divergentes ?? '?'}`)
      } catch {
        console.log(`[cron] ${ts} — status ${res.statusCode} — resposta inválida`)
      }
    })
  })

  req.on('error', err => {
    console.error(`[cron] ${ts} — erro na requisição: ${err.message}`)
  })

  req.write(body)
  req.end()
}

console.log(`[cron] Iniciando — verificação a cada ${INTERVALO_MS / 60000} minutos`)
chamarCron()
setInterval(chamarCron, INTERVALO_MS)

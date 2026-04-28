/**
 * Cron fiscal — detecta manifestos novos no AUTOSYSTEM e cria tarefas para os gerentes.
 * Roda a cada 1 hora via PM2.
 */

const http = require('http')

const CRON_SECRET  = process.env.CRON_SECRET ?? 'cron-interno-gestao'
const HOST         = process.env.APP_HOST    ?? 'localhost'
const PORT         = parseInt(process.env.PORT ?? '3000')
const INTERVALO_MS = 60 * 60 * 1000 // 1 hora

function chamarCron() {
  const ts = new Date().toISOString()
  const options = {
    hostname: HOST,
    port:     PORT,
    path:     '/api/cron/fiscal-manifestos',
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': 0,
      'x-cron-secret':  CRON_SECRET,
    },
  }

  const req = http.request(options, res => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      try {
        const json = JSON.parse(data)
        console.log(`[cron-fiscal] ${ts} — status ${res.statusCode} — criadas: ${json.criadas ?? '?'}`)
      } catch {
        console.log(`[cron-fiscal] ${ts} — status ${res.statusCode} — resposta inválida`)
      }
    })
  })

  req.on('error', err => {
    console.error(`[cron-fiscal] ${ts} — erro: ${err.message}`)
  })

  req.end()
}

// Executa imediatamente ao iniciar e depois a cada 1 hora
chamarCron()
setInterval(chamarCron, INTERVALO_MS)

/**
 * Cloudflare Worker — Intermediário Dapic para PROVEST
 *
 * Variáveis de ambiente (configurar no Cloudflare Dashboard → Worker → Settings → Variables):
 *   APP_KEY              → chave que o app envia no header X-App-Key  (você escolhe, ex: "provest2025")
 *   ALLOWED_ORIGIN       → https://rfvilela.github.io
 *   DAPIC_EMPRESA        → identificador da empresa no Dapic
 *   DAPIC_TOKEN_INTEG    → token de integração do Dapic
 */

const DAPIC_BASE = 'https://api.dapic.app';

// Cache em memória (dura enquanto o Worker instance estiver vivo — horas/dias)
let _bearerToken = null;
let _bearerExpires = 0;   // timestamp em ms

async function getDapicToken(env) {
  const now = Date.now();
  if (_bearerToken && _bearerExpires > now + 60_000) return _bearerToken;

  const r = await fetch(`${DAPIC_BASE}/autenticacao/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Empresa: env.DAPIC_EMPRESA,
      TokenIntegracao: env.DAPIC_TOKEN_INTEG,
    }),
  });
  if (!r.ok) throw new Error(`Dapic login falhou: HTTP ${r.status}`);
  const data = await r.json();
  if (!data.access_token) throw new Error('Dapic não retornou access_token');

  _bearerToken = data.access_token;
  const expiresIn = parseInt(data.expires_in || '86400', 10);
  _bearerExpires = now + expiresIn * 1000;
  return _bearerToken;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-App-Key, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResp(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim());

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (!allowed.includes(origin)) {
        return new Response('Origin não permitida', { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Só aceita GET
    if (request.method !== 'GET') {
      return jsonResp({ erro: 'Método não suportado' }, 405, origin);
    }

    // Valida origin
    if (!allowed.includes(origin)) {
      return jsonResp({ erro: 'Origin não permitida: ' + origin }, 403, origin);
    }

    // Valida APP_KEY
    const appKey = request.headers.get('X-App-Key') || '';
    if (!appKey || appKey !== env.APP_KEY) {
      return jsonResp({ erro: 'Chave de acesso inválida' }, 401, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname;   // ex: /status  ou  /v1/produtos
    const search = url.search;   // ex: ?Pagina=1&RegistrosPorPagina=200

    // Endpoint de status (health-check do app)
    if (path === '/status') {
      return jsonResp({ ok: true }, 200, origin);
    }

    // Proxy para a Dapic
    let bearer;
    try {
      bearer = await getDapicToken(env);
    } catch (e) {
      return jsonResp({ erro: 'Falha ao autenticar no Dapic: ' + e.message }, 502, origin);
    }

    const dapicUrl = `${DAPIC_BASE}${path}${search}`;
    let dapicResp;
    try {
      dapicResp = await fetch(dapicUrl, {
        headers: {
          'Authorization': `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      return jsonResp({ erro: 'Falha ao contatar Dapic: ' + e.message }, 502, origin);
    }

    // Se token expirou, força renovação e tenta uma vez mais
    if (dapicResp.status === 401) {
      _bearerToken = null;
      try {
        bearer = await getDapicToken(env);
        dapicResp = await fetch(dapicUrl, {
          headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return jsonResp({ erro: 'Falha ao renovar token Dapic' }, 502, origin);
      }
    }

    const body = await dapicResp.text();
    return new Response(body, {
      status: dapicResp.status,
      headers: {
        'Content-Type': dapicResp.headers.get('Content-Type') || 'application/json',
        ...corsHeaders(origin),
      },
    });
  },
};

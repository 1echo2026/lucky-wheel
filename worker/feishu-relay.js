/**
 * 幸运大转盘 · 飞书多维表格同步中转（Cloudflare Worker）
 *
 * 为什么需要它：抽奖页是纯静态站点，不能存放飞书 App Secret，
 * 由这个 Worker 持有密钥并代为写入多维表格。
 *
 * 部署步骤
 * 1. Cloudflare 控制台 → Workers & Pages → 创建 Worker → 把本文件内容整体粘贴进去。
 * 2. 设置 → 变量和机密，添加：
 *      FS_APP_ID       飞书自建应用 App ID
 *      FS_APP_SECRET   飞书自建应用 App Secret（类型选「机密」）
 *      BASE_TOKEN      多维表格 app_token，如 HaTNbmZKEa7g72sSHAXc1U9OnLc
 *      TABLE_ID        数据表 table_id，如 tblzkIklurmrIKvG
 *      SYNC_KEY        自定义口令，后台「飞书同步密钥」填同一个值（可选，留空则不校验）
 * 3. 部署后把 Worker 的访问地址（https://xxx.workers.dev）填到后台「飞书同步地址」。
 *
 * 飞书自建应用需要：开通「多维表格」读写权限（bitable:app），
 * 并把应用添加为该多维表格的协作者（可编辑）。
 */

const FEISHU = 'https://open.feishu.cn/open-apis';

let cachedToken = '';
let cachedExp = 0;

async function tenantToken(env) {
  const now = Date.now();
  if (cachedToken && now < cachedExp) return cachedToken;
  const res = await fetch(FEISHU + '/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: env.FS_APP_ID, app_secret: env.FS_APP_SECRET })
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error('token ' + json.code + ' ' + json.msg);
  cachedToken = json.tenant_access_token;
  cachedExp = now + Math.max(60, (json.expire || 7200) - 180) * 1000;
  return cachedToken;
}

/* 前端记录 → 多维表格字段 */
function toFields(rec) {
  const voidPrize = !rec.prize || /谢谢参与|未中奖|再来一次/.test(rec.prize);
  const label = rec.prize ? (rec.prize + (rec.option || '')) : '未中奖';
  const fields = {
    '期数': String(rec.period || ''),
    '奖池': String(rec.pool || ''),
    '奖项等级': String(rec.prize || '未中奖'),
    '奖品': label,
    '姓名': String(rec.name || ''),
    '基地': String(rec.base || ''),
    '手机号': String(rec.phone || ''),
    '工号': String(rec.gonghao || ''),
    '金额': Number(rec.amount || 0),
    '抽奖时间': String(rec.timeText || ''),
    '是否中奖': voidPrize ? '未中奖' : '中奖'
  };
  if (rec.timeMs) fields['抽奖日期'] = Number(rec.timeMs);
  return fields;
}

function payload(rec) {
  if (rec.period || rec.pool || rec.prize || rec.phone) return rec;
  return rec.record || {};
}

/* 同一手机号 + 同一期数视为同一条，避免重试造成重复 */
async function exists(env, token, phone, period) {
  if (!phone || !period) return false;
  const url = FEISHU + '/bitable/v1/apps/' + env.BASE_TOKEN +
    '/tables/' + env.TABLE_ID + '/records/search?page_size=1';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: '手机号', operator: 'is', value: [String(phone)] },
          { field_name: '期数', operator: 'is', value: [String(period)] }
        ]
      },
      field_names: ['手机号']
    })
  });
  const json = await res.json();
  if (json.code !== 0) return false; /* 查询失败不阻断写入 */
  return !!(json.data && json.data.items && json.data.items.length);
}

async function insert(env, token, list) {
  const url = FEISHU + '/bitable/v1/apps/' + env.BASE_TOKEN +
    '/tables/' + env.TABLE_ID + '/records/batch_create';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ records: list.map(function (f) { return { fields: f }; }) })
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error('insert ' + json.code + ' ' + json.msg);
  return (json.data && json.data.records && json.data.records.length) || list.length;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function reply(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return reply({ ok: false, error: 'method_not_allowed' }, 405);

    let body;
    try { body = await request.json(); } catch (e) { return reply({ ok: false, error: 'bad_json' }, 400); }
    if (env.SYNC_KEY && body.key !== env.SYNC_KEY) return reply({ ok: false, error: 'forbidden' }, 403);

    /* 连通性测试：只验证应用凭证与表配置，不写数据 */
    if (body.ping) {
      try {
        const token = await tenantToken(env);
        const res = await fetch(FEISHU + '/bitable/v1/apps/' + env.BASE_TOKEN +
          '/tables/' + env.TABLE_ID + '/fields?page_size=1', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const json = await res.json();
        if (json.code !== 0) return reply({ ok: false, error: json.code + ' ' + json.msg }, 200);
        return reply({ ok: true, ping: true, table: env.TABLE_ID });
      } catch (e) {
        return reply({ ok: false, error: String(e.message || e) }, 200);
      }
    }

    const raw = Array.isArray(body.records) ? body.records
      : (Array.isArray(body) ? body : (body.record ? [body.record] : [body]));
    const list = raw.map(payload).filter(function (r) { return r && r.phone; });
    if (!list.length) return reply({ ok: false, error: 'empty' }, 400);
    if (list.length > 1000) return reply({ ok: false, error: 'too_many' }, 400);

    try {
      const token = await tenantToken(env);

      /* 单条写入先按「手机号 + 期数」去重，避免网络重试造成重复行 */
      if (list.length === 1) {
        if (await exists(env, token, list[0].phone, list[0].period)) {
          return reply({ ok: true, inserted: 0, skipped: 1 });
        }
      }

      const fields = list.map(toFields);
      let inserted = 0;
      for (let i = 0; i < fields.length; i += 200) {
        inserted += await insert(env, token, fields.slice(i, i + 200));
      }
      return reply({ ok: true, inserted: inserted });
    } catch (e) {
      return reply({ ok: false, error: String(e.message || e) }, 502);
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, dbId, cursor } = req.body;
  if (!token || !dbId) return res.status(400).json({ error: 'Thiếu token hoặc dbId' });

  try {
    const body = {
      sorts: [{ property: 'Ngày', direction: 'descending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const notionRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await notionRes.json();
    if (!notionRes.ok) return res.status(notionRes.status).json({ error: data.message || 'Lỗi Notion', detail: data });

    // parse pages thành transactions
    const txns = (data.results || []).map(page => {
      const p = page.properties || {};
      const getTitle  = f => p[f]?.title?.[0]?.plain_text || '';
      const getSelect = f => p[f]?.select?.name || '';
      const getNumber = f => p[f]?.number || 0;
      const getText   = f => p[f]?.rich_text?.[0]?.plain_text || '';
      const getDate   = f => p[f]?.date?.start || '';

      const loai = getSelect('Loại');
      const vi   = getSelect('Ví');
      return {
        id:       page.id,
        notionId: page.id,
        type:     loai === 'Thu' ? 'income' : 'expense',
        wallet:   vi === 'Tiền mặt' ? 'cash' : 'bank',
        amount:   getNumber('Số tiền'),
        category: getText('Danh mục'),
        note:     getTitle('Name'),
        date:     getDate('Ngày'),
        synced:   true,
        syncing:  false,
      };
    });

    return res.status(200).json({ txns, hasMore: data.has_more, nextCursor: data.next_cursor });
  } catch (err) {
    return res.status(500).json({ error: 'Proxy lỗi: ' + err.message });
  }
}

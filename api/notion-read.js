export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, dbId } = req.body;
  if (!token || !dbId) return res.status(400).json({ error: 'Thiếu token hoặc dbId' });

  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [{ property: 'Ngày', direction: 'descending' }],
        page_size: 100,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Lỗi Notion' });

    const txns = (data.results || []).map(page => {
      const p = page.properties || {};
      return {
        id: page.id,
        notionId: page.id,
        type: p['Loại']?.select?.name === 'Thu' ? 'income' : 'expense',
        wallet: p['Ví']?.select?.name === 'Tiền mặt' ? 'cash' : 'bank',
        amount: p['Số tiền']?.number || 0,
        category: p['Danh mục']?.rich_text?.[0]?.plain_text || '',
        person: p['Người']?.rich_text?.[0]?.plain_text || '',
        note: p['Name']?.title?.[0]?.plain_text || '',
        date: p['Ngày']?.date?.start || '',
        synced: true,
        syncing: false,
      };
    });

    return res.status(200).json({ txns });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

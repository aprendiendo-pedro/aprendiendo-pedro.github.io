export default async function handler(req, res) {
    const allowedOrigins = [
        'https://aprendiendo-pedro.github.io',
        'http://localhost:8000',
        'http://127.0.0.1:8000'
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { endpoint } = req.query;

    if (!endpoint) {
        return res.status(400).json({ error: 'Parameter "endpoint" required' });
    }

    try {
        const response = await fetch(`https://api.github.com/${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Vercel-Proxy'
            }
        });

        const data = await response.json();

        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Error querying GitHub API' });
    }
}
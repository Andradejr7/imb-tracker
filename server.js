const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) {}
  return { partidas: [] };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/data', (req, res) => {
  res.json(loadData());
});

app.post('/api/data', (req, res) => {
  try {
    saveData(req.body);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Rota que envia dados para a Hostinger (servidor→servidor, sem CORS)
app.post('/api/sync-to-hostinger', async (req, res) => {
  try {
    const dados = loadData();
    const SYNC_KEY = process.env.SYNC_KEY || 'imb2024';
    const HOSTINGER_URL = process.env.HOSTINGER_URL || 'https://imbteam.site';

    const response = await axios.post(`${HOSTINGER_URL}/api/sync`, {
      senha: SYNC_KEY,
      dados
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    res.json({ success: true, partidas: response.data.partidas });
  } catch(e) {
    const msg = e.response?.data?.error || e.message;
    res.status(500).json({ error: msg });
  }
});

// Rota que recebe sync
app.post('/api/sync', (req, res) => {
  const { senha, dados } = req.body;
  const SYNC_KEY = process.env.SYNC_KEY || 'imb2024';
  if (senha !== SYNC_KEY) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  try {
    saveData(dados);
    res.json({ success: true, partidas: dados.partidas?.length || 0 });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/matches/:player', async (req, res) => {
  try {
    const { player } = req.params;
    const url = `https://api.tracker.gg/api/v2/r6siege/standard/matches/psn/${encodeURIComponent(player)}?gamemode=pvp_ranked`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://r6.tracker.network/',
        'Origin': 'https://r6.tracker.network',
        'Cookie': process.env.TRN_COOKIES || '',
      }
    });
    res.json(response.data);
  } catch(e) {
    const status = e.response?.status || 500;
    res.status(status).json({ error: e.response?.data || e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'online' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`IMB Tracker rodando em http://0.0.0.0:${PORT}`);
});
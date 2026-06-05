#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GIPHY_API_KEY || 'Ei3iNGXxdCwjwyxwvSaLq7BgNaOLPFEh';
const GIFS_PER_ITEM = 5;
const SEARCH_MAP = {
    'rose':'rose flower','teddy':'teddy bear cute','ring':'diamond ring',
    'crown':'crown king queen','chocolate':'chocolate candy','star':'star gold sparkle',
    'heart':'heart love red','trophy':'trophy cup winner','fire':'fire flame','rocket':'rocket launch',
};
const GIFS_DIR = path.join(__dirname, '..', 'gifs');

function fetch(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : require('http');
        client.get(url, { headers: { 'User-Agent': 'Bot/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
                return fetch(res.headers.location).then(resolve).catch(reject);
            const chunks = []; res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    console.log('🎬 Downloading GIFs from Giphy...');
    if (!fs.existsSync(GIFS_DIR)) fs.mkdirSync(GIFS_DIR, { recursive: true });
    for (const [dir, query] of Object.entries(SEARCH_MAP)) {
        const itemDir = path.join(GIFS_DIR, dir);
        if (!fs.existsSync(itemDir)) fs.mkdirSync(itemDir, { recursive: true });
        const existing = fs.readdirSync(itemDir).filter(f => f.endsWith('.gif'));
        if (existing.length >= GIFS_PER_ITEM) { console.log(`✅ ${dir}/ — ${existing.length} GIFs`); continue; }
        console.log(`📥 ${dir}/ — "${query}"...`);
        try {
            const data = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}&limit=${GIFS_PER_ITEM}&rating=g`);
            const json = JSON.parse(data.toString());
            if (!json.data?.length) { console.log(`  ⚠ No results`); continue; }
            let dl = 0;
            for (let i = 0; i < json.data.length && dl < GIFS_PER_ITEM; i++) {
                const url = json.data[i].images?.fixed_height_small?.url || json.data[i].images?.downsized?.url;
                if (!url) continue;
                try {
                    const gif = await fetch(url);
                    if (gif.length < 1000) continue;
                    fs.writeFileSync(path.join(itemDir, `${dl}.gif`), gif);
                    console.log(`  ✅ ${dl}.gif (${(gif.length/1024).toFixed(1)}KB)`);
                    dl++;
                } catch (e) { console.log(`  ❌ ${e.message}`); }
            }
        } catch (e) { console.log(`  ❌ ${e.message}`); }
    }
    console.log('🎉 Done!');
}
main().catch(e => { console.error(e.message); process.exit(0); });

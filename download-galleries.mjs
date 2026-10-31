import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const galleries = [
  {
    name: 'costumes',
    url: 'https://ai-costume-gallery.pages.dev/',
    out: path.resolve('assets/costumes'),
  },
  {
    name: 'poses',
    url: 'https://ai-pose-gallery.pages.dev/',
    out: path.resolve('assets/poses'),
  },
];

const imagePath = value =>
  typeof value === 'string' && /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(value);

function collectImages(value, result = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectImages(item, result);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectImages(item, result);
  } else if (imagePath(value)) {
    result.add(value);
  }
  return result;
}

function extractData(html) {
  const candidates = [...html.matchAll(/(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(\[[\s\S]*?\]);/g)];
  const parsed = [];
  for (const match of candidates) {
    try {
      const value = JSON.parse(match[1]);
      if (Array.isArray(value) && value.some(item => collectImages(item).size)) parsed.push(value);
    } catch {
      // Ignore les tableaux JavaScript qui ne sont pas des données JSON.
    }
  }
  parsed.sort((a, b) => [...collectImages(b)].length - [...collectImages(a)].length);
  if (!parsed.length) throw new Error('Impossible de trouver les données de la galerie.');
  return parsed[0];
}

async function downloadGallery(gallery) {
  console.log(`\n[${gallery.name}] Lecture de ${gallery.url}`);
  const response = await fetch(gallery.url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = extractData(await response.text());
  const images = [...collectImages(data)];
  console.log(`[${gallery.name}] ${images.length} images référencées`);

  let done = 0;
  for (const relative of images) {
    const clean = relative.split(/[?#]/)[0].replace(/^\/+/, '');
    const target = path.join(gallery.out, clean);
    const targetRoot = path.resolve(gallery.out) + path.sep;
    if (!path.resolve(target).startsWith(targetRoot)) throw new Error(`Chemin invalide: ${relative}`);
    await mkdir(path.dirname(target), { recursive: true });
    if (process.env.FORCE_DOWNLOAD !== '1') {
      try {
        const existing = await stat(target);
        if (existing.isFile() && existing.size > 0) {
          done++;
          continue;
        }
      } catch {
        // Le fichier n'existe pas encore.
      }
    }
    const image = await fetch(new URL(relative, gallery.url));
    if (!image.ok) {
      console.warn(`  échec ${relative} (HTTP ${image.status})`);
      continue;
    }
    await writeFile(target, Buffer.from(await image.arrayBuffer()));
    done++;
    if (done % 25 === 0 || done === images.length) console.log(`  ${done}/${images.length}`);
  }
  console.log(`[${gallery.name}] Terminé: ${done}/${images.length}`);
  return data.map((item, index) => ({
    id: item.id || `${gallery.name}-${index + 1}`,
    title: item['衣装名'] || item['ポーズ名'] || item['名前'] || item.id || `${gallery.name} ${index + 1}`,
    category: item['分類'] || item['カテゴリ'] || item['系統'] || '',
    group: item['系統'] || '',
    angle: item['アングル'] || '',
    images: [...collectImages(item)].map(relative =>
      `assets/${gallery.name}/${relative.split(/[?#]/)[0].replace(/^\/+/, '')}`
    ),
  }));
}

const manifest = {};
for (const gallery of galleries) {
  try {
    manifest[gallery.name] = await downloadGallery(gallery);
  } catch (error) {
    console.error(`[${gallery.name}] ${error.message}`);
    process.exitCode = 1;
  }
}
if (Object.keys(manifest).length) {
  await writeFile('gallery-data.json', JSON.stringify(manifest, null, 2));
  console.log('\nManifest créé: gallery-data.json');
}

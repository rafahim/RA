import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'assets', 'projects');
const metaPath = path.join(outputDir, 'capture-meta.json');
const projects = [
  { id: 'sites-bd', name: 'SITES.BD', url: 'https://sites.bd/' },
  { id: 'elite-global', name: 'Elite Global', url: 'https://eliteglobalstore.sites.bd/' },
  { id: 'assignment-cover', name: 'Assignment Cover', url: 'https://sifaatsakib.sites.bd/' },
  { id: 'office-global-skill-lab', name: 'Office by Global Skill Lab', url: 'https://office.globalskilllab.com/' },
  { id: 'wishly', name: 'Wishly', url: 'https://wishly.rafahim.com/' },
  { id: 'karim-properties', name: 'Karim Properties Development', url: 'https://karimpropertiesbd.com/' },
  { id: 'vero-mart-bd', name: 'Vero Mart BD', url: 'https://veromartbd.com/' },
  { id: 'toto-company', name: 'TOTO COMPANY', url: 'https://totocompany.sites.bd/' },
  { id: 'emirates-aluminium-shutter', name: 'Emirates Aluminium Shutter', url: 'https://emiratesaluminiumshutter.com/' },
  { id: 'graftex-bd', name: 'Graftex BD', url: 'https://graftexbd.com/' }
];

await fs.mkdir(outputDir, { recursive: true });
let oldMeta = { projects: {} };
try { oldMeta = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch { /* First run */ }
const meta = { lastRunAt: new Date().toISOString(), schedule: 'daily', projects: {} };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  for (const project of projects) {
    const file = path.join(outputDir, `${project.id}.jpg`);
    const previous = oldMeta.projects?.[project.id] ?? {};
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      colorScheme: 'light'
    });
    try {
      page.setDefaultNavigationTimeout(45000);
      page.setDefaultTimeout(12000);
      const response = await page.goto(project.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = response?.status() ?? null;
      if (status !== null && status >= 400) throw new Error(`Project returned HTTP ${status}; previous image will be kept`);
      await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
      await page.waitForTimeout(2200);
      await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: 78,
        fullPage: false,
        animations: 'disabled',
        caret: 'hide'
      });
      meta.projects[project.id] = {
        name: project.name,
        url: project.url,
        status: status && status < 400 ? 'captured' : 'captured-with-http-warning',
        httpStatus: status,
        capturedAt: new Date().toISOString(),
        file: `assets/projects/${project.id}.jpg`
      };
      console.log(`✓ ${project.name}: screenshot saved${status ? ` (HTTP ${status})` : ''}`);
    } catch (error) {
      const existingImage = await fs.access(file).then(() => true).catch(() => false);
      meta.projects[project.id] = {
        name: project.name,
        url: project.url,
        status: existingImage ? 'stale-last-success' : 'pending-first-success',
        httpStatus: previous.httpStatus ?? null,
        capturedAt: previous.capturedAt ?? null,
        file: `assets/projects/${project.id}.jpg`,
        note: String(error?.message ?? error).slice(0, 240)
      };
      console.warn(`! ${project.name}: capture failed; ${existingImage ? 'kept last successful screenshot' : 'will use the designed fallback'} — ${String(error?.message ?? error).slice(0, 140)}`);
    } finally {
      await page.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
}

await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
const captured = Object.values(meta.projects).filter(item => item.status.startsWith('captured')).length;
console.log(`Finished: ${captured}/${projects.length} project screenshots captured in this run.`);

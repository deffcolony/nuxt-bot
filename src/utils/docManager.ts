import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { appData } from './vars';

const execAsync = promisify(exec);

// --- CONFIGURATION ---
const NUXT_REPO = 'https://github.com/nuxt/nuxt.git';
const DOCS_ROOT = path.join(appData, 'nuxt-docs'); 
const SEARCH_ROOT = path.join(DOCS_ROOT, 'docs'); // We strictly search inside /docs/ folder
const PUBLIC_URL_BASE = 'https://nuxt.com/docs/4.x'; // Nuxt 4 (main branch)

export interface DocResult {
    title: string;
    url: string;
    snippet: string;
    score: number;
}

// --- GIT SYNCING (Cross-Platform) ---
export async function syncDocs() {
    console.log('📚 [Docs] Checking documentation status...');
    
    // Check if .git folder exists
    const isRepo = await fs.stat(path.join(DOCS_ROOT, '.git')).then(() => true).catch(() => false);

    if (isRepo) {
        console.log('📚 [Docs] Pulling latest changes...');
        await execAsync('git pull', { cwd: DOCS_ROOT });
    } else {
        console.log('📚 [Docs] Cloning fresh repository...');
        
        // Cleanup old folder if exists
        await fs.rm(DOCS_ROOT, { recursive: true, force: true });
        await fs.mkdir(DOCS_ROOT, { recursive: true });
        
        // Sparse clone to save space/time (only gets history for docs folder)
        // This command works on both Windows Git Bash and Linux
        await execAsync(`git clone --depth 1 --filter=blob:none --sparse ${NUXT_REPO} .`, { cwd: DOCS_ROOT });
        await execAsync(`git sparse-checkout set docs`, { cwd: DOCS_ROOT });
    }
    console.log('✅ [Docs] Sync complete.');
}

// --- SEARCH LOGIC (Node.js Native) ---

// Helper: Recursively find all .md files
async function getMarkdownFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await getMarkdownFiles(fullPath));
        } else if (entry.name.endsWith('.md')) {
            results.push(fullPath);
        }
    }
    return results;
}

export async function searchDocs(query: string): Promise<DocResult[]> {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    const files = await getMarkdownFiles(SEARCH_ROOT);
    const results: DocResult[] = [];

    for (const filePath of files) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lowerContent = content.toLowerCase();

            // 1. Basic Content Match
            if (!lowerContent.includes(lowerQuery)) continue;

            // 2. Extract Title (Try Frontmatter first, then Filename)
            // Regex looks for "title: 'Something'" in YAML header
            const titleMatch = content.match(/^title:\s*['"]?([^'"]+)['"]?/m);
            let title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');

            // Cleanup filename title (e.g., "07.routing" -> "Routing")
            if (!titleMatch) {
                title = title.replace(/^\d+\./, '') // remove "07."
                             .split(/[-_]/)         // split by - or _
                             .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                             .join(' ');
            }

            // 3. Generate Snippet (Context around the match)
            const matchIndex = lowerContent.indexOf(lowerQuery);
            // Grab 50 chars before and 80 chars after
            const start = Math.max(0, matchIndex - 50);
            const end = Math.min(content.length, matchIndex + 80);
            let snippet = content.substring(start, end)
                .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
                .replace(/[*#`[\]()]/g, '') // Strip basic markdown syntax for cleanliness
                .trim();
            
            // 4. Generate URL
            // Get path relative to /docs/ folder
            const relativePath = path.relative(SEARCH_ROOT, filePath);
            
            // Split by OS separator (\ on Windows, / on Linux)
            const segments = relativePath.split(path.sep);

            const urlSegments = segments.map(segment => {
                // Remove ordering numbers (1.folder -> folder) and .md extension
                return segment.replace(/^\d+\./, '').replace(/\.md$/, '');
            });

            // If file is index.md, pop the last segment so it links to the folder
            if (urlSegments[urlSegments.length - 1] === 'index') {
                urlSegments.pop();
            }

            // JOIN WITH '/' ALWAYS (Web URLs must use forward slash)
            const cleanUrl = `${PUBLIC_URL_BASE}/${urlSegments.join('/')}`;

            // 5. Scoring (Rank results)
            let score = 0;
            if (title.toLowerCase().includes(lowerQuery)) score += 10; // Title match is best
            if (cleanUrl.toLowerCase().includes(lowerQuery)) score += 5; // URL match is good
            score += 1; // Content match base score

            results.push({ title, url: cleanUrl, snippet: `...${snippet}...`, score });

        } catch (error) {
            console.error(`Error reading ${filePath}`, error);
        }
    }

    // Sort by score (descending), take top 15
    return results.sort((a, b) => b.score - a.score).slice(0, 15);
}
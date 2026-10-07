// A loopback-only bridge for deploying compiled static files through Vercel MCP.
// No credentials or source artwork are read or exposed.
import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

async function collect(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await collect(join(directory, entry.name), `${file}/`));
    else files.push({ file, data: (await readFile(join(directory, entry.name))).toString('base64'), encoding: 'base64' });
  }
  return files;
}
createServer(async (request, response) => {
  if (request.url !== '/deployment.json') { response.writeHead(404).end(); return; }
  try {
    const files = await collect('dist');
    const config = JSON.parse(await readFile('vercel.json', 'utf8'));
    delete config.buildCommand;
    delete config.outputDirectory;
    files.push({ file: 'vercel.json', data: JSON.stringify(config), encoding: 'utf-8' });
    const payload = files.map(file => {
      const bytes = Buffer.from(file.data, file.encoding === 'base64' ? 'base64' : 'utf8');
      return { ...file, sha: createHash('sha1').update(bytes).digest('hex'), size: bytes.length, data: bytes.toString('base64'), encoding: 'base64' };
    });
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
  } catch { response.writeHead(500).end(); }
}).listen(4174, '127.0.0.1', () => console.log('Static deployment payload at http://127.0.0.1:4174/deployment.json'));

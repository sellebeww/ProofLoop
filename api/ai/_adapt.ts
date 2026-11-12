// Adaptor tipis req/res gaya Node untuk handler AI. © 2026 Vassel Goleyu.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AiResponse } from '../../server/ai-handler.ts';

type Handler = (method: string, path: string, body: string, env: NodeJS.ProcessEnv) => Promise<AiResponse>;

export function adapt(path: string, h: Handler) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) { size += (c as Buffer).length; if (size > 200_000) break; chunks.push(c as Buffer); }
    const out = await h(req.method ?? 'GET', path, Buffer.concat(chunks).toString('utf8'), process.env);
    res.statusCode = out.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(out.json));
  };
}

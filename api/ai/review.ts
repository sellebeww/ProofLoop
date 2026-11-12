// Fungsi Vercel: tinjauan AI opsional. © 2026 Vassel Goleyu.
import { handleAi } from '../../server/ai-handler.ts';
import { adapt } from './_adapt.ts';

export default adapt('/api/ai/review', handleAi);

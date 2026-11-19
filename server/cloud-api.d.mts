import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleGoldfolioApi(request: IncomingMessage, response: ServerResponse): Promise<boolean>;

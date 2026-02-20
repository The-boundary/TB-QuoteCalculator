import type { Request, Response } from 'express';
import { logger } from './logger.js';

/** Send a 500 error response and log the error. */
export function sendServerError(res: Response, err: unknown, context: string): void {
  logger.error({ err }, context);
  res.status(500).json({
    error: { message: err instanceof Error ? err.message : 'Internal error' },
  });
}

/** Send a 404 error response. */
export function sendNotFound(res: Response, entity: string): void {
  res.status(404).json({ error: { message: `${entity} not found` } });
}

/** Error with an HTTP status code for use inside transactions. */
export interface HttpError extends Error {
  statusCode?: number;
}

/** Create an error with an associated HTTP status code. */
export function httpError(message: string, statusCode: number): HttpError {
  const err = new Error(message) as HttpError;
  err.statusCode = statusCode;
  return err;
}

/**
 * Handle HttpError from transactions: if the error has a 4xx statusCode,
 * send it as the response. Otherwise fall back to sendServerError.
 */
export function handleRouteError(res: Response, err: unknown, fallbackMessage: string): void {
  const httpErr = err as HttpError;
  if (httpErr.statusCode && httpErr.statusCode >= 400 && httpErr.statusCode < 500) {
    res.status(httpErr.statusCode).json({ error: { message: httpErr.message } });
    return;
  }
  sendServerError(res, err, fallbackMessage);
}

/** Resolve created_by: returns null in dev bypass mode, userId otherwise. */
export function resolveCreatedBy(userId: string): string | null {
  if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true') {
    return null;
  }
  return userId;
}

/** Return 403 if the user is not an admin. Returns true if blocked, false if allowed. */
export function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user?.appAccess?.is_admin) {
    res.status(403).json({ error: { message: 'Admin access required' } });
    return true;
  }
  return false;
}

/** Group an array of rows by a key field into a Map. */
export function groupByKey<T extends Record<string, unknown>>(
  rows: T[],
  key: string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = row[key] as string;
    const existing = map.get(k);
    if (existing) existing.push(row);
    else map.set(k, [row]);
  }
  return map;
}

import type { Response } from 'express';
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

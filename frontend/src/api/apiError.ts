export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
  traceId: string;
  httpStatus: number;
}

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

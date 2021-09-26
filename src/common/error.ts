export class CustomError extends Error {
  constructor(message: string, options: any = {}) {
    super(message);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }

    this.name = options.name || 'CustomError';
  }
}

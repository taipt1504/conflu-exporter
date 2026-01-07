export class ConfluenceExporterError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
    }
  }
}

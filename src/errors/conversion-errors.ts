import { ConfluenceExporterError } from './base-error.js'

export class ConversionError extends ConfluenceExporterError {
  public readonly sourceFormat: string
  public readonly targetFormat: string

  constructor(
    message: string,
    sourceFormat: string,
    targetFormat: string,
    details?: unknown,
  ) {
    super(message, 'CONVERSION_ERROR', details)
    this.sourceFormat = sourceFormat
    this.targetFormat = targetFormat
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      sourceFormat: this.sourceFormat,
      targetFormat: this.targetFormat,
    }
  }
}

export class MarkdownConversionError extends ConfluenceExporterError {
  constructor(message: string = 'Failed to convert to Markdown', details?: unknown) {
    super(message, 'MARKDOWN_CONVERSION_ERROR', details)
  }
}

export class PdfConversionError extends ConfluenceExporterError {
  constructor(message: string = 'Failed to convert to PDF', details?: unknown) {
    super(message, 'PDF_CONVERSION_ERROR', details)
  }
}

export class DocxConversionError extends ConfluenceExporterError {
  constructor(message: string = 'Failed to convert to DOCX', details?: unknown) {
    super(message, 'DOCX_CONVERSION_ERROR', details)
  }
}

export class HtmlProcessingError extends ConfluenceExporterError {
  constructor(message: string = 'Failed to process HTML', details?: unknown) {
    super(message, 'HTML_PROCESSING_ERROR', details)
  }
}

export class AttachmentDownloadError extends ConfluenceExporterError {
  public readonly attachmentUrl: string

  constructor(
    message: string = 'Failed to download attachment',
    attachmentUrl: string,
    details?: unknown,
  ) {
    super(message, 'ATTACHMENT_DOWNLOAD_ERROR', details)
    this.attachmentUrl = attachmentUrl
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      attachmentUrl: this.attachmentUrl,
    }
  }
}

export class FileWriteError extends ConfluenceExporterError {
  public readonly filePath: string

  constructor(message: string = 'Failed to write file', filePath: string, details?: unknown) {
    super(message, 'FILE_WRITE_ERROR', details)
    this.filePath = filePath
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      filePath: this.filePath,
    }
  }
}

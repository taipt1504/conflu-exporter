export { ConfluenceExporterError } from './base-error.js'

export {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
  InvalidResponseError,
} from './api-errors.js'

export {
  ConversionError,
  MarkdownConversionError,
  PdfConversionError,
  DocxConversionError,
  HtmlProcessingError,
  AttachmentDownloadError,
  FileWriteError,
} from './conversion-errors.js'

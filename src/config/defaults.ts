import type {
  Config,
  MarkdownOptions,
  PdfOptions,
  DocxOptions,
  ApiOptions,
} from './config-schema.js'

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = {
  frontmatter: true,
  preserveHtml: false,
  gfm: true,
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  format: 'A4',
  includeHeaderFooter: true,
  margin: {
    top: '20mm',
    bottom: '20mm',
    left: '15mm',
    right: '15mm',
  },
}

export const DEFAULT_DOCX_OPTIONS: DocxOptions = {
  embedImages: true,
  includeMetadata: true,
}

export const DEFAULT_API_OPTIONS: ApiOptions = {
  timeout: 30000,
  retries: 3,
  concurrency: 5,
}

export const DEFAULT_CONFIG: Partial<Config> = {
  format: 'markdown',
  output: './exports',
  includeAttachments: false,
  includeChildren: false,
  flat: false,
  api: DEFAULT_API_OPTIONS,
  conversion: {
    markdown: DEFAULT_MARKDOWN_OPTIONS,
    pdf: DEFAULT_PDF_OPTIONS,
    docx: DEFAULT_DOCX_OPTIONS,
  },
}

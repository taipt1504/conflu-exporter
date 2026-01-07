import { z } from 'zod'

export const MarkdownOptionsSchema = z.object({
  frontmatter: z.boolean().default(true),
  preserveHtml: z.boolean().default(false),
  gfm: z.boolean().default(true),
})

export const PdfOptionsSchema = z.object({
  format: z.enum(['A4', 'Letter']).default('A4'),
  includeHeaderFooter: z.boolean().default(true),
  margin: z
    .object({
      top: z.string().default('20mm'),
      bottom: z.string().default('20mm'),
      left: z.string().default('15mm'),
      right: z.string().default('15mm'),
    })
    .optional(),
})

export const DocxOptionsSchema = z.object({
  embedImages: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
})

export const ApiOptionsSchema = z.object({
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).max(10).default(3),
  concurrency: z.number().min(1).max(20).default(5),
})

export const ConversionOptionsSchema = z.object({
  markdown: MarkdownOptionsSchema.optional(),
  pdf: PdfOptionsSchema.optional(),
  docx: DocxOptionsSchema.optional(),
})

export const ConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  token: z.string().min(1).optional(),
  format: z.enum(['markdown', 'pdf', 'docx']).default('markdown'),
  output: z.string().default('./exports'),
  includeAttachments: z.boolean().default(false),
  includeChildren: z.boolean().default(false),
  flat: z.boolean().default(false),
  api: ApiOptionsSchema.optional(),
  conversion: ConversionOptionsSchema.optional(),
})

export type MarkdownOptions = z.infer<typeof MarkdownOptionsSchema>
export type PdfOptions = z.infer<typeof PdfOptionsSchema>
export type DocxOptions = z.infer<typeof DocxOptionsSchema>
export type ApiOptions = z.infer<typeof ApiOptionsSchema>
export type ConversionOptions = z.infer<typeof ConversionOptionsSchema>
export type Config = z.infer<typeof ConfigSchema>

export type PartialConfig = Partial<Config>

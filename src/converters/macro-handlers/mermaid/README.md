# Mermaid Macro Handler Architecture

This module uses **Strategy Pattern + Registry Pattern** to handle different Mermaid macro variants in a scalable and maintainable way.

## Architecture Overview

```
┌─────────────────────────────────────┐
│   MermaidProcessor (Orchestrator)   │
│  - Coordinates all handlers         │
│  - Manages attachment cache         │
│  - Processes storage content        │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│    MacroHandlerRegistry             │
│  - Routes macros to handlers        │
│  - Supports multiple handlers       │
└─────────────────┬───────────────────┘
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│BuiltinMermaid│    │PluginMermaid     │
│Handler       │    │Handler           │
│- mermaid     │    │- mermaid-cloud   │
│              │    │- mermaid-macro   │
└──────────────┘    └──────────────────┘
       │                     │
       └──────────┬──────────┘
                  ▼
       ┌─────────────────────┐
       │BaseMermaidHandler   │
       │- Common logic       │
       │- Placeholder system │
       └─────────────────────┘
```

## Adding a New Mermaid Variant

### Step 1: Add to Configuration

Edit `mermaid-variants.config.ts`:

```typescript
export const MERMAID_VARIANTS: MermaidVariantConfig[] = [
  // ... existing variants ...

  // Add your new variant here:
  {
    macroName: 'mermaid-pro',               // Macro name in Confluence
    type: 'plugin',                         // 'builtin' or 'plugin'
    description: 'Mermaid Pro plugin',
    usesPlainTextAttachments: true,         // If it uses text/plain without extension
    // OR
    attachmentExtensions: ['.mmd', '.pro'], // If it uses specific file extensions
  },
]
```

That's it! The system will automatically:
- Register the handler
- Support the new macro type
- Download the correct attachments
- Convert to markdown

### Step 2: Custom Handler (Optional)

If the new variant needs special processing, create a custom handler:

```typescript
// src/converters/macro-handlers/mermaid/mermaid-pro-handler.ts
import { BaseMermaidHandler } from './base-mermaid-handler.js'
import { ParsedMacro } from '../../macro-parser.js'
import { MacroConversionContext } from '../base-macro-handler.js'

export class MermaidProHandler extends BaseMermaidHandler {
  getMacroName(): string {
    return 'mermaid-pro'
  }

  protected async extractDiagramSource(
    macro: ParsedMacro,
    context: MacroConversionContext,
  ): Promise<string | null> {
    // Your custom extraction logic here
    const filename = this.macroParser.getMacroParameter(macro, 'diagram-file')
    const cachedContent = context.attachmentCache.get(filename)
    return cachedContent?.trim() || null
  }
}
```

Then register it in `MermaidProcessor`:

```typescript
// In mermaid-processor.ts setupHandlers()
const proHandler = new MermaidProHandler(this.macroParser)
this.registry.register(proHandler)
```

## Supported Variants

Currently supported variants (defined in `mermaid-variants.config.ts`):

| Macro Name      | Type    | Storage Format                    |
|-----------------|---------|-----------------------------------|
| `mermaid`       | builtin | Plain text body or .mmd files     |
| `mermaid-cloud` | plugin  | text/plain attachment (no ext)    |
| `mermaid-macro` | plugin  | text/plain attachment (no ext)    |

## Architecture Benefits

1. **Easy to Extend**: Add new variants by editing config file only
2. **Maintainable**: Clear separation of concerns, each handler has single responsibility
3. **Testable**: Each handler can be tested independently
4. **Scalable**: Registry pattern allows unlimited variants
5. **Type-Safe**: Full TypeScript support with interfaces
6. **No Debug Hell**: Automatic routing eliminates need for manual debugging

## Handler Lifecycle

```
1. MermaidProcessor.process(storageContent)
   │
   ├─> Find all mermaid macros (using config)
   │
   ├─> For each macro:
   │   │
   │   ├─> Registry.findHandler(macro)
   │   │   │
   │   │   └─> Returns appropriate handler
   │   │
   │   ├─> Handler.convert(macro, context)
   │   │   │
   │   │   ├─> extractDiagramSource()
   │   │   │
   │   │   └─> createPlaceholder()
   │   │
   │   └─> Replace macro XML with placeholder
   │
   └─> Return processed content

2. Later: MermaidProcessor.replacePlaceholders(markdown)
   │
   └─> Replace all placeholders with ```mermaid code blocks
```

## Example: Adding DrawIO Support

To add support for DrawIO diagrams, you would:

1. Create `drawio-variants.config.ts` similar to mermaid config
2. Create `BaseDrawioHandler` extending base interface
3. Create `DrawioProcessor` similar to MermaidProcessor
4. Register in main processor orchestrator

The same pattern can be applied to any macro type!

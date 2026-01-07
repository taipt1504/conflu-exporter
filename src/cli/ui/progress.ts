import cliProgress from 'cli-progress'
import chalk from 'chalk'

export interface ProgressBarOptions {
  total: number
  label?: string
}

export class ProgressBar {
  private bar: cliProgress.SingleBar | null = null
  private total: number
  private current: number = 0
  private label: string

  constructor(options: ProgressBarOptions) {
    this.total = options.total
    this.label = options.label || 'Progress'
  }

  start(): void {
    this.bar = new cliProgress.SingleBar(
      {
        format: `${chalk.cyan(this.label)} [{bar}] {percentage}% | {value}/{total} | {eta_formatted} remaining`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic,
    )

    this.bar.start(this.total, 0)
  }

  increment(value: number = 1): void {
    if (!this.bar) return
    this.current += value
    this.bar.update(this.current)
  }

  update(value: number): void {
    if (!this.bar) return
    this.current = value
    this.bar.update(this.current)
  }

  stop(): void {
    if (!this.bar) return
    this.bar.stop()
    this.bar = null
  }

  setTotal(total: number): void {
    this.total = total
    if (this.bar) {
      this.bar.setTotal(total)
    }
  }
}

export function createProgressBar(options: ProgressBarOptions): ProgressBar {
  return new ProgressBar(options)
}

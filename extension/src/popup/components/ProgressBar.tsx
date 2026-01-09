/**
 * Progress bar with status display
 */
import React from 'react'

interface ProgressBarProps {
  current: number
  total: number
  status: string
  percentage: number
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  status,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-700">
        <span>{status}</span>
        <span className="font-medium">{percentage}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

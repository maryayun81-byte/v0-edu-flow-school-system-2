"use client"

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Plus } from 'lucide-react'
import 'katex/dist/katex.min.css'
import { InlineMath, BlockMath } from 'react-katex'

interface EquationEditorProps {
  value: string
  onChange: (value: string) => void
  mode?: 'inline' | 'block'
}

export default function EquationEditor({ value, onChange, mode = 'block' }: EquationEditorProps) {
  const [showPreview, setShowPreview] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (newValue: string) => {
    onChange(newValue)
    setError(null)
  }

  const insertSymbol = (symbol: string) => {
    onChange(value + symbol)
  }

  const commonSymbols = [
    { label: 'Fraction', latex: '\\frac{a}{b}' },
    { label: 'Square Root', latex: '\\sqrt{x}' },
    { label: 'Power', latex: 'x^{2}' },
    { label: 'Subscript', latex: 'x_{i}' },
    { label: 'Sum', latex: '\\sum_{i=1}^{n}' },
    { label: 'Integral', latex: '\\int_{a}^{b}' },
    { label: 'Limit', latex: '\\lim_{x \\to \\infty}' },
    { label: 'Pi', latex: '\\pi' },
    { label: 'Alpha', latex: '\\alpha' },
    { label: 'Beta', latex: '\\beta' },
    { label: 'Theta', latex: '\\theta' },
    { label: 'Delta', latex: '\\Delta' },
    { label: 'Infinity', latex: '\\infty' },
    { label: 'Plus/Minus', latex: '\\pm' },
    { label: 'Multiply', latex: '\\times' },
    { label: 'Divide', latex: '\\div' },
    { label: 'Not Equal', latex: '\\neq' },
    { label: 'Less/Equal', latex: '\\leq' },
    { label: 'Greater/Equal', latex: '\\geq' },
    { label: 'Approx', latex: '\\approx' },
  ]

  return (
    <div className="space-y-4">
      {/* Input Area */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          LaTeX Equation
        </label>
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Enter LaTeX equation (e.g., x = \frac{-b \pm \sqrt{b^2-4ac}}{2a})"
          rows={4}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Use LaTeX syntax. Example: x^2 + y^2 = r^2
        </p>
      </div>

      {/* Symbol Palette */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Quick Insert
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
          {commonSymbols.map((symbol) => (
            <Button
              key={symbol.label}
              variant="outline"
              size="sm"
              onClick={() => insertSymbol(symbol.latex)}
              className="text-xs h-auto py-2"
              title={symbol.label}
            >
              <InlineMath math={symbol.latex} />
            </Button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Preview</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide' : 'Show'}
          </Button>
        </div>
        
        {showPreview && (
          <Card className="p-6 bg-muted/50 min-h-[100px] flex items-center justify-center">
            {value ? (
              <div className="text-center">
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : (
                  <div className="overflow-x-auto">
                    {mode === 'block' ? (
                      <BlockMath math={value} errorColor="#ef4444" />
                    ) : (
                      <InlineMath math={value} errorColor="#ef4444" />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Equation preview will appear here
              </p>
            )}
          </Card>
        )}
      </div>

      {/* Help */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">LaTeX Quick Reference</summary>
        <div className="mt-2 space-y-1 pl-4">
          <p>• Superscript: x^{'{2}'} → <InlineMath math="x^{2}" /></p>
          <p>• Subscript: x_{'{i}'} → <InlineMath math="x_{i}" /></p>
          <p>• Fraction: \frac{'{a}'}{'{b}'} → <InlineMath math="\frac{a}{b}" /></p>
          <p>• Square root: \sqrt{'{x}'} → <InlineMath math="\sqrt{x}" /></p>
          <p>• Sum: \sum_{'{i=1}'}^{'{n}'} → <InlineMath math="\sum_{i=1}^{n}" /></p>
          <p>• Integral: \int_{'{a}'}^{'{b}'} → <InlineMath math="\int_{a}^{b}" /></p>
        </div>
      </details>
    </div>
  )
}

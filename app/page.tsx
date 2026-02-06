'use client'

import { useState, useCallback } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Mail,
  Copy,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'

// Agent IDs from workflow
const SCANNER_AGENT_ID = '698589a41caa4e686dd66e59'
const EQUALIZER_AGENT_ID = '698589c1a791e6e318b8de57'
const EMAILER_AGENT_ID = '698589e6a791e6e318b8de60'

// TypeScript interfaces from test responses
interface Clause {
  clause_id: number
  text: string
  topic: string
}

interface AnalyzedClause {
  clause_id: number
  original_text: string
  topic: string
  fairness_verdict: 'Fair' | 'Unfair'
  reasoning: string
  rewritten_text: string
  changes_made: string
}

interface EqualizerSummary {
  total_clauses: number
  fair_clauses: number
  unfair_clauses: number
  categories_affected: string[]
}

interface EmailResult {
  email_subject: string
  email_body: string
  tone: string
  key_points: string[]
  closing_recommendation: string
}

export default function Home() {
  // State management
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [contractText, setContractText] = useState('')
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([])
  const [scannedClauses, setScannedClauses] = useState<Clause[]>([])
  const [analyzedClauses, setAnalyzedClauses] = useState<AnalyzedClause[]>([])
  const [equalizerSummary, setEqualizerSummary] = useState<EqualizerSummary | null>(null)
  const [generatedEmail, setGeneratedEmail] = useState<EmailResult | null>(null)

  // UI state
  const [isScanning, setIsScanning] = useState(false)
  const [isEqualizing, setIsEqualizing] = useState(false)
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [expandedClauseId, setExpandedClauseId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setStatusMessage('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage('File size must be under 10MB')
      return
    }

    setIsUploading(true)
    setStatusMessage(`Uploading ${file.name}...`)

    try {
      // Upload PDF to get asset_id for agent processing
      const uploadResult = await uploadFiles(file)

      console.log('Upload result:', uploadResult)

      if (uploadResult.success && uploadResult.asset_ids.length > 0) {
        setUploadedFile(file)
        setUploadedAssetIds(uploadResult.asset_ids)
        setStatusMessage(`File uploaded: ${file.name}`)

        // Also extract some text for display purposes
        const reader = new FileReader()
        reader.onload = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer
          const text = new TextDecoder().decode(arrayBuffer)
          // Extract visible text (basic approach - agent will do proper parsing)
          const basicText = text.replace(/[^\x20-\x7E\n]/g, '').trim()
          setContractText(basicText || `PDF: ${file.name}`)
        }
        reader.readAsArrayBuffer(file)
      } else {
        setStatusMessage('Upload failed. Please try again.')
        console.error('Upload failed:', uploadResult)
      }
    } catch (error) {
      setStatusMessage('Upload error. Please try again.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setStatusMessage('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage('File size must be under 10MB')
      return
    }

    setIsUploading(true)
    setStatusMessage(`Uploading ${file.name}...`)

    try {
      const uploadResult = await uploadFiles(file)

      console.log('Upload result (drag):', uploadResult)

      if (uploadResult.success && uploadResult.asset_ids.length > 0) {
        setUploadedFile(file)
        setUploadedAssetIds(uploadResult.asset_ids)
        setStatusMessage(`File uploaded: ${file.name}`)

        const reader = new FileReader()
        reader.onload = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer
          const text = new TextDecoder().decode(arrayBuffer)
          const basicText = text.replace(/[^\x20-\x7E\n]/g, '').trim()
          setContractText(basicText || `PDF: ${file.name}`)
        }
        reader.readAsArrayBuffer(file)
      } else {
        setStatusMessage('Upload failed. Please try again.')
        console.error('Upload failed:', uploadResult)
      }
    } catch (error) {
      setStatusMessage('Upload error. Please try again.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Step 1: Scan Contract
  const handleScanContract = async () => {
    if (!uploadedFile && !contractText) {
      setStatusMessage('Please upload a contract first')
      return
    }

    setIsScanning(true)
    setStatusMessage('Parsing document...')

    try {
      // Build message for scanner agent
      let message = ''
      if (uploadedAssetIds.length > 0) {
        message = `Please scan the uploaded PDF contract and extract all clauses. Break the document into numbered clauses and identify the topic for each clause (Payment, Termination, IP, Non-compete, Confidentiality, or Other). Ignore headers, footers, and signatures.`
      } else {
        message = `Please scan this contract text and extract clauses with topics: "${contractText.substring(0, 3000)}"`
      }

      const result = await callAIAgent(
        message,
        SCANNER_AGENT_ID,
        uploadedAssetIds.length > 0 ? { assets: uploadedAssetIds } : undefined
      )

      console.log('Scanner Agent Result:', result)

      if (result.success && result.response.status === 'success') {
        const clauses = result.response.result.clauses || []
        setScannedClauses(clauses)
        setStatusMessage(`Document parsed: ${clauses.length} clauses identified`)
      } else {
        const errorMsg = result.error || result.response.message || 'Error scanning contract'
        setStatusMessage(errorMsg)
        console.error('Scanner error:', result)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error scanning contract'
      setStatusMessage(errorMsg)
      console.error('Scanner exception:', error)
    } finally {
      setIsScanning(false)
    }
  }

  // Step 2: Equalize Contract
  const handleEqualizeContract = async () => {
    if (scannedClauses.length === 0) {
      setStatusMessage('Please scan the contract first')
      return
    }

    setIsEqualizing(true)
    setStatusMessage('Analyzing fairness...')

    try {
      const clausesMessage = JSON.stringify(scannedClauses)
      const result = await callAIAgent(
        `Analyze these contract clauses for fairness and apply the mutual fairness principle. Rewrite unfair clauses to balanced industry-standard language: ${clausesMessage}`,
        EQUALIZER_AGENT_ID
      )

      console.log('Equalizer Agent Result:', result)

      if (result.success && result.response.status === 'success') {
        const analyzed = result.response.result.analyzed_clauses || []
        const summary = result.response.result.summary
        setAnalyzedClauses(analyzed)
        setEqualizerSummary(summary)
        setStatusMessage(`Analysis complete: ${summary?.unfair_clauses || 0} of ${summary?.total_clauses || 0} clauses flagged`)
      } else {
        const errorMsg = result.error || result.response.message || 'Error analyzing contract'
        setStatusMessage(errorMsg)
        console.error('Equalizer error:', result)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error analyzing contract'
      setStatusMessage(errorMsg)
      console.error('Equalizer exception:', error)
    } finally {
      setIsEqualizing(false)
    }
  }

  // Step 3: Generate Email
  const handleGenerateEmail = async () => {
    if (analyzedClauses.length === 0) {
      setStatusMessage('Please equalize the contract first')
      return
    }

    setIsGeneratingEmail(true)
    setStatusMessage('Generating email...')

    try {
      const changesDescription = analyzedClauses
        .filter(c => c.fairness_verdict === 'Unfair')
        .map(c => `${c.topic} clause: ${c.changes_made}`)
        .join(', ')

      const result = await callAIAgent(
        `Generate a calm, professional email to request these contract changes. Frame them as "standardization for compliance and mutual protection": ${changesDescription}`,
        EMAILER_AGENT_ID
      )

      console.log('Emailer Agent Result:', result)

      if (result.success && result.response.status === 'success') {
        setGeneratedEmail(result.response.result)
        setShowEmailModal(true)
        setStatusMessage('Email generated successfully')
      } else {
        const errorMsg = result.error || result.response.message || 'Error generating email'
        setStatusMessage(errorMsg)
        console.error('Emailer error:', result)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error generating email'
      setStatusMessage(errorMsg)
      console.error('Emailer exception:', error)
    } finally {
      setIsGeneratingEmail(false)
    }
  }

  // Copy email to clipboard
  const handleCopyEmail = async () => {
    if (generatedEmail) {
      const emailText = `Subject: ${generatedEmail.email_subject}\n\n${generatedEmail.email_body}`
      const success = await copyToClipboard(emailText)
      if (success) {
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      }
    }
  }

  // Download equalized contract
  const handleDownloadContract = () => {
    if (analyzedClauses.length === 0) return

    const equalizedText = analyzedClauses
      .map(c => `${c.topic.toUpperCase()}: ${c.rewritten_text}`)
      .join('\n\n')

    const blob = new Blob([equalizedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'equalized-contract.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Reset all state to start over
  const handleReset = () => {
    setUploadedFile(null)
    setContractText('')
    setUploadedAssetIds([])
    setScannedClauses([])
    setAnalyzedClauses([])
    setEqualizerSummary(null)
    setGeneratedEmail(null)
    setShowEmailModal(false)
    setExpandedClauseId(null)
    setStatusMessage('Ready to analyze a new contract')
    setCopySuccess(false)
  }

  const unfairClauses = analyzedClauses.filter(c => c.fairness_verdict === 'Unfair')

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Top Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-serif font-bold text-[#2D2D2D]">
              The Equalizer
            </h1>

            <div className="flex items-center gap-3">
              {uploadedFile && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  size="sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  New Contract
                </Button>
              )}

              <Button
                type="button"
                className="bg-[#2D2D2D] text-white hover:bg-[#3D3D3D]"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Contract
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />

              <Button
                variant="outline"
                onClick={handleDownloadContract}
                disabled={analyzedClauses.length === 0}
                className="border-[#2D2D2D] text-[#2D2D2D]"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>

              <Button
                variant="outline"
                onClick={handleGenerateEmail}
                disabled={analyzedClauses.length === 0 || isGeneratingEmail}
                className="border-[#2D2D2D] text-[#2D2D2D]"
              >
                {isGeneratingEmail ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Copy Email
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Message Bar */}
      {statusMessage && (
        <div className="bg-blue-50 border-b border-blue-200 px-8 py-3">
          <p className="text-sm text-blue-800">{statusMessage}</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mx-auto px-8 py-8">
        {/* Upload Zone (shown when no file uploaded) */}
        {!uploadedFile && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg text-[#2D2D2D] mb-2">
                Drag and drop your contract here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse • PDF only • Max 10MB
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">
                Don&apos;t have a PDF handy? Try with sample text:
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  const sampleText = `FREELANCE AGREEMENT

PAYMENT TERMS: Contractor agrees to complete all deliverables before receiving any payment. Client may withhold payment indefinitely for any reason deemed appropriate by Client. All invoices are subject to Client approval with no specified timeframe.

TERMINATION: Client reserves the right to terminate this agreement immediately without notice, cause, or compensation to Contractor. Contractor must provide 60 days written notice before termination and complete all pending work without compensation during notice period.

INTELLECTUAL PROPERTY: All work product, concepts, ideas, drafts, and related materials become the exclusive property of Client immediately upon creation, whether or not Client compensates Contractor. Client may use, modify, or sell all work without attribution or additional payment.

NON-COMPETE: Contractor agrees not to work for any competing business or in the same industry for 5 years following contract termination within a 500-mile radius. This applies regardless of compensation received.

CONFIDENTIALITY: Contractor must maintain confidentiality of all Client information indefinitely. Client may freely discuss or share Contractor's work, methods, and proprietary information without restriction.`

                  setContractText(sampleText)
                  setUploadedFile(new File(['sample'], 'sample-contract.txt', { type: 'text/plain' }))
                  setStatusMessage('Sample contract loaded - click "Scan Contract" to begin')
                }}
                className="border-[#2D2D2D] text-[#2D2D2D]"
              >
                <FileText className="w-4 h-4 mr-2" />
                Load Sample Contract
              </Button>
            </div>
          </div>
        )}

        {/* Two-Panel Layout */}
        {uploadedFile && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Panel: Document Viewer (60%) */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-serif">
                      Document Viewer
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      {uploadedFile.name}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {scannedClauses.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500 mb-4">
                        Click "Scan Contract" to extract clauses
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {scannedClauses.map((clause) => {
                        const analyzed = analyzedClauses.find(
                          a => a.clause_id === clause.clause_id
                        )
                        const isUnfair = analyzed?.fairness_verdict === 'Unfair'

                        return (
                          <div
                            key={clause.clause_id}
                            className={`p-4 rounded-lg border-l-4 ${
                              isUnfair
                                ? 'border-l-[#D4634F] bg-red-50'
                                : 'border-l-[#8B9D83] bg-green-50'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#2D2D2D]">
                                  Clause {clause.clause_id}
                                </span>
                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                                  {clause.topic}
                                </span>
                              </div>
                              {analyzed && (
                                <span
                                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                    isUnfair
                                      ? 'bg-[#D4634F] text-white'
                                      : 'bg-[#8B9D83] text-white'
                                  }`}
                                >
                                  {analyzed.fairness_verdict}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-[#2D2D2D] leading-relaxed">
                              {clause.text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Panel: Equalizer Results (40%) */}
            <div className="lg:col-span-2">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="text-xl font-serif">
                    Equalizer Results
                  </CardTitle>
                  {equalizerSummary && (
                    <p className="text-sm text-gray-600 mt-2">
                      {equalizerSummary.unfair_clauses} of{' '}
                      {equalizerSummary.total_clauses} clauses flagged
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {unfairClauses.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500 mb-4">
                        Click "Equalize" to analyze fairness
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {unfairClauses.map((clause) => (
                        <div
                          key={clause.clause_id}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setExpandedClauseId(
                                expandedClauseId === clause.clause_id
                                  ? null
                                  : clause.clause_id
                              )
                            }
                            className="w-full px-4 py-3 bg-white hover:bg-gray-50 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#2D2D2D]">
                                {clause.topic}
                              </span>
                              <span className="px-2 py-1 text-xs rounded-full bg-[#D4634F] text-white">
                                Unfair
                              </span>
                            </div>
                            {expandedClauseId === clause.clause_id ? (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                          </button>

                          {expandedClauseId === clause.clause_id && (
                            <div className="p-4 bg-gray-50 space-y-4">
                              {/* Two-column comparison */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                    Original
                                  </h4>
                                  <p className="text-sm text-[#2D2D2D] leading-relaxed bg-red-100 p-3 rounded">
                                    {clause.original_text}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                    Equalized
                                  </h4>
                                  <p className="text-sm text-[#2D2D2D] leading-relaxed bg-green-100 p-3 rounded">
                                    {clause.rewritten_text}
                                  </p>
                                </div>
                              </div>

                              {/* Reasoning */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                  Reasoning
                                </h4>
                                <p className="text-sm text-[#2D2D2D] leading-relaxed">
                                  {clause.reasoning}
                                </p>
                              </div>

                              {/* Changes Made */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                  Changes Made
                                </h4>
                                <p className="text-sm text-[#2D2D2D] leading-relaxed">
                                  {clause.changes_made}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Action Bar */}
        {uploadedFile && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              onClick={handleScanContract}
              disabled={isScanning || scannedClauses.length > 0}
              className="bg-[#2D2D2D] text-white hover:bg-[#3D3D3D] px-8 py-6 text-lg"
            >
              {isScanning ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              Scan Contract
            </Button>

            <Button
              onClick={handleEqualizeContract}
              disabled={
                scannedClauses.length === 0 ||
                isEqualizing ||
                analyzedClauses.length > 0
              }
              className="bg-[#2D2D2D] text-white hover:bg-[#3D3D3D] px-8 py-6 text-lg"
            >
              {isEqualizing ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              Equalize
            </Button>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && generatedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-8 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-serif font-semibold text-[#2D2D2D]">
                Generated Email
              </h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-1">
                  Subject:
                </p>
                <p className="text-base text-[#2D2D2D]">
                  {generatedEmail.email_subject}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Body:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-[#2D2D2D] whitespace-pre-line leading-relaxed">
                    {generatedEmail.email_body}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Key Points:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {generatedEmail.key_points.map((point, idx) => (
                    <li key={idx} className="text-sm text-[#2D2D2D]">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEmailModal(false)}
                className="border-[#2D2D2D] text-[#2D2D2D]"
              >
                Close
              </Button>
              <Button
                onClick={handleCopyEmail}
                className="bg-[#2D2D2D] text-white hover:bg-[#3D3D3D]"
              >
                {copySuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

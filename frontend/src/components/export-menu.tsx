import { useState } from "react"
import { toast } from "sonner"
import { IconChevronDown, IconDownload, IconFileSpreadsheet, IconFileTypeCsv } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { downloadFile, getErrorMessage } from "@/lib/api"

export type ExportFormat = "xlsx" | "csv"

/**
 * Tombol "Export" dengan pilihan Excel atau CSV. File dibuat di server dengan filter yang sama
 * (`params`), nama file diambil dari header Content-Disposition.
 */
export function ExportMenu({ url, params, fallbackName, disabled }: {
  url: string
  params: Record<string, unknown>
  /** nama file tanpa ekstensi, dipakai bila server tidak mengirim nama file */
  fallbackName: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)

  const run = async (format: ExportFormat) => {
    setBusy(true)
    try {
      await downloadFile(url, { ...params, format }, `${fallbackName}.${format}`)
    } catch (e) {
      toast.error("Export gagal", { description: getErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || busy}>
          {busy ? <Spinner /> : <IconDownload />} Export <IconChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run("xlsx")}><IconFileSpreadsheet /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("csv")}><IconFileTypeCsv /> CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

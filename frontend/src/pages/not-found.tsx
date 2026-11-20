import { Link } from "react-router"
import { IconError404 } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><IconError404 /></EmptyMedia>
          <EmptyTitle>Halaman tidak ditemukan</EmptyTitle>
          <EmptyDescription>Halaman yang Anda cari tidak ada atau sudah dipindahkan.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild><Link to="/">Kembali ke beranda</Link></Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

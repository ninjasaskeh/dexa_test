import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DataTablePagination } from "./data-table-pagination"

afterEach(cleanup)

describe("DataTablePagination", () => {
  it("menampilkan rentang baris dan menonaktifkan tombol di halaman pertama", () => {
    render(<DataTablePagination meta={{ page: 1, limit: 10, total: 23, totalPages: 3 }} onPageChange={() => {}} onLimitChange={() => {}} />)
    expect(screen.getByText(/Menampilkan/).textContent).toBe("Menampilkan 1–10 dari 23 data")
    expect(screen.getByText("Hal. 1 / 3")).toBeTruthy()
    expect((screen.getByLabelText("Sebelumnya") as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Berikutnya") as HTMLButtonElement).disabled).toBe(false)
  })

  it("halaman terakhir menampilkan sisa baris; tombol memanggil onPageChange", () => {
    const onPageChange = vi.fn()
    render(<DataTablePagination meta={{ page: 3, limit: 10, total: 23, totalPages: 3 }} onPageChange={onPageChange} onLimitChange={() => {}} />)
    expect(screen.getByText(/Menampilkan/).textContent).toBe("Menampilkan 21–23 dari 23 data")
    expect((screen.getByLabelText("Berikutnya") as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText("Sebelumnya"))
    fireEvent.click(screen.getByLabelText("Halaman pertama"))
    expect(onPageChange.mock.calls).toEqual([[2], [1]])
  })

  it("data kosong: 0–0 dan tidak ada yang bisa diklik", () => {
    render(<DataTablePagination meta={{ page: 1, limit: 10, total: 0, totalPages: 1 }} onPageChange={() => {}} onLimitChange={() => {}} />)
    expect(screen.getByText(/Menampilkan/).textContent).toBe("Menampilkan 0–0 dari 0 data")
    expect((screen.getByLabelText("Berikutnya") as HTMLButtonElement).disabled).toBe(true)
  })

  it("tidak merender apa pun sebelum data datang", () => {
    const { container } = render(<DataTablePagination onPageChange={() => {}} onLimitChange={() => {}} />)
    expect(container.innerHTML).toBe("")
  })
})

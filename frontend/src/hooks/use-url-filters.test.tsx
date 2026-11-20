import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DATE_RE, PAGE_LIMITS, useSearchInput, useUrlFilters } from "./use-url-filters"

interface Filters { page: number; limit: number; status: string; from?: string; search?: string }
const DEFAULTS: Filters = { page: 1, limit: 10, status: "all", from: undefined, search: undefined }
const RULES = { limit: PAGE_LIMITS, status: ["all", "active", "inactive"], from: DATE_RE }

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  return renderHook(() => {
    const [filters, patch] = useUrlFilters(DEFAULTS, RULES)
    return { filters, patch, search: useLocation().search }
  }, { wrapper })
}

describe("useUrlFilters", () => {
  it("membaca filter dari URL dan mengubah angka jadi number", () => {
    const { result } = setup("/employees?page=3&limit=20&status=active&from=2026-11-01&search=budi")
    expect(result.current.filters).toEqual({ page: 3, limit: 20, status: "active", from: "2026-11-01", search: "budi" })
  })

  it("nilai URL yang tidak valid diabaikan dan memakai default", () => {
    const { result } = setup("/employees?page=abc&limit=999&status=hapus&from=kemarin")
    expect(result.current.filters).toEqual(DEFAULTS)
  })

  it("menulis perubahan ke URL, nilai default tidak ditulis, param lain tetap", () => {
    const { result } = setup("/requests?tab=corrections&page=2")
    act(() => result.current.patch({ status: "inactive", page: 1 }))
    expect(result.current.search).toBe("?tab=corrections&status=inactive")
    act(() => result.current.patch({ status: "all", search: "rina" }))
    expect(result.current.search).toBe("?tab=corrections&search=rina")
    act(() => result.current.patch({ search: undefined }))
    expect(result.current.search).toBe("?tab=corrections")
  })
})

describe("useSearchInput", () => {
  afterEach(() => vi.useRealTimers())

  it("ketikan langsung tampil, URL baru ditulis setelah jeda 400 ms (tanpa spasi di ujung)", () => {
    vi.useFakeTimers()
    const commit = vi.fn()
    const { result } = renderHook(() => useSearchInput(undefined, commit))
    act(() => result.current[1]("bud"))
    act(() => result.current[1]("budi "))
    expect(result.current[0]).toBe("budi ")
    act(() => vi.advanceTimersByTime(399))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(commit).toHaveBeenCalledExactlyOnceWith("budi")
  })

  it("URL berubah dari luar (tombol back) memperbarui teks tanpa menulis ulang URL", () => {
    vi.useFakeTimers()
    const commit = vi.fn()
    const { result, rerender } = renderHook(({ value }) => useSearchInput(value, commit), { initialProps: { value: "budi" as string | undefined } })
    rerender({ value: "rina" })
    expect(result.current[0]).toBe("rina")
    act(() => vi.advanceTimersByTime(1000))
    expect(commit).not.toHaveBeenCalled()
  })
})

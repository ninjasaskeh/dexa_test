import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, downloadFile, getErrorMessage, getFieldErrors } from "./api"

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
const httpError = (status: number, data: unknown) =>
  new AxiosError("fail", "ERR_BAD_RESPONSE", config, null, { status, statusText: "", headers: {}, config, data })

describe("membaca error backend", () => {
  it("pesan dari body, array digabung, fallback bila kosong", () => {
    expect(getErrorMessage(httpError(409, { statusCode: 409, message: "Anda sudah check-in hari ini" }))).toBe("Anda sudah check-in hari ini")
    expect(getErrorMessage(httpError(400, { statusCode: 400, message: ["a", "b"] }))).toBe("a, b")
    expect(getErrorMessage(httpError(500, {}))).toBe("Terjadi kesalahan, coba lagi")
  })

  it("server mati diberi pesan yang jelas", () => {
    expect(getErrorMessage(new AxiosError("Network Error", "ERR_NETWORK", config))).toBe("Tidak dapat terhubung ke server. Pastikan backend berjalan.")
  })

  it("error per field dari ZodValidationPipe", () => {
    expect(getFieldErrors(httpError(400, { statusCode: 400, message: "Validasi gagal", errors: { email: "Format email tidak valid" } }))).toEqual({
      email: "Format email tidak valid",
    })
    expect(getFieldErrors(new Error("x"))).toEqual({})
  })
})

describe("downloadFile", () => {
  const adapter = api.defaults.adapter
  beforeEach(() => {
    localStorage.setItem("dexa.token", "token-uji")
    URL.createObjectURL = vi.fn(() => "blob:uji")
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    api.defaults.adapter = adapter
    localStorage.clear()
  })

  it("memakai nama file dari Content-Disposition dan mengirim token", async () => {
    let auth: unknown
    api.defaults.adapter = async (cfg) => {
      auth = cfg.headers.Authorization
      return { data: new Blob(["a,b"]), status: 200, statusText: "OK", headers: { "content-disposition": 'attachment; filename="rekap_2026-11.csv"' }, config: cfg }
    }
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("rekap_2026-11.csv")
    })
    await downloadFile("/attendance/recap/export", { month: "2026-11" }, "cadangan.csv")
    expect(click).toHaveBeenCalledOnce()
    expect(auth).toBe("Bearer token-uji")
  })

  it("error berbentuk Blob diubah ke JSON agar pesannya terbaca", async () => {
    api.defaults.adapter = async (cfg) => {
      const blob = new Blob([JSON.stringify({ statusCode: 400, message: "Data terlalu banyak untuk diekspor" })], { type: "application/json" })
      throw new AxiosError("fail", "ERR_BAD_REQUEST", cfg, null, { status: 400, statusText: "", headers: {}, config: cfg, data: blob })
    }
    const err = await downloadFile("/attendance/export", {}, "absensi.csv").catch((e: unknown) => e)
    expect(getErrorMessage(err)).toBe("Data terlalu banyak untuk diekspor")
  })
})

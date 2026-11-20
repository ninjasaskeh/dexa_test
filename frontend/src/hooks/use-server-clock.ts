import { useEffect, useState } from "react"

/**
 * Jam yang mengikuti waktu server.
 * `offset` = selisih jam server - jam perangkat (ms), dihitung saat data API diterima.
 */
export function useServerClock(offset = 0) {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return new Date(tick + offset)
}

/** Menit sejak tengah malam dari "HH:mm" */
export const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + (m || 0)
}

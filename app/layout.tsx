import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quote Generator',
  description: 'Generate and manage quotations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-800 antialiased">
        <div className="min-h-screen min-w-0 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-8 border-t border-slate-200 bg-[#1f1140] text-slate-100">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <img
                  src="https://spisolutions.com.au/wp-content/uploads/2022/04/spis_logo-v2-300x72.png"
                  alt="SP Interior Solutions"
                  className="h-10 w-auto shrink-0"
                />
                <p className="min-w-0 text-sm text-slate-200">
                  Blinds, shutters, fly screens &amp; security doors — made to measure in Melbourne.
                </p>
              </div>

              <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Address
                  </h3>
                  <p className="mt-2 text-slate-100">
                    Melbourne, Victoria, Australia
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Phone
                  </h3>
                  <p className="mt-2 text-slate-100">
                    Appointments: +61 449 736 429
                  </p>
                  <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Email
                  </h3>
                  <p className="mt-2 text-slate-100">
                    info@spisolutions.com.au
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Opening hours
                  </h3>
                  <p className="mt-2 text-slate-100">
                    Call for appointments
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-purple-900/60 bg-[#170b32]">
              <div className="mx-auto max-w-6xl px-4 py-3 text-xs text-slate-300 sm:px-6">
                <span className="block min-w-0 overflow-hidden text-ellipsis sm:inline">
                  SP Interior Solutions Pty Ltd © 2015 – 2025. All rights reserved.
                </span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}

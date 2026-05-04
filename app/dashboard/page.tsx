import Link from 'next/link'
import { UserCircle2, FileText } from 'lucide-react'
import { PageHeader, PageCard } from '@/components/ui/design-system'

export default function DashboardPage() {
  return (
    <section className="w-full min-w-0 space-y-8">
      <PageHeader
        title="SP Interior Solutions — Quotation workspace"
        description="Create and manage professional quotations for blinds, shutters, fly screens and security doors."
      />

      <PageCard className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
            Blinds &amp; Shutters
          </p>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Made-to-measure window solutions, all under one roof
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            This workspace is built for SP Interior Solutions to generate clear,
            consistent quotations for every project — from roller blinds to
            plantation shutters, fly screens and security doors.
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <ul className="list-disc space-y-1 pl-5">
              <li>Roller, Roman, vertical &amp; Venetian blinds</li>
              <li>S-fold, wave-fold, sheer &amp; blockout curtains</li>
              <li>PVC, timber &amp; aluminium plantation shutters</li>
            </ul>
            <ul className="list-disc space-y-1 pl-5">
              <li>Custom fly screens and fly doors</li>
              <li>Security doors for strength and style</li>
              <li>Interior design consultation and implementation</li>
            </ul>
          </div>
        </div>
        <div className="flex-1">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img
              src="https://spisolutions.com.au/wp-content/uploads/2022/04/spis_featured_blinds-1.webp"
              alt="SP Interior Solutions custom blinds in a modern living space"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      </PageCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/dashboard/profile"
          className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/50 transition-transform hover:-translate-y-1 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100/50 sm:p-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-purple-100 group-hover:text-purple-600">
            <UserCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800 transition-all duration-300 ease-out group-hover:text-purple-700">
            Profile
          </h2>
          <p className="mt-2 text-sm text-slate-600 translate-y-1 opacity-90 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            View and update your contact details used on quotations.
          </p>
        </Link>

        <Link
          href="/dashboard/quotes"
          className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/50 transition-transform hover:-translate-y-1 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100/50 sm:p-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-purple-100 group-hover:text-purple-600">
            <FileText className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800 transition-all duration-300 ease-out group-hover:text-purple-700">
            My quotations
          </h2>
          <p className="mt-2 text-sm text-slate-600 translate-y-1 opacity-90 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            View quotations sent to you and accept quotes when ready.
          </p>
        </Link>
      </div>
    </section>
  )
}

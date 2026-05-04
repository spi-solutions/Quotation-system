'use client'

/**
 * Shared design system: white + purple theme.
 * Use across all pages for a consistent professional look.
 */

// ——— Page structure ———
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

export function PageCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={
        'min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/50 sm:p-8 ' +
        className
      }
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-slate-200 pb-3 text-base font-semibold uppercase tracking-wide text-slate-700">
      {children}
    </h2>
  )
}

// ——— Status badge (quotes) ———
export function StatusBadge({ status }: { status: string }) {
  const base =
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold'
  switch (status) {
    case 'Approved':
      return (
        <span
          className={`${base} bg-purple-100 text-purple-700 ring-1 ring-purple-200`}
        >
          Approved
        </span>
      )
    case 'EmailQueued':
      return (
        <span
          className={`${base} bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200`}
        >
          Mail sent
        </span>
      )
    case 'Sent':
      return (
        <span
          className={`${base} bg-sky-100 text-sky-700 ring-1 ring-sky-200`}
        >
          Mail sent
        </span>
      )
    case 'EmailFailed':
      return (
        <span
          className={`${base} bg-red-100 text-red-800 ring-1 ring-red-200`}
        >
          Email failed
        </span>
      )
    case 'Draft':
      return (
        <span
          className={`${base} bg-slate-100 text-slate-700 ring-1 ring-slate-200`}
        >
          Draft
        </span>
      )
    case 'Invoiced':
      return (
        <span
          className={`${base} bg-amber-100 text-amber-800 ring-1 ring-amber-200`}
        >
          Invoiced
        </span>
      )
    default:
      return (
        <span
          className={`${base} bg-slate-100 text-slate-700 ring-1 ring-slate-200`}
        >
          Draft
        </span>
      )
  }
}

// ——— Form styles ———
export const inputBase =
  'block w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 disabled:opacity-60'
export const inputNormal =
  inputBase + ' border-slate-300 focus:border-purple-500 focus:ring-purple-500/20'
export const inputError =
  inputBase + ' border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20'

export function inputCls(hasError: boolean) {
  return hasError ? inputError : inputNormal
}

export const labelCls =
  'mb-1.5 block text-sm font-medium text-slate-700'
export const errorCls = 'mt-1.5 text-sm text-red-600'

export const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60'
export const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60'
export const btnDanger =
  'inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60'

export const cardCls =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/50 sm:p-8'
export const tableWrapCls =
  'max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/50'
export const paginationCls =
  'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-xs text-slate-600'
export const thCls =
  'border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 sm:px-6 sm:text-sm'
export const tdCls =
  'border-b border-slate-100 px-4 py-3.5 text-sm text-slate-800 last:border-0 sm:px-6'
export const backLinkCls =
  'inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-purple-600'

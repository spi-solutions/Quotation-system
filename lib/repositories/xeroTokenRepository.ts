import { dbSelect } from '@/lib/db/query'
import { supabaseAdmin } from '@/lib/db/supabase'
import type { XeroTokenRow } from '@/lib/types/xero'

const TABLE = 'xero_tokens' as const
const PROVIDER = 'xero' as const

export async function getTokenRow(): Promise<XeroTokenRow | null> {
  const data = await dbSelect<XeroTokenRow[]>(TABLE, (q) =>
    q.select('*').eq('provider', PROVIDER).limit(1)
  )
  return data[0] ?? null
}

export async function upsertTokenRow(payload: {
  refresh_token: string
  tenant_id: string
}): Promise<XeroTokenRow> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      {
        provider: PROVIDER,
        refresh_token: payload.refresh_token,
        tenant_id: payload.tenant_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return data as XeroTokenRow
}


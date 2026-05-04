export type PasswordResetToken = {
  id: number
  user_id: number
  token_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export type NewPasswordResetToken = Omit<
  PasswordResetToken,
  'id' | 'used_at' | 'created_at'
> & {
  used_at?: string | null
}

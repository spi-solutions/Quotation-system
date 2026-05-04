export type UserRole = 'admin' | 'user'

export type User = {
  id: number
  email: string
  password_hash: string
  role: UserRole
  created_at: string
}

export type NewUser = Omit<User, 'id' | 'created_at'>

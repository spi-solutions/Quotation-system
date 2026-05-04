export type UserRole = 'admin' | 'user'

export type Profile = {
  id: number
  auth_user_id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export type NewProfile = Omit<Profile, 'id' | 'created_at' | 'updated_at'>

export type ProfileUpdate = Partial<Pick<Profile, 'name' | 'email' | 'phone' | 'address'>>

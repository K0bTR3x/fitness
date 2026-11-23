import type { Repo } from './types'
import { localRepo } from './localRepo'
import { makeSupabaseRepo } from './supabaseRepo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Supabase açarları yoxdursa (məs. önizləmə), demo rejimi işləyir. */
export const repo: Repo = url && key && import.meta.env.MODE !== 'demo' ? makeSupabaseRepo(url, key) : localRepo

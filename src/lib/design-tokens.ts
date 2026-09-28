import { Prioridade, StatusOcorrencia } from '@/types/ocorrencia'
import {
  AlertTriangle,
  Flame,
  Clock,
  Info,
  Shield,
  CheckCircle2,
  UserCheck,
  Activity,
  Send,
  XCircle,
  LucideIcon,
} from 'lucide-react'

export interface PriorityToken {
  prioridade: Prioridade
  label: string
  bgClass: string
  textClass: string
  borderClass: string
  icon: LucideIcon
}

export const PRIORITY_TOKENS: Record<Prioridade, PriorityToken> = {
  P1: {
    prioridade: 'P1',
    label: 'P1 — Crítica',
    bgClass: 'bg-red-700 text-white',
    textClass: 'text-red-700 dark:text-red-400',
    borderClass: 'border-red-600',
    icon: AlertTriangle,
  },
  P2: {
    prioridade: 'P2',
    label: 'P2 — Alta',
    bgClass: 'bg-orange-600 text-white',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-500',
    icon: Flame,
  },
  P3: {
    prioridade: 'P3',
    label: 'P3 — Média',
    bgClass: 'bg-amber-600 text-white',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500',
    icon: Clock,
  },
  P4: {
    prioridade: 'P4',
    label: 'P4 — Baixa',
    bgClass: 'bg-blue-600 text-white',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500',
    icon: Info,
  },
  P5: {
    prioridade: 'P5',
    label: 'P5 — Mínima',
    bgClass: 'bg-zinc-600 text-white',
    textClass: 'text-zinc-600 dark:text-zinc-400',
    borderClass: 'border-zinc-500',
    icon: Shield,
  },
}

export interface StatusToken {
  status: StatusOcorrencia
  label: string
  badgeClass: string
  icon: LucideIcon
}

export const STATUS_TOKENS: Record<StatusOcorrencia, StatusToken> = {
  pendente: {
    status: 'pendente',
    label: 'Pendente',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    icon: Clock,
  },
  em_validacao: {
    status: 'em_validacao',
    label: 'Em Validação',
    badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800',
    icon: UserCheck,
  },
  validado: {
    status: 'validado',
    label: 'Validado',
    badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  em_progresso: {
    status: 'em_progresso',
    label: 'Em Progresso',
    badgeClass: 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
    icon: Activity,
  },
  resolvido: {
    status: 'resolvido',
    label: 'Resolvido',
    badgeClass: 'bg-zinc-200 text-zinc-800 border border-zinc-400 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    icon: Send,
  },
  rejeitado: {
    status: 'rejeitado',
    label: 'Rejeitado (Sem Fuga)',
    badgeClass: 'bg-rose-100 text-rose-900 border border-rose-400 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    icon: XCircle,
  },
}

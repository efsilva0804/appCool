export interface User {
  id: string;
  nome: string;
  telefone?: string;
  email: string;
  profissao?: string;
  saldo_horas: number;
  status: 'active' | 'suspended';
  role: 'admin' | 'professional';
}

export interface Room {
  id: string;
  nome: string;
  capacidade: number;
}

export interface Reservation {
  id: string;
  usuario_id: string;
  sala_id: string;
  data: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
  status: 'pendente' | 'aprovada' | 'recusada' | 'cancelada';
  recorrente: boolean;
  createdAt: number;
}

export interface CreditTransaction {
  id: string;
  usuario_id: string;
  horas_adicionadas: number;
  horas_utilizadas: number;
  saldo_resultante: number;
  data: number;
  descricao: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { User, OperationType, FirestoreErrorInfo } from '../types';

interface AuthContextType {
  currentUser: any | null;
  profile: User | null;
  loading: boolean;
  isDemo: boolean;
  loginDemo: (role: 'admin' | 'professional', emailOverride?: string, nameOverride?: string) => void;
  logoutDemo: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  profile: null,
  loading: true,
  isDemo: false,
  loginDemo: () => {},
  logoutDemo: () => {},
});

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to seed localStorage demo data
function seedLocalDemoData() {
  if (!localStorage.getItem('demo_rooms')) {
    const defaultRooms = [
      { id: 'sala-1', nome: 'Sala Individual 1', capacidade: 1 },
      { id: 'sala-2', nome: 'Sala Individual 2', capacidade: 1 },
      { id: 'sala-3', nome: 'Sala Individual 3', capacidade: 1 },
      { id: 'sala-4', nome: 'Sala Individual 4', capacidade: 1 },
      { id: 'sala-5', nome: 'Sala Compartilhada (8 cabines)', capacidade: 8 },
    ];
    localStorage.setItem('demo_rooms', JSON.stringify(defaultRooms));
  }
  if (!localStorage.getItem('demo_users')) {
    const defaultUsers = [
      {
        id: 'user-admin',
        nome: 'Enio Silva (Admin)',
        email: 'eniofds@gmail.com',
        telefone: '11988887777',
        profissao: 'Coordenador',
        saldo_horas: 100,
        status: 'active',
        role: 'admin'
      },
      {
        id: 'user-prof1',
        nome: 'Dra. Ana Souza (Fisioterapeuta)',
        email: 'ana.souza@example.com',
        telefone: '11911112222',
        profissao: 'Fisioterapeuta',
        saldo_horas: 12,
        status: 'active',
        role: 'professional'
      },
      {
        id: 'user-prof2',
        nome: 'Dr. Carlos Lima (Psicólogo)',
        email: 'carlos.lima@example.com',
        telefone: '11933334444',
        profissao: 'Psicólogo',
        saldo_horas: 24,
        status: 'active',
        role: 'professional'
      }
    ];
    localStorage.setItem('demo_users', JSON.stringify(defaultUsers));
  }
  if (!localStorage.getItem('demo_reservations')) {
    const defaultReservations = [
      {
        id: 'res-1',
        usuario_id: 'user-prof1',
        sala_id: 'sala-2',
        data: '2026-05-21',
        hora_inicio: '14:00',
        hora_fim: '15:00',
        status: 'pendente',
        recorrente: false,
        createdAt: Date.now() - 3600000
      },
      {
        id: 'res-2',
        usuario_id: 'user-prof2',
        sala_id: 'sala-3',
        data: '2026-05-22',
        hora_inicio: '08:00',
        hora_fim: '12:00',
        status: 'aprovada',
        recorrente: true,
        createdAt: Date.now() - 7200000
      },
      {
        id: 'res-3',
        usuario_id: 'user-prof1',
        sala_id: 'sala-5',
        data: '2026-05-20',
        hora_inicio: '10:00',
        hora_fim: '11:00',
        status: 'aprovada',
        recorrente: false,
        createdAt: Date.now() - 10800000
      }
    ];
    localStorage.setItem('demo_reservations', JSON.stringify(defaultReservations));
  }
  if (!localStorage.getItem('demo_transactions')) {
    const defaultTx = [
      {
        id: 'tx-1',
        usuario_id: 'user-prof1',
        horas_adicionadas: 15,
        horas_utilizadas: 0,
        saldo_resultante: 12,
        data: Date.now() - 86400000,
        descricao: 'Pacote inicial de horas'
      },
      {
        id: 'tx-2',
        usuario_id: 'user-prof2',
        horas_adicionadas: 30,
        horas_utilizadas: 6,
        saldo_resultante: 24,
        data: Date.now() - 43200000,
        descricao: 'Compra de créditos'
      }
    ];
    localStorage.setItem('demo_transactions', JSON.stringify(defaultTx));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Initialize Demo Mode if previously active
  useEffect(() => {
    seedLocalDemoData();
    const activeDemoRole = sessionStorage.getItem('active_demo_role');
    const activeDemoEmail = sessionStorage.getItem('active_demo_email');
    if (activeDemoRole) {
      const demoUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
      const foundUser = demoUsers.find((u: any) => u.email === activeDemoEmail || u.role === activeDemoRole);
      if (foundUser) {
        setIsDemo(true);
        setCurrentUser({ uid: foundUser.id, email: foundUser.email, displayName: foundUser.nome });
        setProfile(foundUser);
        setLoading(false);
        return;
      }
    }

    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (sessionStorage.getItem('active_demo_role')) {
        // Bypass if demo mode was initialized elsewhere
        return;
      }
      
      setCurrentUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userRef);
          if (!docSnap.exists()) {
            const isBootstrapAdmin = user.email === 'eniofds@gmail.com';
            const newUser = {
              nome: user.displayName || 'Novo Usuário',
              email: user.email || '',
              role: (isBootstrapAdmin ? 'admin' : 'professional') as 'admin' | 'professional',
              saldo_horas: 0,
              status: 'active' as const,
            };
            await setDoc(userRef, newUser);
          }
          
          unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              setProfile({ id: snapshot.id, ...snapshot.data() } as User);
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          });
        } catch (error) {
           handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  const loginDemo = (role: 'admin' | 'professional', emailOverride?: string, nameOverride?: string) => {
    const demoUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
    let userToUse = demoUsers.find((u: any) => {
      if (emailOverride) return u.email === emailOverride;
      return u.role === role;
    });

    if (!userToUse) {
      // Build a dynamic default profile if not pre-seeded
      userToUse = {
        id: `demo-user-${Date.now()}`,
        nome: nameOverride || (role === 'admin' ? 'Administrador Teste' : 'Profissional Teste'),
        email: emailOverride || (role === 'admin' ? 'admin@demo.com' : 'user@demo.com'),
        telefone: '11999999999',
        profissao: role === 'admin' ? 'Coordenador' : 'Terapeuta',
        saldo_horas: role === 'admin' ? 999 : 50,
        status: 'active',
        role: role
      };
      demoUsers.push(userToUse);
      localStorage.setItem('demo_users', JSON.stringify(demoUsers));
    }

    sessionStorage.setItem('active_demo_role', role);
    sessionStorage.setItem('active_demo_email', userToUse.email);
    setIsDemo(true);
    setCurrentUser({ uid: userToUse.id, email: userToUse.email, displayName: userToUse.nome });
    setProfile(userToUse);
  };

  const logoutDemo = () => {
    sessionStorage.removeItem('active_demo_role');
    sessionStorage.removeItem('active_demo_email');
    setIsDemo(false);
    setCurrentUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, profile, loading, isDemo, loginDemo, logoutDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

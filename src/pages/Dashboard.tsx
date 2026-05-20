import React, { useEffect, useState } from 'react';
import { useAuth, handleFirestoreError } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, doc, getDocs, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Reservation, Room, OperationType } from '../types';
import { format } from 'date-fns';
import { Calendar, Clock, RefreshCw, XCircle } from 'lucide-react';

export default function Dashboard() {
  const { profile, loading, isDemo } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch rooms list to display nice room names
  useEffect(() => {
    if (isDemo) {
      const demoRooms = JSON.parse(localStorage.getItem('demo_rooms') || '[]');
      setRooms(demoRooms);
      return;
    }

    if (loading || !profile) {
      return;
    }

    const fetchRealRooms = async () => {
      try {
        const snap = await getDocs(collection(db, 'rooms'));
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      } catch (err) {
        console.error("Error fetching rooms", err);
      }
    };
    fetchRealRooms();
  }, [isDemo, loading, profile]);

  useEffect(() => {
    if (!profile) return;

    if (isDemo) {
      // In Demo Mode, load and watch local storage
      const loadDemoReservations = () => {
        const localRes = JSON.parse(localStorage.getItem('demo_reservations') || '[]');
        const filtered = localRes.filter((r: any) => r.usuario_id === profile.id);
        // Sort descending by createdAt
        filtered.sort((a: any, b: any) => b.createdAt - a.createdAt);
        setReservations(filtered);
        setIsLoading(false);
      };

      loadDemoReservations();
      // Listen to storage changes
      window.addEventListener('storage', loadDemoReservations);
      const interval = setInterval(loadDemoReservations, 1000); // Polling for fast reactive updates

      return () => {
        window.removeEventListener('storage', loadDemoReservations);
        clearInterval(interval);
      };
    }

    const q = query(
      collection(db, 'reservations'),
      where('usuario_id', '==', profile.id),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const res = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
      setReservations(res);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reservations');
    });

    return () => unsubscribe();
  }, [profile, isDemo]);

  const cancelReservation = async (resId: string) => {
    if (window.confirm("Deseja realmente cancelar esta solicitação de reserva?")) {
      try {
        if (isDemo) {
          const localRes = JSON.parse(localStorage.getItem('demo_reservations') || '[]');
          const updated = localRes.map((r: any) => {
            if (r.id === resId) {
              return { ...r, status: 'cancelada' };
            }
            return r;
          });
          localStorage.setItem('demo_reservations', JSON.stringify(updated));
          // Trigger local state update
          const filtered = updated.filter((r: any) => r.usuario_id === profile?.id);
          filtered.sort((a: any, b: any) => b.createdAt - a.createdAt);
          setReservations(filtered);
          return;
        }

        // Real Firebase Update
        await updateDoc(doc(db, 'reservations', resId), { status: 'cancelada' });
      } catch (err) {
        alert("Erro ao cancelar a reserva de forma online.");
        console.error(err);
      }
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
        <span>Carregando painel do profissional...</span>
      </div>
    );
  }

  if (!profile) return <div className="text-center py-10 font-semibold text-red-500">Acesso negado.</div>;

  const roomMap = new Map(rooms.map(r => [r.id, r.nome]));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white px-6 py-8 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Olá, {profile.nome}</h2>
          <p className="text-sm text-gray-500 mt-1">Perfis de locação de coworking terapêutico</p>
          <div className="mt-2 text-xs text-gray-400">
            Profissão: <span className="font-semibold">{profile.profissao || 'Não informada'}</span> | Telefone: {profile.telefone || 'Não informado'}
          </div>
        </div>
        <div className="bg-emerald-50 px-6 py-4 rounded-xl border border-emerald-100 flex items-center gap-4 min-w-[200px] justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">Créditos de Horas</span>
            <span className="text-sm text-gray-500">Saldo Livre acumulado</span>
          </div>
          <span className="text-3xl font-black text-emerald-700">{profile.saldo_horas}h</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            Minhas Reservas de Salas
          </h3>
          <span className="text-xs text-gray-400 font-medium">Histórico recente</span>
        </div>
        
        {reservations.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Nenhuma reserva ou solicitação encontrada neste momento. Use o link "Nova Reserva" no topo para solicitar!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Sala</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data e Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {reservations.map(res => {
                  const roomName = roomMap.get(res.sala_id) || `Sala (${res.sala_id})`;
                  let formattedDate = res.data;
                  try {
                    // Normalize standard Date output
                    const parts = res.data.split('-');
                    if (parts.length === 3) {
                      formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                  } catch (e) {}

                  return (
                    <tr key={res.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{roomName}</div>
                        {res.recorrente && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap mt-1">
                            Recorrente semanal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{formattedDate}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {res.hora_inicio} às {res.hora_fim}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                          ${res.status === 'aprovada' ? 'bg-green-100 text-green-800' :
                            res.status === 'pendente' ? 'bg-yellow-105 text-yellow-850' :
                            res.status === 'recusada' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {res.status === 'pendente' && (
                          <button 
                            onClick={() => cancelReservation(res.id)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 font-medium hover:bg-red-50 px-2.5 py-1.5 rounded transition-all"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

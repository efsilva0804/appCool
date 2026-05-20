import React, { useEffect, useState } from 'react';
import { useAuth, handleFirestoreError } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Room, Reservation, OperationType, User, CreditTransaction } from '../types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Users, Home as HomeIcon, Check, X, ShieldAlert, Plus, Minus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AdminPanel() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'reservations' | 'rooms' | 'users' | 'history'>('general');
  
  if (profile?.role !== 'admin') {
    return <div className="text-center py-20 text-red-500 font-medium">Acesso restrito a administradores do sistema.</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">Painel de Administração Gestor</h1>
        <p className="text-xs text-gray-500 mt-1">Controle de salas, usuários, recarga de horas e aprovação de reservas</p>
      </div>
      
      {/* Tab Selector */}
      <div className="border-b border-gray-150 bg-white p-2 rounded-xl border flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'general' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <Calendar className="w-4 h-4" />
          Calendário de Ocupação
        </button>
        <button
          onClick={() => setActiveTab('reservations')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'reservations' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <Clock className="w-4 h-4" />
          Solicitações
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <Users className="w-4 h-4" />
          Profissionais & Créditos
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'rooms' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <HomeIcon className="w-4 h-4" />
          Salas e Cabines
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <FileText className="w-4 h-4" />
          Log Financeiro/Crédito
        </button>
      </div>

      <div className="pt-2 animate-fadeIn">
        {activeTab === 'general' && <AdminGeneralCalendar />}
        {activeTab === 'reservations' && <AdminReservations />}
        {activeTab === 'rooms' && <AdminRooms />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'history' && <AdminCreditHistory />}
      </div>
    </div>
  );
}

// 1. Interactive Calendar of Bookings (Section 9: Painel Geral: Calendário Diário, Semanal, Mensal)
function AdminGeneralCalendar() {
  const { isDemo } = useAuth();
  const [selectedRange, setSelectedRange] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2026-05-21')); // Standardized mockup test day
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (isDemo) {
      setReservations(JSON.parse(localStorage.getItem('demo_reservations') || '[]'));
      setRooms(JSON.parse(localStorage.getItem('demo_rooms') || '[]'));
      setUsers(JSON.parse(localStorage.getItem('demo_users') || '[]'));
      return;
    }
    // Fetch Online snapshots
    const unsubRes = onSnapshot(collection(db, 'reservations'), snap => setReservations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation))));
    const unsubRoo = onSnapshot(collection(db, 'rooms'), snap => setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room))));
    const unsubUsr = onSnapshot(collection(db, 'users'), snap => setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))));
    return () => { unsubRes(); unsubRoo(); unsubUsr(); };
  }, [isDemo]);

  // Generate date points for view
  const userMap = new Map(users.map(u => [u.id, u.nome]));
  const roomMap = new Map(rooms.map(r => [r.id, r.nome]));

  const startWeekDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: startWeekDate,
    end: addDays(startWeekDate, 5) // Monday to Saturday (Coworking Schedule from Section 3)
  });

  const calendarDays = selectedRange === 'day' ? [currentDate] : weekDays;

  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-150 p-6">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Disponibilidade e Ocupação Geral</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Clique para alternar entre Diário e Semanal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedRange('day')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${selectedRange === 'day' ? 'bg-slate-100 text-slate-805' : 'text-gray-450 hover:bg-slate-50'}`}
          >
            Diário
          </button>
          <button
            onClick={() => setSelectedRange('week')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${selectedRange === 'week' ? 'bg-slate-100 text-slate-805' : 'text-gray-450 hover:bg-slate-50'}`}
          >
            Semanal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {calendarDays.map((day, idx) => {
          const isoDayStr = format(day, 'yyyy-MM-dd');
          const dayBookings = reservations.filter(r => r.data === isoDayStr && r.status === 'aprovada');

          return (
            <div key={idx} className="bg-slate-50/50 rounded-xl border border-slate-150 p-3 min-h-[220px] flex flex-col justify-start">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-3">
                {format(day, "eeee", { locale: ptBR })}<br/>
                <strong className="text-sm font-black text-slate-800">{format(day, 'dd/MM')}</strong>
              </span>
              
              {dayBookings.length === 0 ? (
                <span className="text-[10px] text-gray-400 italic mt-4 block text-center">Nenhuma reserva confirmada</span>
              ) : (
                <div className="space-y-2">
                  {dayBookings.map(b => (
                    <div key={b.id} className="bg-white border border-slate-200/80 p-2 rounded-lg shadow-xs">
                      <span className="text-[10.5px] font-bold text-emerald-850 block truncate">{roomMap.get(b.sala_id) || 'Sala Coletiva'}</span>
                      <span className="text-[9.5px] font-semibold text-slate-500 block mt-0.5">{b.hora_inicio} - {b.hora_fim}</span>
                      <span className="text-[9px] text-gray-400 block truncate">{userMap.get(b.usuario_id) || 'Usuário'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 2. Reservations approval management tab
function AdminReservations() {
  const { isDemo } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setReservations(JSON.parse(localStorage.getItem('demo_reservations') || '[]'));
      setUsers(JSON.parse(localStorage.getItem('demo_users') || '[]'));
      setRooms(JSON.parse(localStorage.getItem('demo_rooms') || '[]'));
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(query(collection(db, 'reservations'), orderBy('createdAt', 'desc')), snap => {
      setReservations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reservations'));

    return () => unsub();
  }, [isDemo]);

  // Update credits after approval
  const handleStatusChange = async (res: Reservation, novoStatus: 'aprovada' | 'recusada') => {
    try {
      const uEmail = users.find(u => u.id === res.usuario_id)?.email;

      // 1. Calculate length of reservation in hours
      const [startH, startM] = res.hora_inicio.split(':').map(Number);
      const [endH, endM] = res.hora_fim.split(':').map(Number);
      const durationHours = (endH + endM / 60) - (startH + startM / 60);

      if (isDemo) {
        // Local state
        const localRes = JSON.parse(localStorage.getItem('demo_reservations') || '[]');
        const localUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
        const localTxs = JSON.parse(localStorage.getItem('demo_transactions') || '[]');

        const targetUserIdx = localUsers.findIndex((u: any) => u.id === res.usuario_id);
        
        if (targetUserIdx !== -1) {
          const user = localUsers[targetUserIdx];
          
          if (novoStatus === 'aprovada') {
            if (user.saldo_horas < durationHours) {
              alert(`Atenção: O profissional ${user.nome} tem apenas ${user.saldo_horas}h de saldo, mas a consulta requer ${durationHours}h.`);
              return;
            }
            user.saldo_horas -= durationHours;
            
            // Add transaction log
            localTxs.push({
              id: `tx-${Date.now()}`,
              usuario_id: res.usuario_id,
              horas_adicionadas: 0,
              horas_utilizadas: durationHours,
              saldo_resultante: user.saldo_horas,
              data: Date.now(),
              descricao: `Reserva aprovada de ${durationHours}h na sala ${res.sala_id}`
            });
          }
        }

        const updatedRes = localRes.map((r: any) => {
          if (r.id === res.id) return { ...r, status: novoStatus };
          return r;
        });

        localStorage.setItem('demo_reservations', JSON.stringify(updatedRes));
        localStorage.setItem('demo_users', JSON.stringify(localUsers));
        localStorage.setItem('demo_transactions', JSON.stringify(localTxs));

        setReservations(updatedRes);
        setUsers(localUsers);
        alert(`Reserva ${novoStatus} com sucesso!`);
        return;
      }

      // Real Firebase Transaction 
      if (novoStatus === 'aprovada') {
        const foundUser = users.find(u => u.id === res.usuario_id);
        if (foundUser) {
          if (foundUser.saldo_horas < durationHours) {
            alert(`Aviso: O profissional tem saldo insuficiente (${foundUser.saldo_horas}h) para aprovar essa consulta.`);
            return;
          }
          const newBalance = foundUser.saldo_horas - durationHours;
          await updateDoc(doc(db, 'users', res.usuario_id), { saldo_horas: newBalance });
          
          // Log transactions
          const txId = crypto.randomUUID();
          await setDoc(doc(db, 'credit_transactions', txId), {
            usuario_id: res.usuario_id,
            horas_adicionadas: 0,
            horas_utilizadas: durationHours,
            saldo_resultante: newBalance,
            data: Date.now(),
            descricao: `Débito de ${durationHours}h por uso aprovado de consultório.`
          });
        }
      }

      await updateDoc(doc(db, 'reservations', res.id), { status: novoStatus });
      alert(`Status da reserva alterado para: ${novoStatus}`);
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar status.');
    }
  };

  if (loading) return <div className="text-xs text-gray-400">Carregando solicitações de reservas...</div>;

  const pendentes = reservations.filter(r => r.status === 'pendente');
  const historico = reservations.filter(r => r.status !== 'pendente');

  const roomMap = new Map(rooms.map(r => [r.id, r.nome]));
  const userMap = new Map(users.map(u => [u.id, u.nome]));

  return (
    <div className="space-y-6">
      {/* Pendentes */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Aprovações Pendentes ({pendentes.length})
        </h3>
        
        {pendentes.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium py-3">Não há solicitações pendentes de análise.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendentes.map(res => (
              <div key={res.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-800">Profissional: {userMap.get(res.usuario_id) || res.usuario_id}</p>
                  <p className="text-xs text-gray-500 font-medium">Local: {roomMap.get(res.sala_id) || res.sala_id}</p>
                  <span className="text-[11px] text-gray-400 block">Horário solicitado: {res.data.split('-').reverse().join('/')} | {res.hora_inicio} - {res.hora_fim}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleStatusChange(res, 'aprovada')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button 
                    onClick={() => handleStatusChange(res, 'recusada')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico Geral */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Análises Recentes</h3>
        {historico.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Histórico de reservas livre.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Profissional</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Sala</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Horário</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.map(res => (
                  <tr key={res.id}>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{userMap.get(res.usuario_id) || res.usuario_id}</td>
                    <td className="px-4 py-2.5 text-gray-500">{roomMap.get(res.sala_id) || res.sala_id}</td>
                    <td className="px-4 py-2.5 text-gray-400">{res.data} | {res.hora_inicio} - {res.hora_fim}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${res.status === 'aprovada' ? 'bg-green-50 text-green-700' : res.status === 'recusada' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                        {res.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 3. Rooms tab helper loading & creating
function AdminRooms() {
  const { isDemo } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setRooms(JSON.parse(localStorage.getItem('demo_rooms') || '[]'));
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(collection(db, 'rooms'), snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rooms'));
    return () => unsub();
  }, [isDemo]);

  const seedRooms = async () => {
    try {
      const salasParaCriar = [
        { id: 'sala-1', nome: 'Sala Individual 1', capacidade: 1 },
        { id: 'sala-2', nome: 'Sala Individual 2', capacidade: 1 },
        { id: 'sala-3', nome: 'Sala Individual 3', capacidade: 1 },
        { id: 'sala-4', nome: 'Sala Individual 4', capacidade: 1 },
        { id: 'sala-5', nome: 'Sala Compartilhada (8 cabines)', capacidade: 8 },
      ];
      
      if (isDemo) {
        localStorage.setItem('demo_rooms', JSON.stringify(salasParaCriar));
        setRooms(salasParaCriar);
        alert('Salas criadas localmente!');
        return;
      }

      for (const sala of salasParaCriar) {
        await setDoc(doc(db, 'rooms', sala.id), {
          nome: sala.nome,
          capacidade: sala.capacidade
        });
      }
      alert('Salas criadas com sucesso no Firestore!');
    } catch (e) {
      console.error(e);
      alert('Erro ao criar salas.');
    }
  };

  if (loading) return <div className="text-xs text-gray-400">Carregando salas...</div>;

  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800">Configurações Físicas do Atendimento</h3>
        <button onClick={seedRooms} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-all">
          Reconfigurar Salas Padrão
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {rooms.map(room => (
          <div key={room.id} className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 relative">
            <h4 className="font-bold text-slate-800 text-xs">{room.nome}</h4>
            <p className="text-[10px] text-gray-500 mt-1">ID da Sala: {room.id}</p>
            <span className="absolute top-4 right-4 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded text-[10px] font-bold px-1.5 py-0.5">
              Capac: {room.capacidade}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. Users & Credits log managing
function AdminUsers() {
  const { isDemo } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setUsers(JSON.parse(localStorage.getItem('demo_users') || '[]'));
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    return () => unsub();
  }, [isDemo]);

  // Gestão de Créditos: adicionar horas, remover horas (Seção 9)
  const adjustCredits = async (userId: string, currentBalance: number, amount: number, isAddition: boolean) => {
    try {
      const difference = isAddition ? amount : -amount;
      const newBalance = Math.max(0, currentBalance + difference);

      if (isDemo) {
        const localUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
        const localTxs = JSON.parse(localStorage.getItem('demo_transactions') || '[]');

        const idx = localUsers.findIndex((u: any) => u.id === userId);
        if (idx !== -1) {
          localUsers[idx].saldo_horas = newBalance;
          localTxs.push({
            id: `tx-${Date.now()}`,
            usuario_id: userId,
            horas_adicionadas: isAddition ? amount : 0,
            horas_utilizadas: isAddition ? 0 : amount,
            saldo_resultante: newBalance,
            data: Date.now(),
            descricao: isAddition ? `Recarga manual de créditos (+${amount}h)` : `Retirada manual de créditos (-${amount}h)`
          });

          localStorage.setItem('demo_users', JSON.stringify(localUsers));
          localStorage.setItem('demo_transactions', JSON.stringify(localTxs));
          setUsers(localUsers);
          alert('Horas atualizadas localmente!');
        }
        return;
      }

      await updateDoc(doc(db, 'users', userId), { saldo_horas: newBalance });
      const txId = crypto.randomUUID();
      await setDoc(doc(db, 'credit_transactions', txId), {
        usuario_id: userId,
        horas_adicionadas: isAddition ? amount : 0,
        horas_utilizadas: isAddition ? 0 : amount,
        saldo_resultante: newBalance,
        data: Date.now(),
        descricao: isAddition ? `Ajuste manual administrativo (+${amount}h)` : `Estorno manual administrativo (-${amount}h)`
      });
      alert('Horas de saldo ajustadas com êxito!');
    } catch (e) {
      console.error(e);
      alert('Não foi possível realizar o ajuste.');
    }
  };

  // Cadastrar, editar e suspender usuários (Seção 9)
  const updateUserStatus = async (userId: string, currentStatus: 'active' | 'suspended') => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      if (isDemo) {
        const localUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
        const idx = localUsers.findIndex((u: any) => u.id === userId);
        if (idx !== -1) {
          localUsers[idx].status = nextStatus;
          localStorage.setItem('demo_users', JSON.stringify(localUsers));
          setUsers(localUsers);
          alert(`Status do profissional alterado para ${nextStatus}!`);
        }
        return;
      }

      await updateDoc(doc(db, 'users', userId), { status: nextStatus });
      alert(`Status atualizado para ${nextStatus}!`);
    } catch (err) {
      console.error(err);
      alert("Houve um problema ao suspender o usuário.");
    }
  };

  if (loading) return <div className="text-xs text-gray-400">Carregando usuários...</div>;

  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
      <h3 className="text-sm font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">Gerenciamento de Profissionais e Atletas de Locação</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-500 uppercase">Nome</th>
              <th className="px-4 py-3 font-semibold text-gray-500 uppercase">Profissão</th>
              <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-center">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-center">Saldo (H)</th>
              <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-right">Gerenciar Crédito</th>
              <th className="px-4 py-3 font-semibold text-gray-500 uppercase text-right">Painel de Acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-gray-900 font-bold whitespace-nowrap">
                  {u.nome}
                  <span className="block text-[10px] text-gray-450 font-normal mt-0.5">{u.email}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 font-medium">{u.profissao || 'Não informada'}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span className={`inline-flex px-1.5 py-0.5 text-[9px] rounded font-extrabold uppercase ${u.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {u.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-black text-gray-800">{u.role === 'admin' ? 'ILIMITADO' : `${u.saldo_horas}h`}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                  {u.role !== 'admin' && (
                    <>
                      <button 
                        onClick={() => adjustCredits(u.id, u.saldo_horas, 5, true)}
                        className="inline-flex items-center gap-0.5 text-xs text-emerald-850 hover:text-white hover:bg-emerald-600 border border-emerald-350 bg-emerald-50/50 px-2 py-1 rounded-lg transition-all"
                      >
                        <Plus className="w-3 h-3" /> 5h
                      </button>
                      <button 
                        onClick={() => adjustCredits(u.id, u.saldo_horas, 5, false)}
                        className="inline-flex items-center gap-0.5 text-xs text-red-800 hover:text-white hover:bg-red-650 border border-red-200 bg-red-50/50 px-2 py-1 rounded-lg transition-all"
                      >
                        <Minus className="w-3 h-3" /> 5h
                      </button>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {u.id !== 'user-admin' && (
                    <button 
                      onClick={() => updateUserStatus(u.id, u.status)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all ${u.status === 'active' ? 'text-red-750 bg-red-50/50 hover:bg-red-650 hover:text-white border-red-200' : 'text-emerald-700 bg-emerald-50/50 hover:bg-emerald-650 hover:text-white border-emerald-200'}`}
                    >
                      {u.status === 'active' ? 'Suspender' : 'Reativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 5. Credit audit log page
function AdminCreditHistory() {
  const { isDemo } = useAuth();
  const [txHistory, setTxHistory] = useState<CreditTransaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setTxHistory(JSON.parse(localStorage.getItem('demo_transactions') || '[]'));
      setUsers(JSON.parse(localStorage.getItem('demo_users') || '[]'));
      setLoading(false);
      return;
    }

    const unsubTx = onSnapshot(collection(db, 'credit_transactions'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CreditTransaction));
      // Sort desc by data
      list.sort((a,b) => b.data - a.data);
      setTxHistory(list);
    });
    const unsubUsr = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    });

    return () => { unsubTx(); unsubUsr(); };
  }, [isDemo]);

  if (loading) return <div className="text-xs text-gray-400">Carregando log de transações...</div>;

  const userMap = new Map(users.map(u => [u.id, u.nome]));

  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-emerald-600" />
        Log de Auditoria de Crédito e Recargas (Seção 7)
      </h3>
      
      {txHistory.length === 0 ? (
        <span className="text-xs text-gray-400 italic">Nenhum log financeiro registrado.</span>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-4 py-2.5 font-semibold text-gray-500">Data</th>
                <th className="px-4 py-2.5 font-semibold text-gray-500">Profissional</th>
                <th className="px-4 py-2.5 font-semibold text-gray-500 text-center">Adicionadas</th>
                <th className="px-4 py-2.5 font-semibold text-gray-500 text-center">Débito</th>
                <th className="px-4 py-2.5 font-semibold text-gray-500 text-center">Saldo Resultante</th>
                <th className="px-4 py-2.5 font-semibold text-gray-500">Histórico / Descricão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txHistory.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50/30">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{format(new Date(tx.data), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-4 py-2.5 text-gray-850 font-medium">{userMap.get(tx.usuario_id) || tx.usuario_id}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-600 font-bold">{tx.horas_adicionadas > 0 ? `+${tx.horas_adicionadas}h` : '--'}</td>
                  <td className="px-4 py-2.5 text-center text-red-700 font-bold">{tx.horas_utilizadas > 0 ? `-${tx.horas_utilizadas}h` : '--'}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-gray-700">{tx.saldo_resultante}h</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-sm truncate">{tx.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

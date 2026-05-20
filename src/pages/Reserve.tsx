import React, { useEffect, useState } from 'react';
import { useAuth, handleFirestoreError } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, setDoc, doc } from 'firebase/firestore';
import { Room, OperationType, Reservation } from '../types';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Calendar as CalendarIcon, Clock, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

export default function Reserve() {
  const { profile, isDemo, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  
  // Custom Recurrence options from Section 5.3 & 8 "Solicitação Recorrente"
  const [recorrente, setRecorrente] = useState<boolean>(false);
  const [diaSemana, setDiaSemana] = useState<string>('');
  const [frequencia, setFrequencia] = useState<string>('semanal');

  const [loading, setLoading] = useState(false);
  const [conflictMsg, setConflictMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Fetch Rooms list
  useEffect(() => {
    if (isDemo) {
      const demoRooms = JSON.parse(localStorage.getItem('demo_rooms') || '[]');
      setRooms(demoRooms);
      return;
    }

    if (authLoading || !profile) {
      return;
    }

    const fetchRealRooms = async () => {
      try {
        const snap = await getDocs(collection(db, 'rooms'));
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'rooms');
      }
    };
    fetchRealRooms();
  }, [isDemo, authLoading, profile]);

  // 2. Conflict Checking Logic (Section 7: Conflito de Horários)
  useEffect(() => {
    if (!selectedRoom || !date || !startTime || !endTime) {
      setConflictMsg('');
      return;
    }

    if (startTime >= endTime) {
      setConflictMsg('O horário de fim deve ser posterior ao horário de início.');
      return;
    }

    const checkConflicts = async () => {
      let activeReservations: Reservation[] = [];

      if (isDemo) {
        activeReservations = JSON.parse(localStorage.getItem('demo_reservations') || '[]');
      } else {
        try {
          const snap = await getDocs(collection(db, 'reservations'));
          activeReservations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
        } catch (err) {
          console.error("Conflict check failed", err);
          return;
        }
      }

      // Filter reservations for this room, same date, that are NOT cancelled or rejected ("recusada", "cancelada")
      const relevant = activeReservations.filter(res => 
        res.sala_id === selectedRoom &&
        res.data === date &&
        res.status !== 'recusada' &&
        res.status !== 'cancelada'
      );

      // Check overlapping intervals
      // Overlap: requestedStart < existingEnd && requestedEnd > existingStart
      const overlaps = relevant.filter(res => {
        return startTime < res.hora_fim && endTime > res.hora_inicio;
      });

      const selectedRoomObj = rooms.find(r => r.id === selectedRoom);
      if (!selectedRoomObj) return;

      const isSharedRoom = selectedRoomObj.id === 'sala-5' || selectedRoomObj.capacidade > 1;

      if (!isSharedRoom) {
        // Individual rooms 1-4 allow max 1 simultaneous reservation
        if (overlaps.length > 0) {
          setConflictMsg('🚨 Conflito de Agenda! Esta sala já está reservada ou possui solicitação pendente no horário selecionado.');
        } else {
          setConflictMsg('');
        }
      } else {
        // Shared Room 5 allows max 8 simultaneous reservations (cabines)
        const occupiedCount = overlaps.length;
        const available = 8 - occupiedCount;
        if (occupiedCount >= 8) {
          setConflictMsg('🚨 Todas as 8 cabines desta sala compartilhada estão reservadas/solicitadas neste período.');
        } else {
          setConflictMsg(`✓ Sala Compartilhada disponível: ${occupiedCount} de 8 cabines ocupadas (${available} cabines livres).`);
        }
      }
    };

    checkConflicts();
  }, [selectedRoom, date, startTime, endTime, rooms, isDemo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!profile) return;
    
    if (startTime >= endTime) {
      setErrorMsg('O horário de fim deve ser posterior ao de início.');
      return;
    }

    if (conflictMsg.startsWith('🚨')) {
      setErrorMsg('Não é possível criar a reserva devido aos conflitos detectados.');
      return;
    }
    
    setLoading(true);
    const reservationId = `res-${crypto.randomUUID()}`;
    const resData: Reservation = {
      id: reservationId,
      usuario_id: profile.id,
      sala_id: selectedRoom,
      data: date,
      hora_inicio: startTime,
      hora_fim: endTime,
      status: 'pendente', // "Muito Importante: Nenhuma reserva pode ser confirmada automaticamente."
      recorrente: recorrente,
      createdAt: Date.now()
    };
    
    try {
      if (isDemo) {
        // Mode Demo write to localStorage
        const demoReservations = JSON.parse(localStorage.getItem('demo_reservations') || '[]');
        demoReservations.push(resData);
        localStorage.setItem('demo_reservations', JSON.stringify(demoReservations));

        setSuccessMsg('Solicitação de reserva criada localmente com sucesso! Status inicial: Pendente.');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        // Real Firestore
        await setDoc(doc(db, 'reservations', reservationId), resData);
        setSuccessMsg('Sua solicitação de reserva foi enviada com sucesso para a administração de forma online!');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err) {
      setErrorMsg('Erro ao registrar a reserva. Por favor confira suas permissões e saldo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <div className="border-b border-gray-100 pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">Solicitar Agenda ou Recorrência</h2>
        <p className="text-xs text-gray-400 mt-1">
          Preencha a data e horário de sua consulta. Sua solicitação ficará <strong className="text-amber-600 font-semibold">Pendente</strong> aguardando aprovação.
        </p>
      </div>
      
      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-xs flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-6 text-xs flex gap-2 items-start animate-pulse">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Sala de Atendimento</label>
          <select 
            required
            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
            value={selectedRoom}
            onChange={e => setSelectedRoom(e.target.value)}
          >
            <option value="" disabled>Selecione uma sala</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.nome} (Máximo {r.capacidade} {r.capacidade === 1 ? 'profissional' : 'profissionais'})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Data</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><CalendarIcon className="w-4 h-4" /></span>
              <input 
                required
                type="date"
                min={new Date().toISOString().split('T')[0]} // Block historic dates for clean conflict simulation
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block pl-9 p-2.5 border text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Hora de Início</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Clock className="w-4 h-4" /></span>
              <input 
                required
                type="time" 
                min="08:00"
                max="21:00"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block pl-9 p-2.5 border text-sm"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Hora de Fim</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Clock className="w-4 h-4" /></span>
              <input 
                required
                type="time" 
                min="08:00"
                max="21:00"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block pl-9 p-2.5 border text-sm"
                value={endTime}
                onChange={e => setTemplateEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Operating hours disclaimer from Section 3 */}
        <p className="text-[10.5px] text-gray-400 leading-relaxed bg-slate-50 border border-gray-150 p-2.5 rounded">
          💡 <strong>Horários de Funcionamento:</strong> Segunda a Sexta das 08h às 21h (último horário reservável 20h às 21h). Sábado das 08h às 18h. Domingo fechado.
        </p>

        {/* Conflict Alerts Area */}
        {conflictMsg && (
          <div className={clsx(
            "p-3.5 rounded-lg text-xs leading-relaxed font-medium transition-all animate-pulse",
            conflictMsg.startsWith('🚨') ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"
          )}>
            {conflictMsg}
          </div>
        )}

        {/* Section 5.3: Recorrente Request Toggle */}
        <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-800 block">Opção de Pré-Reserva Recorrente</span>
              <span className="text-[10.5px] text-gray-450 block">Ideal para Psicólogos e terapeutas com agendas de repetição semanal.</span>
            </div>
            <input 
              type="checkbox"
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              checked={recorrente}
              onChange={e => setRecorrente(e.target.checked)}
            />
          </div>

          {recorrente && (
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Dia da Semana</label>
                <select 
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2 border text-xs"
                  value={diaSemana}
                  onChange={e => setDiaSemana(e.target.value)}
                >
                  <option value="">Selecione o Dia</option>
                  <option value="segunda">Segunda-feira</option>
                  <option value="terca">Terça-feira</option>
                  <option value="quarta">Quarta-feira</option>
                  <option value="quinta">Quinta-feira</option>
                  <option value="sexta">Sexta-feira</option>
                  <option value="sabado">Sábado</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Frequência</label>
                <select 
                  required
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2 border text-xs"
                  value={frequencia}
                  onChange={e => setFrequencia(e.target.value)}
                >
                  <option value="semanal">Toda Semana</option>
                  <option value="quinzenal">A cada duas semanas (Quinzenal)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={loading || conflictMsg.startsWith('🚨')}
            className={clsx(
              "w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white transition-all",
              (loading || conflictMsg.startsWith('🚨'))
                ? "bg-slate-305 text-slate-450 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {loading ? 'Enviando Solicitação...' : 'Enviar para Aprovação Manual'}
          </button>
        </div>
      </form>
    </div>
  );

  // Helper template setting end time elegantly
  function setTemplateEndTime(val: string) {
    setEndTime(val);
  }
}

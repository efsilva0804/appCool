import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loginWithGoogle, loginWithEmail, registerWithEmail, db } from '../firebase';
import { Navigate } from 'react-router-dom';
import { LogIn, UserPlus, Shield, User, HelpCircle, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

export default function Home() {
  const { profile, loading, isDemo, loginDemo } = useAuth();
  const [activeTab, setActiveTab] = useState<'login_prof' | 'login_admin' | 'register'>('login_prof');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [profissao, setProfissao] = useState('');
  
  const [localSandbox, setLocalSandbox] = useState(true); // Default to Sandbox/Simulator for reliable previews
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>;
  if (profile?.role === 'admin') return <Navigate to="/admin" />;
  if (profile?.role === 'professional') return <Navigate to="/dashboard" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoadingAuth(true);

    if (localSandbox) {
      // Simulate login using local sandbox accounts
      const demoUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
      const found = demoUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        loginDemo(found.role, found.email, found.nome);
        setLoadingAuth(false);
      } else {
        setErrorMsg('Usuário simulado não encontrado. Experimente usar os botões de Acesso Rápido abaixo!');
        setLoadingAuth(false);
      }
      return;
    }

    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/operation-not-allowed') {
        setErrorMsg('O método de login por "E-mail/Senha" não está ativado de forma nativa no seu projeto Firebase. Ative a caixa "Modo Simulado / Local" acima para testar livremente sem limitações!');
      } else {
        setErrorMsg('Falha no login. Verifique suas credenciais.');
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoadingAuth(true);

    if (localSandbox) {
      // Create user locally
      const demoUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
      if (demoUsers.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        setErrorMsg('Este e-mail de teste já está em uso.');
        setLoadingAuth(false);
        return;
      }
      const newDUser = {
        id: `demo-user-${Date.now()}`,
        nome: nome,
        email: email,
        telefone: telefone,
        profissao: profissao || 'Profissional',
        saldo_horas: 0,
        status: 'active' as const,
        role: 'professional' as const
      };
      demoUsers.push(newDUser);
      localStorage.setItem('demo_users', JSON.stringify(demoUsers));
      loginDemo('professional', email, nome);
      setLoadingAuth(false);
      return;
    }

    try {
      const userCred = await registerWithEmail(email, password);
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'users', userCred.user.uid), {
            nome: nome,
            telefone: telefone,
            profissao: profissao
          });
        } catch (updateErr) {
          console.error("Failed to update extra fields", updateErr);
        }
      }, 2000);
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/operation-not-allowed') {
        setErrorMsg('O método de cadastro por "E-mail/Senha" não está ativado de forma nativa no seu projeto Firebase. Ative a caixa "Modo Simulado / Local" acima para simular o cadastro local!');
      } else {
        setErrorMsg('Falha no cadastro. O e-mail já pode estar em uso ou a senha é fraca.');
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loadingAuth) return;
    setErrorMsg('');
    setLoadingAuth(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/operation-not-allowed') {
        setErrorMsg('O login com Google não está ativo no seu console do Firebase. Ative "Google" em: Console Firebase > Build > Authentication > Sign-in method.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setErrorMsg('A requisição de login por popup do Google foi cancelada porque outra requisição foi iniciada ou fechada. Aguarde alguns instantes e tente novamente, ou ative o "Modo Simulado / Local" abaixo.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('O popup do Google foi fechado antes de concluir o login. Se estiver utilizando a visualização do AI Studio, você pode precisar abrir a aplicação em uma aba externa ou utilizar o "Modo Simulado / Local" abaixo.');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMsg('O popup do Google foi bloqueado pelo seu navegador. Por favor, autorize popups ou utilize o "Modo Simulado / Local" para testar livremente.');
      } else {
        setErrorMsg(`Falha na autenticação com o Google: ${err?.message || 'Erro desconhecido'}`);
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex border-b border-gray-100">
        <button 
          onClick={() => { setActiveTab('login_prof'); setErrorMsg(''); }}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center justify-center gap-1 ${activeTab === 'login_prof' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
        >
          <User className="w-4 h-4" />
          Profissional
        </button>
        <button 
          onClick={() => { setActiveTab('login_admin'); setErrorMsg(''); }}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center justify-center gap-1 ${activeTab === 'login_admin' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
        >
          <Shield className="w-4 h-4" />
          Administrador
        </button>
        <button 
          onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center justify-center gap-1 ${activeTab === 'register' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
        >
          <UserPlus className="w-4 h-4" />
          Criar Conta
        </button>
      </div>

      <div className="p-6 sm:p-8">
        {/* Toggle between modes */}
        <div className="bg-slate-50 border border-slate-250 rounded-lg p-3.5 mb-6 flex items-start gap-2.5">
          <input
            id="sandbox-toggle"
            type="checkbox"
            className="h-4 w-4 mt-1 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500"
            checked={localSandbox}
            onChange={e => setLocalSandbox(e.target.checked)}
          />
          <div className="flex-1">
            <label htmlFor="sandbox-toggle" className="text-xs font-semibold text-slate-800 flex items-center gap-1 cursor-pointer">
              Ativar Modo Simulado / Local (Recomendado)
            </label>
            <p className="text-[10.5px] text-slate-500 leading-relaxed mt-0.5">
              Ideal para testar instantaneamente quando o serviço Firebase Auth ainda não possui o método "Email/Senha" ativado no painel Google/Firebase.
            </p>
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {activeTab === 'login_prof' ? 'Acesso Profissional' : activeTab === 'login_admin' ? 'Acesso Administrativo' : 'Crie sua Conta'}
          </h1>
          <p className="text-xs text-gray-400">
            {localSandbox ? '⚡ Rodando no modo simulado local sandbox' : '🌐 Conectado ao Firebase Auth Real'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-3.5 rounded-lg mb-6 text-xs flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {(activeTab === 'login_prof' || activeTab === 'login_admin') ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">E-mail</label>
              <input 
                required
                type="email"
                placeholder="seu.email@exemplo.com"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">Senha</label>
              <input 
                required
                type="password"
                placeholder="Sua senha"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loadingAuth}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loadingAuth ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">Nome Completo</label>
              <input 
                required
                type="text"
                placeholder="Seu nome"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                value={nome}
                onChange={e => setNome(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">Telefone</label>
                <input 
                  type="tel"
                  placeholder="(11) 99999-9999"
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">Profissão</label>
                <input 
                  type="text"
                  placeholder="Fisioterapeuta, Psicólogo..."
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                  value={profissao}
                  onChange={e => setProfissao(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">E-mail</label>
              <input 
                required
                type="email"
                placeholder="seu.email@exemplo.com"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-650 uppercase tracking-wider mb-1">Senha (Mínimo 6 caracteres)</label>
              <input 
                required
                type="password"
                minLength={6}
                placeholder="Crie uma senha"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 border text-sm"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loadingAuth}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loadingAuth ? 'Criando Conta...' : 'Cadastrar'}
            </button>
          </form>
        )}

        {/* Quick Demo Access Area */}
        <div className="mt-6 pt-6 border-t border-gray-100 bg-gray-50/70 p-4 rounded-xl">
          <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            Acesso Rápido de Demonstração
          </h4>
          <p className="text-[10.5px] text-gray-500 leading-relaxed mb-3">
            Selecione uma conta simulada de demonstração abaixo para explorar instantaneamente todos os recursos em tempo real:
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                loginDemo('admin', 'eniofds@gmail.com', 'Enio Silva (Admin)');
              }}
              className="w-full text-left bg-white hover:bg-slate-50 border border-gray-250 p-2.5 rounded-lg flex items-center justify-between text-xs transition-all shadow-sm"
            >
              <div>
                <span className="font-semibold text-slate-800">Enio Silva (Administrador)</span>
                <span className="block text-[10px] text-gray-400">Gerencia aprovações, créditos e salas</span>
              </div>
              <span className="bg-indigo-50 text-indigo-750 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Admin</span>
            </button>
            <button
              onClick={() => {
                loginDemo('professional', 'ana.souza@example.com', 'Dra. Ana Souza (Fisioterapeuta)');
              }}
              className="w-full text-left bg-white hover:bg-slate-50 border border-gray-250 p-2.5 rounded-lg flex items-center justify-between text-xs transition-all shadow-sm"
            >
              <div>
                <span className="font-semibold text-slate-800">Dra. Ana Souza (Profissional)</span>
                <span className="block text-[10px] text-gray-400">Saldo: 12 horas | Fisioterapeuta</span>
              </div>
              <span className="bg-emerald-50 text-emerald-750 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Profissional</span>
            </button>
            <button
              onClick={() => {
                loginDemo('professional', 'carlos.lima@example.com', 'Dr. Carlos Lima (Psicólogo)');
              }}
              className="w-full text-left bg-white hover:bg-slate-50 border border-gray-250 p-2.5 rounded-lg flex items-center justify-between text-xs transition-all shadow-sm"
            >
              <div>
                <span className="font-semibold text-slate-800">Dr. Carlos Lima (Profissional)</span>
                <span className="block text-[10px] text-gray-400">Saldo: 24 horas | Psicólogo</span>
              </div>
              <span className="bg-emerald-50 text-emerald-750 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Profissional</span>
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400 font-medium">Ou autentique com</span>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loadingAuth}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loadingAuth ? 'Autenticando...' : 'Entrar com Google'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

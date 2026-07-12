'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { KeyRound } from 'lucide-react';

const MIN_SENHA = 8;

export default function ContaPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setOk(false);

    if (senha.length < MIN_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
      return;
    }
    if (senha !== confirma) {
      setErro('As senhas não conferem.');
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    // updateUser opera SEMPRE sobre a sessão de quem chama — não é possível
    // alterar a senha de outra conta a partir daqui.
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    setSenha('');
    setConfirma('');
    setOk(true);
  };

  return (
    <>
      <h1 className="admin-page-title">Minha conta</h1>

      <div className="dash-card" style={{ padding: '1.4rem', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <KeyRound size={16} style={{ color: 'var(--gold-500)' }} />
          <span style={{ color: 'var(--gold-100)', fontSize: '0.9rem' }}>Trocar senha</span>
        </div>

        {email && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: '1rem' }}>
            Conta: {email}
          </p>
        )}

        <form onSubmit={salvar} style={{ display: 'grid', gap: '0.7rem' }}>
          {erro && <div className="login-error">{erro}</div>}
          {ok && (
            <div style={{ color: '#5fd0b8', fontSize: '0.8rem' }}>
              Senha alterada com sucesso.
            </div>
          )}

          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={`Nova senha (mín. ${MIN_SENHA} caracteres)`}
            autoComplete="new-password"
            required
            style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }}
          />
          <input
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            required
            style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }}
          />

          <button type="submit" className="login-submit" disabled={salvando} style={{ width: 'auto', padding: '0.5rem 1.2rem', justifySelf: 'start' }}>
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login, user, hasPermission } = useAuth();

    useEffect(() => {
        if (user) {
            if (hasPermission('portal.ver_pedidos') && !hasPermission('pedidos.ver')) {
                navigate('/portal');
            } else {
                navigate('/');
            }
        }
    }, [user, navigate, hasPermission]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const loggedUser = await login(email, password);
            const perms = loggedUser?.permisos ?? [];
            if (perms.includes('portal.ver_pedidos') && !perms.includes('pedidos.ver')) {
                navigate('/portal');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Email o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--sp-4)',
            overflow: 'auto',
        }}>
            {/* Fondo degradado radial sutil */}
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(255,221,25,0.07), transparent)',
                pointerEvents: 'none',
            }} />

            <div style={{
                width: '100%',
                maxWidth: '380px',
                position: 'relative',
                animation: 'slideUp 280ms ease',
            }}>
                {/* Logo + Marca */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        margin: '0 auto var(--sp-4)',
                        background: 'var(--brand-muted)',
                        border: '1px solid var(--border-brand)',
                        borderRadius: 'var(--r-xl)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-brand)',
                    }}>
                        <ChefHat size={28} color="var(--brand)" />
                    </div>
                    <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                        marginTop: 0,
                    }}>
                        Arepas Betania
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                        Accede a tu panel de gestión
                    </p>
                </div>

                {/* Card principal */}
                <div className="card-elevated" style={{ padding: 'var(--sp-8)' }}>
                    <form onSubmit={handleLogin}>
                        {/* Email */}
                        <div className="form-group">
                            <label htmlFor="email">Correo electrónico</label>
                            <div className="input-group">
                                <span className="input-icon">
                                    <Mail size={16} />
                                </span>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                    placeholder="admin@arepaserp.com"
                                    required
                                    autoComplete="email"
                                    className={error ? 'input-error' : ''}
                                />
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div className="form-group" style={{ marginBottom: error ? 'var(--sp-4)' : 'var(--sp-6)' }}>
                            <label htmlFor="password">Contraseña</label>
                            <div className="input-group">
                                <span className="input-icon">
                                    <Lock size={16} />
                                </span>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className={error ? 'input-error' : ''}
                                    style={{ paddingRight: '42px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: 'var(--sp-3)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-tertiary)',
                                        display: 'flex',
                                        padding: 0,
                                        lineHeight: 0,
                                        transition: 'color var(--transition)',
                                    }}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Error inline — reemplaza alert() */}
                        {error && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--sp-2)',
                                padding: 'var(--sp-3)',
                                marginBottom: 'var(--sp-4)',
                                background: 'var(--danger-bg)',
                                border: '1px solid rgba(244,63,94,0.25)',
                                borderRadius: 'var(--r-md)',
                                fontSize: '0.8rem',
                                color: 'var(--danger)',
                                animation: 'fadeIn 150ms ease',
                            }}>
                                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg w-full"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span style={{
                                        width: 16,
                                        height: 16,
                                        border: '2px solid rgba(0,0,0,0.25)',
                                        borderTopColor: '#000',
                                        borderRadius: '50%',
                                        animation: 'spin 0.65s linear infinite',
                                        display: 'inline-block',
                                        flexShrink: 0,
                                    }} />
                                    Ingresando...
                                </>
                            ) : 'Iniciar sesión'}
                        </button>
                    </form>
                </div>

                <p style={{
                    textAlign: 'center',
                    marginTop: 'var(--sp-6)',
                    fontSize: '0.75rem',
                    color: 'var(--text-disabled)',
                }}>
                    ArepasERP © {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}

import React, { useState, FormEvent } from 'react';
import { MainLogo } from '../constants';

interface LoginProps {
    onLoginAttempt: (email: string, pass: string) => void;
    onForgotPasswordRequest: (email: string) => void;
    error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLoginAttempt, onForgotPasswordRequest, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [view, setView] = useState<'login' | 'forgot' | 'forgot_sent'>('login');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onLoginAttempt(email, password);
    };

    const handleForgotSubmit = (e: FormEvent) => {
        e.preventDefault();
        onForgotPasswordRequest(email);
        setView('forgot_sent');
    };

    const renderContent = () => {
        if (view === 'forgot') {
            return (
                 <form onSubmit={handleForgotSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Correo Electrónico Registrado
                        </label>
                        <div className="mt-1">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Ingrese su correo"
                                className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>
                     <div>
                        <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-700">
                            Enviar Enlace de Recuperación
                        </button>
                    </div>
                     <div className="text-sm text-center">
                        <button type="button" onClick={() => setView('login')} className="font-medium text-amber-600 hover:text-amber-500">
                            Volver a Iniciar Sesión
                        </button>
                    </div>
                </form>
            );
        }

        if (view === 'forgot_sent') {
            return (
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-slate-800">Revise su Correo</h3>
                    <p className="mt-2 text-sm text-slate-600">
                        Si existe una cuenta asociada a <strong>{email}</strong>, hemos enviado un enlace para restablecer su contraseña.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        (Para esta simulación, revise la consola del navegador para ver el enlace).
                    </p>
                     <button type="button" onClick={() => { setView('login'); setEmail(''); }} className="mt-6 font-medium text-amber-600 hover:text-amber-500">
                        &larr; Volver a Iniciar Sesión
                    </button>
                </div>
            );
        }

        return (
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Correo Electrónico
                    </label>
                    <div className="mt-1">
                        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                    </div>
                </div>

                <div>
                    <label htmlFor="password"className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Contraseña
                    </label>
                    <div className="mt-1">
                        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                        <p>{error}</p>
                    </div>
                )}
                
                <div className="text-sm text-center">
                    <button type="button" onClick={() => setView('forgot')} className="font-medium text-amber-600 hover:text-amber-500">
                        ¿Olvidó su contraseña?
                    </button>
                </div>

                <div>
                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
                        Ingresar
                    </button>
                </div>
            </form>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-900">
            <div className="text-center mb-10">
                <div className="mb-4 flex justify-center items-center">
                    <MainLogo />
                </div>
                <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200 mt-2">Gestión Pedagógica LIR</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">
                    {view === 'login' ? 'Bienvenido/a, por favor inicie sesión' : 'Recuperación de Contraseña'}
                </p>
            </div>
            
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md">
                {renderContent()}
            </div>

            <footer className="absolute bottom-4 text-slate-500 dark:text-slate-400 text-sm">
                &copy; {new Date().getFullYear()} Liceo Industrial de Recoleta. Todos los derechos reservados.
            </footer>
        </div>
    );
};

export default Login;
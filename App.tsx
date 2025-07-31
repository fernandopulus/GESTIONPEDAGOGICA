import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Profile, User, MensajeInterno, ReadStatus } from './types';
import Login from './components/Login';
import ProfileSelector from './components/ProfileSelector';
import Dashboard from './components/Dashboard';
import { MainLogo } from './constants';

const USERS_KEY = 'usuariosLiceo';
const SESSION_USER_KEY = 'lir-sessionUser';
const MENSAJES_KEY = 'mensajesInternos';
const READ_STATUS_KEY = 'lir-read-status';
const PASSWORD = 'recoleta';

const ResetPasswordForm: React.FC<{ token: string; onReset: (token: string, newPass: string) => void }> = ({ token, onReset }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        if (password.length < 4) {
            setError("La contraseña debe tener al menos 4 caracteres.");
            return;
        }
        onReset(token, password);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-100">
            <div className="text-center mb-10">
                <div className="mb-4 flex justify-center items-center"><MainLogo /></div>
                <h1 className="text-4xl font-bold text-slate-800">Restablecer Contraseña</h1>
            </div>
            <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-md">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="newPassword"className="block text-sm font-medium text-slate-700">Nueva Contraseña</label>
                        <input id="newPassword" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                     <div>
                        <label htmlFor="confirmPassword"className="block text-sm font-medium text-slate-700">Confirmar Nueva Contraseña</label>
                        <input id="confirmPassword" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm" />
                    </div>
                    {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{error}</p></div>}
                    <div>
                        <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-700">
                            Cambiar Contraseña
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const savedUser = localStorage.getItem(SESSION_USER_KEY);
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (error) {
            console.error("Could not read user from localStorage", error);
            return null;
        }
    });
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isAdminSelectingProfile, setIsAdminSelectingProfile] = useState(false);
    const [adminUser, setAdminUser] = useState<User | null>(null);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('resetToken');
        if (token) {
            const allUsersData = localStorage.getItem(USERS_KEY);
            const allUsers: User[] = allUsersData ? JSON.parse(allUsersData) : [];
            const userWithToken = allUsers.find(u => u.resetPasswordToken === token && u.resetPasswordExpires && u.resetPasswordExpires > Date.now());
            if (userWithToken) {
                setPasswordResetToken(token);
            } else {
                alert("El enlace para restablecer la contraseña es inválido o ha expirado.");
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, []);

    useEffect(() => {
        // Pre-populate with default users if none exist to solve the initial login problem for the admin.
        try {
            const allUsersData = localStorage.getItem(USERS_KEY);
            if (!allUsersData || JSON.parse(allUsersData).length === 0) {
                const defaultUsers: User[] = [
                    { id: crypto.randomUUID(), nombreCompleto: 'Subdirección Admin', email: 'subdi@lir.cl', rut: '11.111.111-1', profile: Profile.SUBDIRECCION, fotoUrl: '' },
                    { id: crypto.randomUUID(), nombreCompleto: 'Coordinación TP', email: 'cordi@lir.cl', rut: '22.222.222-2', profile: Profile.COORDINACION_TP, fotoUrl: '' },
                    { id: crypto.randomUUID(), nombreCompleto: 'Estudiante Demo', email: 'est@lir.cl', rut: '33.333.333-3', profile: Profile.ESTUDIANTE, curso: '4° Medio D', fotoUrl: '' },
                    { id: crypto.randomUUID(), nombreCompleto: 'Profesor Demo', email: 'prof@lir.cl', rut: '44.444.444-4', profile: Profile.PROFESORADO, fotoUrl: '' },
                ];
                localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
            }
        } catch (e) {
            console.error("Failed to initialize default users", e);
        }
    }, []);

    useEffect(() => {
        try {
            if (currentUser) {
                localStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
            } else {
                localStorage.removeItem(SESSION_USER_KEY);
            }
        } catch (error) {
            console.error("Could not write user to localStorage", error);
        }
    }, [currentUser]);
    
    useEffect(() => {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('lir-theme');
    }, []);
    
    const refreshUnreadCount = useCallback(() => {
        if (!currentUser) {
            setUnreadMessagesCount(0);
            return;
        }
        try {
            const allMessagesData = localStorage.getItem(MENSAJES_KEY);
            const allMessages: MensajeInterno[] = allMessagesData ? JSON.parse(allMessagesData) : [];
            
            const readStatusData = localStorage.getItem(`${READ_STATUS_KEY}-${currentUser.id}`);
            const readStatus: ReadStatus = readStatusData ? JSON.parse(readStatusData) : { announcements: [], messages: [] };
            
            const myUnreadMessages = allMessages.filter(msg => 
                msg.para === currentUser.email && !readStatus.messages.includes(msg.id)
            );
            setUnreadMessagesCount(myUnreadMessages.length);
        } catch (e) {
            console.error("Failed to refresh unread message count", e);
            setUnreadMessagesCount(0);
        }
    }, [currentUser]);

    useEffect(() => {
        refreshUnreadCount();
    }, [refreshUnreadCount]);

    const handleLoginAttempt = (email: string, pass: string) => {
        setLoginError(null);

        const allUsersData = localStorage.getItem(USERS_KEY);
        const allUsers: User[] = allUsersData ? JSON.parse(allUsersData) : [];
        
        const foundUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!foundUser) {
            setLoginError('Credenciales incorrectas.');
            return;
        }

        const isPasswordCorrect = (foundUser.password && foundUser.password.length > 0)
            ? pass === foundUser.password
            : pass === PASSWORD;

        if (!isPasswordCorrect) {
            setLoginError('Credenciales incorrectas.');
            return;
        }


        if (foundUser.email.toLowerCase() === 'subdi@lir.cl') {
            setAdminUser(foundUser);
            setIsAdminSelectingProfile(true);
        } else {
            setCurrentUser(foundUser);
        }
    };
    
    const handleProfileSelectForAdmin = (profile: Profile) => {
         if (!adminUser) {
             setLoginError("Error de sesión de administrador. Por favor, inicie sesión de nuevo.");
             setIsAdminSelectingProfile(false);
             return;
         }

         const sessionUser: User = {
             ...adminUser,
             profile: profile,
         };
         
         setCurrentUser(sessionUser);
         setIsAdminSelectingProfile(false);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setAdminUser(null);
        setIsAdminSelectingProfile(false);
        setUnreadMessagesCount(0);
    };

    const handleChangeProfile = () => {
        setCurrentUser(null);
        setIsAdminSelectingProfile(true);
    };

    const handleUserUpdate = useCallback((updatedUser: User) => {
        setCurrentUser(updatedUser);
    }, []);

    const handleForgotPasswordRequest = (email: string) => {
        const allUsersData = localStorage.getItem(USERS_KEY);
        const allUsers: User[] = allUsersData ? JSON.parse(allUsersData) : [];
        const userIndex = allUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

        if (userIndex > -1) {
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600000; // 1 hora de validez

            allUsers[userIndex].resetPasswordToken = token;
            allUsers[userIndex].resetPasswordExpires = expires;

            localStorage.setItem(USERS_KEY, JSON.stringify(allUsers));
            
            const resetLink = `${window.location.origin}${window.location.pathname}?resetToken=${token}`;
            console.log("==================================================");
            console.log("ENLACE DE RECUPERACIÓN DE CONTRASEÑA (SIMULADO)");
            console.log("En una aplicación real, este enlace se enviaría por correo electrónico.");
            console.log(resetLink);
            console.log("==================================================");
        }
    };

    const handleResetPassword = (token: string, newPass: string) => {
        const allUsersData = localStorage.getItem(USERS_KEY);
        const allUsers: User[] = allUsersData ? JSON.parse(allUsersData) : [];
        const userIndex = allUsers.findIndex(u => u.resetPasswordToken === token);

        if (userIndex > -1) {
            allUsers[userIndex].password = newPass;
            delete allUsers[userIndex].resetPasswordToken;
            delete allUsers[userIndex].resetPasswordExpires;
            localStorage.setItem(USERS_KEY, JSON.stringify(allUsers));

            alert("Contraseña actualizada con éxito. Ahora puede iniciar sesión con su nueva contraseña.");
            setPasswordResetToken(null);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            alert("Error al restablecer la contraseña. El token podría ser inválido o haber expirado.");
        }
    };

    const renderContent = () => {
        if (passwordResetToken) {
            return <ResetPasswordForm token={passwordResetToken} onReset={handleResetPassword} />;
        }
        if (currentUser) {
            return (
                <Dashboard 
                    currentUser={currentUser} 
                    onLogout={handleLogout} 
                    onUserUpdate={handleUserUpdate} 
                    onChangeProfile={handleChangeProfile}
                    unreadMessagesCount={unreadMessagesCount}
                    refreshUnreadCount={refreshUnreadCount}
                />
            );
        }
        if (isAdminSelectingProfile) {
            return <ProfileSelector onSelectProfile={handleProfileSelectForAdmin} isAdminView={true} />;
        }
        return <Login onLoginAttempt={handleLoginAttempt} onForgotPasswordRequest={handleForgotPasswordRequest} error={loginError} />;
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            {renderContent()}
        </div>
    );
};

export default App;
import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "./src/firebase";
import { 
    loginUser, 
    logoutUser, 
    resetPassword, 
    getUserProfile 
} from "./src/firebaseHelpers/authHelper"; // <-- Importamos desde el nuevo helper
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ProfileSelector from "./components/ProfileSelector";
import { Profile, User } from "./types";
import { MainLogo } from "./constants";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdminSelectingProfile, setIsAdminSelectingProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  // Permitir a Coordinación TP alternar vista con Profesorado
  const [isCoordSelectingProfile, setIsCoordSelectingProfile] = useState(false);
  const [coordProfile, setCoordProfile] = useState<Profile | null>(null);
  const [oauthSuccess, setOauthSuccess] = useState<string | null>(null);

  // Verificar parámetros de OAuth al cargar
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const userId = urlParams.get('userId');
    const module = urlParams.get('module');
    
    if (authStatus === 'success' && userId) {
      setOauthSuccess('¡Autorización de Google Slides completada exitosamente!');
      
      // Limpiar los parámetros de la URL después de 3 segundos
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        setOauthSuccess(null);
      }, 3000);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userProfile = await getUserProfile(user.email!);
          if (userProfile) {
            setFirestoreUser(userProfile);
            if (userProfile.profile === Profile.SUBDIRECCION) {
              setIsAdminSelectingProfile(true);
            } else if (userProfile.profile === Profile.COORDINACION_TP) {
              // Para coordinación TP, restaurar última vista efectiva si existe
              const saved = localStorage.getItem(`lir-effective-profile-${user.email}`) as Profile | null;
              if (saved === Profile.PROFESORADO || saved === Profile.COORDINACION_TP) {
                setCoordProfile(saved);
                setIsCoordSelectingProfile(false);
              } else {
                // Ofrecer selector entre Coordinación y Profesorado al primer ingreso
                setIsCoordSelectingProfile(true);
              }
            }
          } else {
            setLoginError("Usuario no encontrado en la base de datos. Contacte al administrador.");
            await logoutUser();
          }
        } catch (error) {
          setLoginError("Error al conectar con la base de datos.");
          await logoutUser();
        }
      } else {
        // Limpiar estado cuando no hay usuario
        setFirestoreUser(null);
        setAdminProfile(null);
        setIsAdminSelectingProfile(false);
  setLoginError(null);
  setIsCoordSelectingProfile(false);
  setCoordProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginAttempt = async (email: string, password: string) => {
    setLoginError(null);
    if (!email.trim() || !password.trim()) {
      setLoginError('Por favor ingrese email y contraseña');
      return;
    }
    try {
      await loginUser(email.trim(), password);
      // El onAuthStateChanged se encargará del resto
    } catch (error: any) {
      // Mapeo de errores comunes para mensajes amigables
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setLoginError('Credenciales inválidas. Verifique su email y contraseña.');
          break;
        case 'auth/too-many-requests':
          setLoginError('Demasiados intentos fallidos. Intente más tarde.');
          break;
        case 'auth/network-request-failed':
          setLoginError('Error de conexión. Verifique su internet.');
          break;
        default:
          setLoginError('Ocurrió un error al intentar iniciar sesión.');
      }
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      await resetPassword(email);
      // La UI en Login.tsx se encargará de mostrar el mensaje de éxito
    } catch (error: any) {
       console.error('Error al enviar email de recuperación:', error);
       // La UI en Login.tsx puede manejar el error si es necesario
    }
  };

  const handleProfileSelectForAdmin = (profile: Profile) => {
    setAdminProfile(profile);
    setIsAdminSelectingProfile(false);
  };

  const handleChangeProfile = () => {
    if (firestoreUser?.profile === Profile.SUBDIRECCION) {
      setIsAdminSelectingProfile(true);
      setAdminProfile(null);
    } else if (firestoreUser?.profile === Profile.COORDINACION_TP) {
      setIsCoordSelectingProfile(true);
      setCoordProfile(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="mb-4 flex justify-center items-center"><MainLogo /></div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Inicializando aplicación...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !firestoreUser) {
    return <Login onLoginAttempt={handleLoginAttempt} onForgotPasswordRequest={handleForgotPassword} error={loginError} />;
  }

  if (isAdminSelectingProfile && firestoreUser.profile === Profile.SUBDIRECCION) {
    return <ProfileSelector onSelectProfile={handleProfileSelectForAdmin} isAdminView={true} />;
  }
  // Selector para Coordinación TP: restringido a Coordinación y Profesorado
  if (isCoordSelectingProfile && firestoreUser.profile === Profile.COORDINACION_TP) {
    const allowed: Profile[] = [Profile.COORDINACION_TP, Profile.PROFESORADO];
    return <ProfileSelector onSelectProfile={(p) => { setCoordProfile(p); setIsCoordSelectingProfile(false); if (currentUser?.email) localStorage.setItem(`lir-effective-profile-${currentUser.email}`, p); }} isAdminView={true} allowedProfiles={allowed} />;
  }
  
  const effectiveProfile = adminProfile || coordProfile || firestoreUser.profile;
  return (
    <>
      {/* Notificación de éxito de OAuth */}
      {oauthSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span>{oauthSuccess}</span>
        </div>
      )}
      
      <Dashboard
        currentUser={{ ...firestoreUser, profile: effectiveProfile }}
        onLogout={handleLogout}
        onChangeProfile={(firestoreUser.profile === Profile.SUBDIRECCION || firestoreUser.profile === Profile.COORDINACION_TP) ? handleChangeProfile : undefined}
        canChangeProfile={firestoreUser.profile === Profile.SUBDIRECCION || firestoreUser.profile === Profile.COORDINACION_TP}
      />
    </>
  );
};

export default App;
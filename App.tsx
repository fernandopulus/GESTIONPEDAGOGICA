import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "./src/firebase";
import { doc, getDoc } from "firebase/firestore";
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

  useEffect(() => {
    console.log('🔄 Iniciando listener de Auth...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        console.log('🔄 Auth state changed:', user?.email || 'No user');
        setCurrentUser(user);
        
        if (!user) {
          console.log('🚪 Usuario no autenticado, limpiando estado');
          setFirestoreUser(null);
          setAdminProfile(null);
          setIsAdminSelectingProfile(false);
          setLoginError(null);
        } else {
          console.log('🔄 Cargando datos de Firestore para:', user.email);
          
          try {
            const ref = doc(db, "usuarios", user.email!);
            const snap = await getDoc(ref);
            
            if (snap.exists()) {
              const userData = { 
                id: user.email!, 
                ...snap.data() 
              } as User;
              
              console.log('✅ Datos de usuario cargados:', {
                nombre: userData.nombreCompleto,
                profile: userData.profile,
                email: userData.email
              });
              
              setFirestoreUser(userData);
              setLoginError(null);
              
              if (userData.profile === Profile.SUBDIRECCION) {
                console.log('👑 Usuario SUBDIRECCION detectado, habilitando selector de perfil');
                setIsAdminSelectingProfile(true);
              }
            } else {
              console.log('❌ Usuario no encontrado en Firestore para:', user.email);
              setFirestoreUser(null);
              setLoginError("Usuario no encontrado en la base de datos. Contacte al administrador.");
              await signOut(auth);
            }
          } catch (firestoreError) {
            console.error('❌ Error específico de Firestore:', firestoreError);
            setFirestoreUser(null);
            setLoginError("Error al conectar con la base de datos. Verifique su conexión.");
          }
        }
      } catch (error) {
        console.error('❌ Error general en Auth state change:', error);
        setFirestoreUser(null);
        setCurrentUser(null);
        setLoginError("Error de autenticación. Intente nuevamente.");
      } finally {
        setAuthLoading(false);
        console.log('✅ Auth inicialización completada');
      }
    });

    return () => {
      console.log('🔄 Limpiando listener de Auth');
      unsubscribe();
    };
  }, []);

const handleLoginAttempt = async (email: string, password: string) => {
  setLoginError(null);
  if (!email.trim() || !password.trim()) {
    setLoginError('Por favor ingrese email y contraseña');
    return;
  }
  try {
    console.log('🔄 Intentando login para:', email);
    
    // CAMBIO: Solo autenticar, no verificar Firestore aquí
    await signInWithEmailAndPassword(auth, email.trim(), password);
    console.log('✅ Login exitoso');
    
    // La verificación de Firestore se hará automáticamente en useEffect
    // cuando onAuthStateChanged detecte al usuario autenticado
    
  } catch (error: any) {
    console.error('❌ Error de login:', error);
    switch (error.code) {
      case 'auth/user-not-found':
        setLoginError('No existe una cuenta con este correo electrónico');
        break;
      case 'auth/wrong-password':
        setLoginError('Contraseña incorrecta');
        break;
      case 'auth/invalid-email':
        setLoginError('Formato de correo electrónico inválido');
        break;
      case 'auth/too-many-requests':
        setLoginError('Demasiados intentos fallidos. Intente más tarde o restablezca su contraseña');
        break;
      case 'auth/network-request-failed':
        setLoginError('Error de conexión. Verifique su internet');
        break;
      case 'auth/invalid-credential':
        setLoginError('Credenciales inválidas. Verifique su email y contraseña');
        break;
      default:
        setLoginError(`Error de autenticación: ${error.message}`);
    }
  }
};

  const handleForgotPassword = async (email: string) => {
    try {
      console.log('🔄 Enviando email de recuperación a:', email);
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Email de recuperación enviado');
      return { success: true, message: 'Email de recuperación enviado correctamente' };
    } catch (error: any) {
      console.error('❌ Error al enviar email de recuperación:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          return { success: false, message: 'No existe una cuenta con este correo' };
        case 'auth/invalid-email':
          return { success: false, message: 'Correo electrónico inválido' };
        default:
          return { success: false, message: 'Error al enviar email de recuperación' };
      }
    }
  };

  const handleProfileSelectForAdmin = (profile: Profile) => {
    console.log('👑 Admin seleccionó perfil:', profile);
    setAdminProfile(profile);
    setIsAdminSelectingProfile(false);
  };

  const handleChangeProfile = () => {
    console.log('🔄 Admin solicita cambiar de perfil, volviendo al selector.');
    setIsAdminSelectingProfile(true);
    setAdminProfile(null);
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Cerrando sesión...');
      await signOut(auth);
      setCurrentUser(null);
      setFirestoreUser(null);
      setAdminProfile(null);
      setIsAdminSelectingProfile(false);
      setLoginError(null);
      console.log('✅ Sesión cerrada exitosamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="mb-4 flex justify-center items-center"><MainLogo /></div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Inicializando aplicación...</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">Verificando autenticación y permisos</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (loginError && !currentUser) {
      return <Login onLoginAttempt={handleLoginAttempt} onForgotPasswordRequest={handleForgotPassword} error={loginError} />;
    }
    if (currentUser && isAdminSelectingProfile && firestoreUser?.profile === Profile.SUBDIRECCION) {
      return <ProfileSelector onSelectProfile={handleProfileSelectForAdmin} isAdminView={true} />;
    }
    if (currentUser && firestoreUser) {
      const effectiveProfile = adminProfile || firestoreUser.profile;
      console.log('🎯 Renderizando Dashboard para:', { user: firestoreUser.nombreCompleto, originalProfile: firestoreUser.profile, effectiveProfile: effectiveProfile });
      return (
        <Dashboard
          currentUser={{ ...firestoreUser, profile: effectiveProfile }}
          onLogout={handleLogout}
          onChangeProfile={firestoreUser.profile === Profile.SUBDIRECCION ? handleChangeProfile : undefined}
          canChangeProfile={firestoreUser.profile === Profile.SUBDIRECCION}
        />
      );
    }
    if (currentUser && !firestoreUser) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
          <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="mb-4 text-red-500">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Error de datos de usuario</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">No se pudieron cargar los datos del usuario desde la base de datos.</p>
            <button onClick={handleLogout} className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors">Volver al Login</button>
          </div>
        </div>
      );
    }
    return <Login onLoginAttempt={handleLoginAttempt} onForgotPasswordRequest={handleForgotPassword} error={loginError} />;
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {renderContent()}
    </div>
  );
};

export default App;
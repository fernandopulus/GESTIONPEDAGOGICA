import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "./src/firebase"; // ajusta el path según corresponda
import { doc, getDoc } from "firebase/firestore";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ProfileSelector from "./components/ProfileSelector";
import { Profile, User } from "./types";
import { MainLogo } from "./constants";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // ← ESTADO CLAVE AGREGADO
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdminSelectingProfile, setIsAdminSelectingProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // ← EFECTO PRINCIPAL: Mantiene sesión con Firebase (MODIFICADO)
  useEffect(() => {
    console.log('🔄 Iniciando listener de Auth...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        console.log('🔄 Auth state changed:', user?.email || 'No user');
        setCurrentUser(user);
        
        if (!user) {
          setFirestoreUser(null);
          setAdminProfile(null);
          setIsAdminSelectingProfile(false);
        } else {
          // ← CARGAR DATOS DE FIRESTORE AQUÍ MISMO
          console.log('🔄 Cargando datos de Firestore para:', user.email);
          
          const ref = doc(db, "usuarios", user.email!);
          const snap = await getDoc(ref);
          
          if (snap.exists()) {
            const userData = snap.data() as User;
            console.log('✅ Datos de usuario cargados:', userData.nombreCompleto);
            setFirestoreUser(userData);
            
            // Si es SUBDIRECCION, habilita selección de perfil
            if (userData.profile === Profile.SUBDIRECCION) {
              setIsAdminSelectingProfile(true);
            }
          } else {
            console.log('❌ Usuario no encontrado en Firestore');
            setFirestoreUser(null);
            setLoginError("Usuario no encontrado en la base de datos");
          }
        }
      } catch (error) {
        console.error('❌ Error al cargar datos del usuario:', error);
        setFirestoreUser(null);
        setLoginError("Error al cargar datos del usuario");
      } finally {
        // ← IMPORTANTE: Solo aquí marcamos Auth como listo
        setAuthLoading(false);
        console.log('✅ Auth inicialización completada');
      }
    });

    return () => {
      console.log('🔄 Limpiando listener de Auth');
      unsubscribe();
    };
  }, []);

  // ← ELIMINAR EL SEGUNDO useEffect (ya no es necesario)
  // El código de carga de Firestore ahora está en el useEffect principal

  // ← LÓGICA DE LOGIN (MEJORADA)
  const handleLoginAttempt = async (email: string, password: string) => {
    setLoginError(null);
    try {
      console.log('🔄 Intentando login para:', email);
      await signInWithEmailAndPassword(auth, email, password);
      // El onAuthStateChanged se encargará del resto
    } catch (error: any) {
      console.error('❌ Error de login:', error);
      
      // ← MENSAJES DE ERROR MÁS ESPECÍFICOS
      switch (error.code) {
        case 'auth/user-not-found':
          setLoginError('No existe una cuenta con este correo electrónico');
          break;
        case 'auth/wrong-password':
          setLoginError('Contraseña incorrecta');
          break;
        case 'auth/invalid-email':
          setLoginError('Correo electrónico inválido');
          break;
        case 'auth/too-many-requests':
          setLoginError('Demasiados intentos fallidos. Intente más tarde');
          break;
        default:
          setLoginError('Credenciales incorrectas o usuario no registrado');
      }
    }
  };

  // ← FUNCIÓN DE RECUPERACIÓN DE CONTRASEÑA (AGREGADA)
  const handleForgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Email de recuperación enviado a:', email);
    } catch (error: any) {
      console.error('❌ Error al enviar email de recuperación:', error);
    }
  };

  // Cambia perfil para admin
  const handleProfileSelectForAdmin = (profile: Profile) => {
    setAdminProfile(profile);
    setIsAdminSelectingProfile(false);
  };

  // Cierra sesión
  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setFirestoreUser(null);
    setAdminProfile(null);
    setIsAdminSelectingProfile(false);
  };

  // ← PANTALLA DE CARGA MIENTRAS AUTH SE INICIALIZA (AGREGADA)
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="mb-4 flex justify-center items-center">
            <MainLogo />
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Inicializando aplicación...</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">Verificando autenticación y permisos</p>
        </div>
      </div>
    );
  }

  // Renderizado de contenido según estado de sesión
  const renderContent = () => {
    if (currentUser && isAdminSelectingProfile && firestoreUser?.profile === Profile.SUBDIRECCION) {
      return (
        <ProfileSelector
          onSelectProfile={handleProfileSelectForAdmin}
          isAdminView={true}
        />
      );
    }
    if (currentUser && firestoreUser) {
      // Si se seleccionó un perfil alternativo, pásalo al Dashboard
      return (
        <Dashboard
          currentUser={{
            ...firestoreUser,
            profile: adminProfile || firestoreUser.profile,
          }}
          onLogout={handleLogout}
          // Pasa props extra según tu diseño
        />
      );
    }
    return (
      <Login 
        onLoginAttempt={handleLoginAttempt} 
        onForgotPasswordRequest={handleForgotPassword} // ← AGREGADA
        error={loginError} 
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Puedes agregar un header/logo si quieres */}
      {renderContent()}
    </div>
  );
};

export default App;
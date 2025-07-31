import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./src/firebase"; // Ajusta si tu firebase.ts está en otro lado
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ProfileSelector from "./components/ProfileSelector";
import { Profile, User } from "./types";
import { MainLogo } from "./constants";

const App: React.FC = () => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdminSelectingProfile, setIsAdminSelectingProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // Mantiene sesión con Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Al autenticar, carga perfil extendido desde Firestore
  useEffect(() => {
    const fetchProfile = async () => {
      if (!firebaseUser) {
        setUserProfile(null);
        return;
      }
      setLoadingProfile(true);
      try {
        const userDoc = doc(db, "usuarios", firebaseUser.email!); // Usa email como ID del doc
        const snap = await getDoc(userDoc);
        if (snap.exists()) {
          setUserProfile(snap.data() as User);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        setUserProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [firebaseUser]);

  // Lógica de login
  const handleLoginAttempt = async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El efecto de arriba buscará el perfil Firestore automáticamente
      if (email.toLowerCase() === "subdi@lir.cl") {
        setIsAdminSelectingProfile(true);
      } else {
        setIsAdminSelectingProfile(false);
      }
    } catch (error: any) {
      setLoginError("Credenciales incorrectas o usuario no registrado.");
    }
  };

  // Cambia perfil para admin
  const handleProfileSelectForAdmin = (profile: Profile) => {
    setAdminProfile(profile);
    setIsAdminSelectingProfile(false);
    // Aquí podrías actualizar el perfil en Firestore si lo deseas
  };

  // Cierra sesión
  const handleLogout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setUserProfile(null);
    setAdminProfile(null);
    setIsAdminSelectingProfile(false);
  };

  // Renderizado de contenido según estado de sesión
  const renderContent = () => {
    if (!firebaseUser) {
      return <Login onLoginAttempt={handleLoginAttempt} error={loginError} />;
    }
    if (loadingProfile) {
      return <div className="p-12 text-center text-slate-700">Cargando perfil de usuario...</div>;
    }
    if (!userProfile) {
      return (
        <div className="p-12 text-center text-red-600">
          No existe un perfil en Firestore para este usuario.<br />
          Solicita acceso o que el administrador cree tu perfil en <b>usuarios</b>.<br />
          Email: {firebaseUser.email}
        </div>
      );
    }
    if (firebaseUser && isAdminSelectingProfile) {
      return (
        <ProfileSelector
          onSelectProfile={handleProfileSelectForAdmin}
          isAdminView={true}
        />
      );
    }
    return (
      <Dashboard
        currentUser={{
          ...userProfile,
          profile: adminProfile || userProfile.profile // Permite cambiar de perfil si eres admin
        }}
        onLogout={handleLogout}
        // Pasa otros props que necesites
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {renderContent()}
    </div>
  );
};

export default App;

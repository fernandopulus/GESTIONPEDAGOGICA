import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "./src/firebase"; // ← CORRECTO si App.tsx está en raíz y firebase.ts en src/
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ProfileSelector from "./components/ProfileSelector";
import { Profile } from "./types";
import { MainLogo } from "./constants";


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdminSelectingProfile, setIsAdminSelectingProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // Mantiene sesión con Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Lógica de login con Firebase Auth
  const handleLoginAttempt = async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);

      // Si el usuario es subdirección, solicita selección de perfil
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
    setCurrentUser(null);
    setAdminProfile(null);
    setIsAdminSelectingProfile(false);
  };

  // Renderizado de contenido según estado de sesión
  const renderContent = () => {
    if (currentUser && isAdminSelectingProfile) {
      return (
        <ProfileSelector
          onSelectProfile={handleProfileSelectForAdmin}
          isAdminView={true}
        />
      );
    }
    if (currentUser) {
      return (
        <Dashboard
          currentUser={currentUser}
          adminProfile={adminProfile}
          onLogout={handleLogout}
          // Aquí puedes pasar más props según necesites
        />
      );
    }
    return (
      <Login onLoginAttempt={handleLoginAttempt} error={loginError} />
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

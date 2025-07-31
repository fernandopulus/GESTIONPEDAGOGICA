import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdminSelectingProfile, setIsAdminSelectingProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // Mantiene sesión con Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setFirestoreUser(null);
        setAdminProfile(null);
        setIsAdminSelectingProfile(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Carga el usuario extendido desde Firestore cada vez que cambia currentUser
  useEffect(() => {
    const fetchFirestoreUser = async () => {
      if (currentUser?.email) {
        const ref = doc(db, "usuarios", currentUser.email);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setFirestoreUser(snap.data() as User);
          // Si es SUBDIRECCION, habilita selección de perfil
          if ((snap.data() as User).profile === Profile.SUBDIRECCION) {
            setIsAdminSelectingProfile(true);
          }
        } else {
          setFirestoreUser(null);
        }
      }
    };
    fetchFirestoreUser();
  }, [currentUser]);

  // Lógica de login con Firebase Auth
  const handleLoginAttempt = async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El flujo de selección de perfil ahora se maneja en useEffect arriba,
      // basado en los datos de Firestore
    } catch (error: any) {
      setLoginError("Credenciales incorrectas o usuario no registrado.");
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

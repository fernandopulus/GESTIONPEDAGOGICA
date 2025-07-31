import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./src/firebase"; // Ajusta el path si es necesario
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { Profile, User } from "./types";

const App: React.FC = () => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // <--- tu modelo de usuario con perfil
  const [loginError, setLoginError] = useState<string | null>(null);

  // Mantiene la sesión con Firebase y carga el usuario Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setCurrentUser(null);
      if (user && user.email) {
        // Busca el documento de usuario en Firestore
        const userDoc = await getDoc(doc(db, "usuarios", user.email));
        if (userDoc.exists()) {
          setCurrentUser(userDoc.data() as User);
        } else {
          setLoginError("Usuario no registrado en base de datos interna.");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Lógica de login con Firebase Auth
  const handleLoginAttempt = async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El listener de onAuthStateChanged se encargará de buscar en Firestore
    } catch (error: any) {
      setLoginError("Credenciales incorrectas o usuario no registrado.");
    }
  };

  // Lógica de logout
  const handleLogout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setCurrentUser(null);
  };

  // Renderiza según el estado de la sesión
  const renderContent = () => {
    if (!firebaseUser) return <Login onLoginAttempt={handleLoginAttempt} error={loginError} />;
    if (!currentUser) return <div className="p-12 text-center text-lg">Cargando usuario...</div>;
    return (
      <Dashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        // Puedes agregar más props si tu Dashboard lo requiere
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

import React, { useState, useEffect } from 'react';
import { AsistenciaDual, User } from '../../types';
import { CURSOS_DUAL } from '../../constants';
import {
    subscribeToPersonalAsistencia,
    addAsistenciaRecord,
} from '../../src/firebaseHelpers/asistenciaEmpresaHelper'; // AJUSTA la ruta a tu nuevo helper

// --- Icon Components ---
const EntryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
    </svg>
);
const ExitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-4.293a1 1 0 001.414 1.414L10 12.414l2.293 2.293a1 1 0 001.414-1.414L11.414 11l2.293-2.293a1 1 0 00-1.414-1.414L10 9.586 7.707 7.293a1 1 0 00-1.414 1.414L8.586 11 6.293 13.293a1 1 0 000 1.414z" clipRule="evenodd" />
    </svg>
);


interface AsistenciaEmpresaProps {
    currentUser: User;
}

const AsistenciaEmpresa: React.FC<AsistenciaEmpresaProps> = ({ currentUser }) => {
    const [selectedCurso, setSelectedCurso] = useState<string>(currentUser.curso || '');
    const [historial, setHistorial] = useState<AsistenciaDual[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [dataLoading, setDataLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (!currentUser.email) {
            setDataLoading(false);
            return;
        }

        setDataLoading(true);
        const unsubscribe = subscribeToPersonalAsistencia(currentUser.email, (data) => {
            setHistorial(data);
            setDataLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser.email]);

    const handleMarcar = (tipo: 'Entrada' | 'Salida') => {
        if (!selectedCurso) {
            setMessage({ text: 'Por favor, seleccione su curso antes de marcar.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const newRecord: Omit<AsistenciaDual, 'id'> = {
                    nombreEstudiante: currentUser.nombreCompleto,
                    emailEstudiante: currentUser.email,
                    curso: selectedCurso,
                    tipo: tipo,
                    fechaHora: new Date().toISOString(),
                    ubicacion: {
                        latitud: position.coords.latitude,
                        longitud: position.coords.longitude,
                    },
                };

                try {
                    await addAsistenciaRecord(newRecord);
                    setMessage({ text: `¡Marca de ${tipo} registrada con éxito!`, type: 'success' });
                } catch (error) {
                    console.error("Error saving record to Firestore:", error);
                    setMessage({ text: 'No se pudo guardar el registro en la nube.', type: 'error' });
                } finally {
                    setLoading(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                let errorMessage = 'No se pudo obtener la ubicación.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Permiso de ubicación denegado. Por favor, habilite la ubicación en su navegador y dispositivo.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'La información de ubicación no está disponible en este momento. Verifique su conexión y GPS.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'La solicitud de ubicación ha tardado demasiado. Inténtelo de nuevo en un lugar con mejor señal.';
                        break;
                    default:
                        errorMessage = `Ocurrió un error desconocido al obtener la ubicación (código: ${error.code}).`;
                        break;
                }
                setMessage({ text: errorMessage, type: 'error' });
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Asistencia a Empresa</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Registre su entrada y salida de la empresa de práctica.</p>

                <div className="space-y-4 max-w-md mx-auto">
                    <div>
                        <label htmlFor="curso" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Seleccione su curso</label>
                        <select
                            id="curso"
                            value={selectedCurso}
                            onChange={(e) => setSelectedCurso(e.target.value)}
                            className="w-full border-slate-300 rounded-md shadow-sm text-lg p-2 dark:bg-slate-700 dark:border-slate-600"
                        >
                            <option value="">-- Mi curso --</option>
                            {CURSOS_DUAL.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <button
                            onClick={() => handleMarcar('Entrada')}
                            disabled={loading || !selectedCurso}
                            className="bg-green-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center text-xl transition-all"
                        >
                            Entrada
                        </button>
                        <button
                            onClick={() => handleMarcar('Salida')}
                            disabled={loading || !selectedCurso}
                            className="bg-red-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-red-700 disabled:bg-slate-400 flex items-center justify-center text-xl transition-all"
                        >
                            Salida
                        </button>
                    </div>
                    
                    {loading && (
                        <div className="text-center text-slate-600 dark:text-slate-400 pt-4 flex items-center justify-center gap-2">
                             <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Obteniendo ubicación...</span>
                        </div>
                    )}

                    {message && (
                        <div className={`text-center p-3 rounded-md mt-4 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Mi Historial de Asistencia</h2>
                <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha y Hora</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Curso</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {dataLoading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-slate-500">Cargando historial...</td>
                                </tr>
                            ) : historial.length > 0 ? historial.map(record => (
                                <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {new Date(record.fechaHora).toLocaleString('es-CL')}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-3 py-1 inline-flex items-center gap-1.5 text-xs leading-5 font-semibold rounded-full ${record.tipo === 'Entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {record.tipo === 'Entrada' ? <EntryIcon /> : <ExitIcon />}
                                            {record.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{record.curso}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                                        No tienes marcas de asistencia registradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AsistenciaEmpresa;

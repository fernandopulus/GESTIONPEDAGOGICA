import React, { useState, useEffect } from 'react';
import { AsistenciaDual, User } from '../../types';
import { CURSOS_DUAL } from '../../constants';

// Storage keys
const SHARED_ATTENDANCE_KEY = 'asistenciaDualRecords';

interface AsistenciaEmpresaProps {
    currentUser: User;
}

const AsistenciaEmpresa: React.FC<AsistenciaEmpresaProps> = ({ currentUser }) => {
    const [selectedCurso, setSelectedCurso] = useState<string>(currentUser.curso || '');
    const [historial, setHistorial] = useState<AsistenciaDual[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const PERSONAL_ATTENDANCE_KEY = `asistenciaPersonalDual-${currentUser.id}`;

    useEffect(() => {
        try {
            const data = localStorage.getItem(PERSONAL_ATTENDANCE_KEY);
            if (data) {
                setHistorial(JSON.parse(data));
            }
        } catch (e) {
            console.error("Error al cargar historial de asistencia", e);
            setMessage({ text: 'No se pudo cargar el historial local.', type: 'error' });
        }
    }, [PERSONAL_ATTENDANCE_KEY]);

    const persistRecords = (newRecord: AsistenciaDual) => {
        // Update personal history
        const updatedPersonalHistory = [newRecord, ...historial];
        setHistorial(updatedPersonalHistory);
        localStorage.setItem(PERSONAL_ATTENDANCE_KEY, JSON.stringify(updatedPersonalHistory));

        // Update shared history for coordinator
        try {
            const sharedData = localStorage.getItem(SHARED_ATTENDANCE_KEY);
            const sharedHistory = sharedData ? JSON.parse(sharedData) : [];
            const updatedSharedHistory = [newRecord, ...sharedHistory];
            localStorage.setItem(SHARED_ATTENDANCE_KEY, JSON.stringify(updatedSharedHistory));
        } catch (e) {
            console.error("Error al guardar en el historial compartido", e);
            // This is a more critical error as it affects the coordinator's view
            setMessage({ text: 'Se registró su asistencia, pero hubo un problema al notificar a coordinación.', type: 'error' });
        }
    };

    const handleMarcar = (tipo: 'Entrada' | 'Salida') => {
        if (!selectedCurso) {
            setMessage({ text: 'Por favor, seleccione su curso antes de marcar.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newRecord: AsistenciaDual = {
                    id: crypto.randomUUID(),
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

                persistRecords(newRecord);
                setLoading(false);
                setMessage({ text: `¡Marca de ${tipo} registrada con éxito!`, type: 'success' });
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
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Asistencia a Empresa</h1>
                <p className="text-slate-500 mb-6">Registre su entrada y salida de la empresa de práctica.</p>

                <div className="space-y-4 max-w-md mx-auto">
                    <div>
                        <label htmlFor="curso" className="block text-sm font-medium text-slate-600 mb-1">Seleccione su curso</label>
                        <select
                            id="curso"
                            value={selectedCurso}
                            onChange={(e) => setSelectedCurso(e.target.value)}
                            className="w-full border-slate-300 rounded-md shadow-sm text-lg p-2"
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
                        <div className="text-center text-slate-600 pt-4 flex items-center justify-center gap-2">
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

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Mi Historial de Asistencia</h2>
                <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Curso</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {historial.length > 0 ? historial.map(record => (
                                <tr key={record.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {new Date(record.fechaHora).toLocaleString('es-CL')}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.tipo === 'Entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {record.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{record.curso}</td>
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
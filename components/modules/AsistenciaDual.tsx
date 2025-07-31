import React, { useState, useEffect, useMemo } from 'react';
import { AsistenciaDual, User, Profile } from '../../types';
import { CURSOS_DUAL } from '../../constants';

const SHARED_ATTENDANCE_KEY = 'asistenciaDualRecords';
const USERS_KEY = 'usuariosLiceo';

/**
 * Normaliza el nombre de un curso a un formato estándar (ej: "1ºA").
 * Elimina espacios, estandariza ordinales y capitaliza la letra final.
 */
const normalizeCurso = (curso: string): string => {
    if (!curso) return '';
    let normalized = curso.trim().toLowerCase();
    
    // Estandarizar el símbolo de grado (°) al ordinal masculino (º)
    normalized = normalized.replace(/°/g, 'º');

    // Reemplazar " medio", etc.
    normalized = normalized.replace(/\s+(medio|básico|basico)/g, '');
    // Reemplazar 1ro, 2do, 3ro, 4to con 1º, 2º, 3º, 4º
    normalized = normalized.replace(/(\d)(st|nd|rd|th|ro|do|to|er)/, '$1º');
    // Asegura que haya un símbolo de grado si no lo hay
    normalized = normalized.replace(/^(\d)(?![º])/, '$1º');
    // Elimina todos los espacios y pone en mayúscula la parte de la letra
    normalized = normalized.replace(/\s+/g, '').toUpperCase();
    return normalized;
};


// Icons
const EntryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
    </svg>
);
const ExitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" transform="rotate(180 10 10)" />
    </svg>
);


const AsistenciaDual: React.FC = () => {
    const [allRegistros, setAllRegistros] = useState<AsistenciaDual[]>([]);
    const [allStudents, setAllStudents] = useState<User[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCurso, setSelectedCurso] = useState<string>('todos');
    const [studentFilter, setStudentFilter] = useState('');

    useEffect(() => {
        const loadData = () => {
            const data = localStorage.getItem(SHARED_ATTENDANCE_KEY);
            if (data) setAllRegistros(JSON.parse(data));
            const usersData = localStorage.getItem(USERS_KEY);
            if(usersData) setAllStudents(JSON.parse(usersData));
        };
        loadData();
        window.addEventListener('storage', loadData);
        return () => window.removeEventListener('storage', loadData);
    }, []);

    const { monthDays, monthName, year } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return {
            monthDays: new Date(year, month + 1, 0).getDate(),
            monthName: currentDate.toLocaleString('es-CL', { month: 'long' }),
            year: year,
        };
    }, [currentDate]);

    const studentsForCourse = useMemo(() => {
        let filteredStudents = allStudents
            .filter(u => u.profile === Profile.ESTUDIANTE && u.curso && CURSOS_DUAL.includes(normalizeCurso(u.curso)));

        if (selectedCurso !== 'todos') {
            filteredStudents = filteredStudents.filter(u => normalizeCurso(u.curso || '') === selectedCurso);
        }

        if (studentFilter) {
            filteredStudents = filteredStudents.filter(u => u.nombreCompleto.toLowerCase().includes(studentFilter.toLowerCase()));
        }
        
        return filteredStudents.sort((a,b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

    }, [allStudents, selectedCurso, studentFilter]);

    const attendanceData = useMemo(() => {
        const data = new Map<string, Map<number, { entrada?: AsistenciaDual, salida?: AsistenciaDual }>>();
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        
        const registrosFiltrados = allRegistros.filter(r => {
            const recordDate = new Date(r.fechaHora);
            if (recordDate.getMonth() !== month || recordDate.getFullYear() !== year) return false;
            
            if (selectedCurso === 'todos') {
                return CURSOS_DUAL.includes(normalizeCurso(r.curso || ''));
            }
            return normalizeCurso(r.curso || '') === selectedCurso;
        });

        registrosFiltrados.forEach(r => {
            const day = new Date(r.fechaHora).getDate();
            if (!data.has(r.nombreEstudiante)) {
                data.set(r.nombreEstudiante, new Map());
            }
            const studentDayData = data.get(r.nombreEstudiante)!;
            if (!studentDayData.has(day)) {
                studentDayData.set(day, {});
            }
            const dayEntry = studentDayData.get(day)!;

            if (r.tipo === 'Entrada') {
                if (!dayEntry.entrada || new Date(r.fechaHora) < new Date(dayEntry.entrada.fechaHora)) {
                    dayEntry.entrada = r;
                }
            } else if (r.tipo === 'Salida') {
                if (!dayEntry.salida || new Date(r.fechaHora) > new Date(dayEntry.salida.fechaHora)) {
                    dayEntry.salida = r;
                }
            }
        });

        return data;
    }, [allRegistros, currentDate, selectedCurso]);

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + delta);
            return newDate;
        });
    };

    const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-md space-y-6 animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Asistencia Dual Mensual</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                <div className="flex items-center justify-center md:justify-start gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">&lt;</button>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 capitalize w-48 text-center">{`${monthName} ${year}`}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">&gt;</button>
                </div>
                 <select value={selectedCurso} onChange={e => setSelectedCurso(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                    <option value="todos">Todos los Cursos</option>
                    {CURSOS_DUAL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Buscar estudiante..." value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 p-2 border-r border-b border-slate-200 dark:border-slate-600 text-sm font-semibold w-48">Estudiante</th>
                            {Array.from({ length: monthDays }, (_, i) => {
                                const dayDate = new Date(year, currentDate.getMonth(), i + 1);
                                const dayOfWeek = dayDate.getDay();
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                return (
                                    <th key={i} className={`p-1 border-r border-b border-slate-200 dark:border-slate-600 text-xs w-16 ${isWeekend ? 'bg-slate-100 dark:bg-slate-700/50' : ''}`}>
                                        <div className="font-semibold">{weekDays[dayOfWeek]}</div>
                                        <div>{i + 1}</div>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {studentsForCourse.length > 0 ? studentsForCourse.map(student => (
                            <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                <td className="sticky left-0 bg-white dark:bg-slate-800 z-10 p-2 border-r border-b border-slate-200 dark:border-slate-600 text-sm font-medium whitespace-nowrap">{student.nombreCompleto}</td>
                                {Array.from({ length: monthDays }, (_, i) => {
                                    const day = i + 1;
                                    const studentDayRecords = attendanceData.get(student.nombreCompleto)?.get(day);
                                    const dayDate = new Date(year, currentDate.getMonth(), i + 1);
                                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

                                    return (
                                        <td key={day} className={`p-1 border-r border-b border-slate-200 dark:border-slate-600 text-center align-middle ${isWeekend ? 'bg-slate-100 dark:bg-slate-700/50' : ''}`}>
                                            <div className="flex justify-center items-center gap-1.5 h-full">
                                                {studentDayRecords?.entrada && (
                                                    <div
                                                        className="group relative cursor-pointer"
                                                        onClick={() => window.open(`https://www.google.com/maps?q=${studentDayRecords.entrada?.ubicacion.latitud},${studentDayRecords.entrada?.ubicacion.longitud}`, '_blank')}
                                                    >
                                                        <EntryIcon />
                                                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                            {new Date(studentDayRecords.entrada.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                )}
                                                {studentDayRecords?.salida && (
                                                     <div
                                                        className="group relative cursor-pointer"
                                                        onClick={() => window.open(`https://www.google.com/maps?q=${studentDayRecords.salida?.ubicacion.latitud},${studentDayRecords.salida?.ubicacion.longitud}`, '_blank')}
                                                    >
                                                        <ExitIcon />
                                                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                            {new Date(studentDayRecords.salida.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={monthDays + 1} className="text-center p-8 text-slate-500">
                                    No hay estudiantes en el curso seleccionado o que coincidan con la búsqueda.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AsistenciaDual;

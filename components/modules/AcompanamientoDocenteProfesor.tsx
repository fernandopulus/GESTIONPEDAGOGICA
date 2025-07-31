import React, { useState, useEffect, useMemo } from 'react';
import { AcompanamientoDocente, User } from '../../types';
import { RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric, PDFIcon } from '../../constants';
import { 
    subscribeToAcompanamientosByDocente, 
    getRubricaConfiguration 
} from '../../firebaseHelpers/acompanamientoHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type RubricStructure = typeof defaultRubric;

interface BarChartProps {
    data: { label: string; value: number }[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
    const maxValue = 4; // Max score is 4
    
    return (
        <div className="space-y-4">
            {data.map((item, index) => (
                <div key={item.label + index}>
                    <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">
                            {item.label.replace('Dominio A: ', 'A: ').replace('Dominio B: ', 'B: ').replace('Dominio C: ', 'C: ')}
                        </span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                            {item.value.toFixed(2)} / 4.00
                        </span>
                    </div>
                    <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                        <div 
                            className="bg-sky-500 h-4 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(item.value / maxValue) * 100}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

interface AcompanamientoDocenteProfesorProps {
    currentUser: User;
}

const AcompanamientoDocenteProfesor: React.FC<AcompanamientoDocenteProfesorProps> = ({ currentUser }) => {
    const [misAcompanamientos, setMisAcompanamientos] = useState<AcompanamientoDocente[]>([]);
    const [selectedAcompanamiento, setSelectedAcompanamiento] = useState<AcompanamientoDocente | null>(null);
    const [rubrica, setRubrica] = useState<RubricStructure>(defaultRubric);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Cargar rúbrica personalizada
        const loadRubrica = async () => {
            try {
                const rubricaConfig = await getRubricaConfiguration();
                if (rubricaConfig) {
                    setRubrica(rubricaConfig);
                }
            } catch (err) {
                console.error("Error al cargar rúbrica:", err);
                // Si hay error, usar la rúbrica por defecto
            }
        };

        // Suscribirse a los acompañamientos del docente
        const unsubscribe = subscribeToAcompanamientosByDocente(
            currentUser.nombreCompleto,
            (acompanamientos) => {
                setMisAcompanamientos(acompanamientos);
                setLoading(false);
                setError(null);
            },
            (error) => {
                setError(error.message);
                setLoading(false);
            }
        );

        loadRubrica();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [currentUser.nombreCompleto]);
    
    const domainPerformance = useMemo(() => {
        if (!selectedAcompanamiento) return [];

        const scoresByDomain: { [domain: string]: { total: number, count: number } } = {};

        rubrica.forEach(domain => {
            scoresByDomain[domain.domain] = { total: 0, count: 0 };
            domain.criteria.forEach(criterion => {
                const score = selectedAcompanamiento.rubricaResultados[criterion.name];
                if (score) {
                    scoresByDomain[domain.domain].total += score;
                    scoresByDomain[domain.domain].count++;
                }
            });
        });

        return Object.entries(scoresByDomain).map(([label, data]) => ({
            label,
            value: data.count > 0 ? data.total / data.count : 0,
        }));
    }, [selectedAcompanamiento, rubrica]);
    
    const handleExportPDF = (record: AcompanamientoDocente) => {
        const doc = new jsPDF();
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Informe de Acompañamiento Docente', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        autoTable(doc, {
            startY: 30,
            body: [
                ['Docente:', record.docente],
                ['Fecha:', new Date(record.fecha).toLocaleDateString('es-CL')],
                ['Asignatura:', record.asignatura],
                ['Curso:', record.curso],
            ],
            theme: 'plain',
        });

        let finalY = (doc as any).lastAutoTable.finalY + 10;
        
        const addSection = (title: string, content: string) => {
             if (!content) return;
             if (finalY > 250) { doc.addPage(); finalY = 20; }
             doc.setFont('helvetica', 'bold');
             doc.setFontSize(14);
             doc.text(title, 14, finalY);
             finalY += 8;
             
             doc.setFont('helvetica', 'normal');
             doc.setFontSize(11);
             const splitText = doc.splitTextToSize(content.replace(/## /g, '').replace(/(\*\*|\*)/g, ''), 180);
             doc.text(splitText, 14, finalY);
             finalY += splitText.length * 5 + 10;
        };
        
        addSection('Observaciones Generales', record.observacionesGenerales);
        addSection('Retroalimentación Consolidada', record.retroalimentacionConsolidada);

        doc.save(`Acompanamiento_${currentUser.nombreCompleto.replace(/\s/g, '_')}.pdf`);
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in">
                <div className="text-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
                    <p className="mt-4 text-slate-500 dark:text-slate-400">Cargando acompañamientos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in">
                <div className="text-center py-16">
                    <span className="text-5xl">⚠️</span>
                    <h2 className="mt-4 text-xl font-bold text-red-600 dark:text-red-400">Error</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-4 bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    if (selectedAcompanamiento) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <button 
                            onClick={() => setSelectedAcompanamiento(null)} 
                            className="text-sm font-semibold text-slate-500 hover:underline mb-2"
                        >
                            &larr; Volver a mi historial
                        </button>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                            Detalle del Acompañamiento
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {new Date(selectedAcompanamiento.fecha).toLocaleDateString('es-CL', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })} | {selectedAcompanamiento.curso} - {selectedAcompanamiento.asignatura}
                        </p>
                    </div>
                    <button 
                        onClick={() => handleExportPDF(selectedAcompanamiento)} 
                        className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
                    >
                        <PDFIcon /> Exportar PDF
                    </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="prose dark:prose-invert max-w-none prose-slate">
                            <h3>Retroalimentación Consolidada (IA)</h3>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <p className="whitespace-pre-wrap">
                                    {selectedAcompanamiento.retroalimentacionConsolidada || 'No se ha generado retroalimentación.'}
                                </p>
                            </div>
                            <h3>Observaciones Generales</h3>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <p className="whitespace-pre-wrap">
                                    {selectedAcompanamiento.observacionesGenerales || 'Sin observaciones.'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
                            Desempeño por Dominio
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                            <BarChart data={domainPerformance} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                Mis Acompañamientos
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
                Aquí encontrarás el historial de tus observaciones de clase y la retroalimentación asociada.
            </p>
            
            <div className="space-y-4">
                {misAcompanamientos.length > 0 ? (
                    misAcompanamientos.map(record => (
                        <button 
                            key={record.id} 
                            onClick={() => setSelectedAcompanamiento(record)}
                            className="w-full text-left p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">
                                        {record.curso} - {record.asignatura}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Fecha: {new Date(record.fecha).toLocaleDateString('es-CL')}
                                    </p>
                                </div>
                                <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                                    Ver Detalles
                                </span>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="text-center py-16 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-5xl">👍</span>
                        <h2 className="mt-4 text-xl font-bold text-slate-700 dark:text-slate-300">
                            Sin Registros
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">
                            Aún no tienes acompañamientos de clase registrados.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AcompanamientoDocenteProfesor;
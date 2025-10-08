import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AcompanamientoDocente, User } from '../../types';
import { RUBRICA_ACOMPANAMIENTO_DOCENTE as defaultRubric, PDFIcon } from '../../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    getAcompanamientosByDocente,
    getAcompanamientosByEmail,
    getRubricaPersonalizada,
} from '../../src/firebaseHelpers/acompanamientos'; // ← RUTA CORRECTA
import CiclosOPRList from './CiclosOPRList';

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
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{item.label.replace('Dominio A: ', 'A: ').replace('Dominio B: ', 'B: ').replace('Dominio C: ', 'C: ')}</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">{item.value.toFixed(2)} / 4.00</span>
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedAcompanamiento, setSelectedAcompanamiento] = useState<AcompanamientoDocente | null>(null);
    const [rubrica, setRubrica] = useState<RubricStructure>(defaultRubric);

    // Cargar acompañamientos del profesor desde Firestore
    const fetchMisAcompanamientos = useCallback(async () => {
        setLoading(true);
        try {
            // Preferimos filtrar por email si existe en auth/usuarios
            let acompanamientos;
            if (currentUser.email) {
                try {
                    acompanamientos = await getAcompanamientosByEmail(currentUser.email.toLowerCase());
                } catch {
                    acompanamientos = await getAcompanamientosByDocente(currentUser.nombreCompleto);
                }
            } else {
                acompanamientos = await getAcompanamientosByDocente(currentUser.nombreCompleto);
            }
            // Ordenar por fecha más reciente primero
            const sortedAcompanamientos = acompanamientos.sort((a, b) => {
                const da = a.fecha ? new Date(a.fecha).getTime() : 0;
                const db = b.fecha ? new Date(b.fecha).getTime() : 0;
                return db - da;
            });
            setMisAcompanamientos(sortedAcompanamientos);
            setError(null);
        } catch (e) {
            console.error("Error al cargar acompañamientos desde Firestore", e);
            setError("No se pudieron cargar tus acompañamientos desde la nube.");
        } finally {
            setLoading(false);
        }
    }, [currentUser.nombreCompleto]);

    // Cargar rúbrica personalizada si existe
    const fetchRubricaPersonalizada = useCallback(async () => {
        try {
            const rubricaPersonalizada = await getRubricaPersonalizada(currentUser.nombreCompleto);
            if (rubricaPersonalizada) {
                setRubrica(rubricaPersonalizada);
            }
        } catch (e) {
            console.error("Error al cargar rúbrica personalizada", e);
            // No es crítico, usar la rúbrica por defecto
        }
    }, [currentUser.nombreCompleto]);

    useEffect(() => {
        fetchMisAcompanamientos();
        fetchRubricaPersonalizada();
    }, [fetchMisAcompanamientos, fetchRubricaPersonalizada]);
    
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
        
        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('LICEO INDUSTRIAL DE RECOLETA', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(40);
        doc.text('Informe de Acompañamiento Docente', doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
        
        // Información básica
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        autoTable(doc, {
            startY: 35,
            body: [
                ['Docente:', record.docente],
                ['Fecha:', new Date(record.fecha).toLocaleDateString('es-CL')],
                ['Asignatura:', record.asignatura],
                ['Curso:', record.curso],
                ['Bloques:', record.bloques || 'No especificado'],
            ],
            theme: 'plain',
            styles: { fontSize: 11, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold' } }
        });

        let finalY = (doc as any).lastAutoTable.finalY + 15;
        
        // Resultados de la rúbrica
        if (Object.keys(record.rubricaResultados).length > 0) {
            const tableBody: any[] = [];
            const niveles = ['Débil', 'Incipiente', 'Satisfactorio', 'Avanzado'];
            
            rubrica.forEach(domain => {
                tableBody.push([{ 
                    content: domain.domain, 
                    colSpan: 2, 
                    styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: [40, 40, 40] } 
                }]);
                
                domain.criteria.forEach(criterion => {
                    const score = record.rubricaResultados[criterion.name];
                    const nivelTexto = score ? niveles[score - 1] : 'No evaluado';
                    tableBody.push([criterion.name, nivelTexto]);
                });
            });

            autoTable(doc, {
                startY: finalY,
                head: [['Indicador', 'Nivel de Logro']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80], textColor: 255 },
                styles: { fontSize: 10 }
            });
            
            finalY = (doc as any).lastAutoTable.finalY + 15;
        }
        
        const addSection = (title: string, content: string) => {
            if (!content) return;
            if (finalY > 250) { 
                doc.addPage(); 
                finalY = 20; 
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text('LICEO INDUSTRIAL DE RECOLETA', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
                finalY = 25;
            }
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(40);
            doc.text(title, 14, finalY);
            finalY += 8;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(60);
            const splitText = doc.splitTextToSize(content.replace(/## /g, '').replace(/(\*\*|\*)/g, ''), 180);
            doc.text(splitText, 14, finalY);
            finalY += splitText.length * 5 + 10;
        };
        
        addSection('Observaciones Generales', record.observacionesGenerales);
        addSection('Retroalimentación Consolidada', record.retroalimentacionConsolidada);

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        }

        doc.save(`Acompanamiento_${currentUser.nombreCompleto.replace(/\s/g, '_')}_${new Date(record.fecha).toLocaleDateString('es-CL').replace(/\//g, '-')}.pdf`);
    };

    if (selectedAcompanamiento) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <button onClick={() => setSelectedAcompanamiento(null)} className="text-sm font-semibold text-slate-500 hover:underline mb-2">&larr; Volver a mi historial</button>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Detalle del Acompañamiento</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {new Date(selectedAcompanamiento.fecha).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })} | {selectedAcompanamiento.curso} - {selectedAcompanamiento.asignatura}
                        </p>
                    </div>
                     <button onClick={() => handleExportPDF(selectedAcompanamiento)} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-red-700">
                        <PDFIcon /> Exportar PDF
                    </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="prose dark:prose-invert max-w-none prose-slate">
                            <h3>Retroalimentación Consolidada (IA)</h3>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                 <p className="whitespace-pre-wrap">{selectedAcompanamiento.retroalimentacionConsolidada || 'No se ha generado retroalimentación.'}</p>
                            </div>
                            <h3>Observaciones Generales</h3>
                             <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <p className="whitespace-pre-wrap">{selectedAcompanamiento.observacionesGenerales || 'Sin observaciones.'}</p>
                            </div>
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Desempeño por Dominio</h3>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                            <BarChart data={domainPerformance} />
                        </div>
                    </div>
                </div>

                {selectedAcompanamiento.id && (
                  <div className="mt-10">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Mis Ciclos OPR</h3>
                                        <div className="border rounded-lg dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
                                                                    <CiclosOPRList
                                                                        acompanamientoId={selectedAcompanamiento.id}
                                                                        readOnly
                                                                        allowDelete={false}
                                                                    />
                                        </div>
                  </div>
                )}
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Mis Acompañamientos</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Aquí encontrarás el historial de tus observaciones de clase y la retroalimentación asociada.</p>
            
            {loading && <div className="text-center text-amber-600 py-4">Cargando tus acompañamientos desde la nube...</div>}
            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}
            
            {!loading && misAcompanamientos.length === 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-lg mb-6">
                    No tienes acompañamientos registrados en la nube.
                </div>
            )}
            
            <div className="space-y-4">
                {!loading && misAcompanamientos.length > 0 ? (
                    misAcompanamientos.map(record => (
                        <button 
                            key={record.id} 
                            onClick={() => setSelectedAcompanamiento(record)}
                            className="w-full text-left p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{record.curso} - {record.asignatura}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Fecha: {new Date(record.fecha).toLocaleDateString('es-CL')}
                                        {record.bloques && ` | Bloques: ${record.bloques}`}
                                    </p>
                                    {Object.keys(record.rubricaResultados).length > 0 && (
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                            Evaluado en {Object.keys(record.rubricaResultados).length} criterios
                                        </p>
                                    )}
                                </div>
                                <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">Ver Detalles</span>
                            </div>
                        </button>
                    ))
                ) : !loading && (
                    <div className="text-center py-16 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-5xl">👍</span>
                        <h2 className="mt-4 text-xl font-bold text-slate-700 dark:text-slate-300">Sin Registros</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Aún no tienes acompañamientos de clase registrados.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AcompanamientoDocenteProfesor;
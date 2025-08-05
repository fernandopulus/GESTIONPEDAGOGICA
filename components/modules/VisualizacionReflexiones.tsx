import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import d3Cloud from 'd3-cloud';
import { PlanificacionUnidad, NivelPlanificacion } from '../../types'; // Asegúrate que la ruta a types es correcta

// Constantes y Tipos locales
const HABILIDADES_BLOOM = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];
const NIVELES: NivelPlanificacion[] = ['1º Medio', '2º Medio', '3º Medio', '4º Medio'];

// Componente de Nube de Palabras con D3
interface WordCloudProps {
    words: { text: string; value: number }[];
}

const WordCloud: React.FC<WordCloudProps> = ({ words }) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (words.length === 0 || !ref.current) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove(); // Limpiar SVG anterior

        const width = 500;
        const height = 350;

        const layout = d3Cloud()
            .size([width, height])
            .words(words.map(d => ({ ...d }))) // Clonar para evitar mutación
            .padding(5)
            .rotate(() => (~~(Math.random() * 6) - 3) * 15) // Rotación aleatoria ligera
            .font("Impact")
            .fontSize(d => Math.sqrt(d.value) * 12)
            .on("end", draw);

        layout.start();

        function draw(words: d3Cloud.Word[]) {
            const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

            svg.attr("width", layout.size()[0])
               .attr("height", layout.size()[1])
               .append("g")
               .attr("transform", `translate(${layout.size()[0] / 2},${layout.size()[1] / 2})`)
               .selectAll("text")
               .data(words)
               .enter().append("text")
               .style("font-size", d => `${d.size}px`)
               .style("font-family", "Impact")
               .style("fill", (d, i) => colorScale(i.toString()))
               .attr("text-anchor", "middle")
               .attr("transform", d => `translate(${[d.x, d.y]})rotate(${d.rotate})`)
               .text(d => d.text)
               .style("cursor", "pointer")
               .on("mouseover", (event, d) => {
                    d3.select(event.currentTarget).style("font-weight", "bold");
               })
               .on("mouseout", (event, d) => {
                    d3.select(event.currentTarget).style("font-weight", "normal");
               });
        }

    }, [words]);

    return <svg ref={ref}></svg>;
};


// Componente Principal de Visualización
interface VisualizacionReflexionesProps {
    planificaciones: PlanificacionUnidad[]; // Recibe solo planificaciones de unidad
}

const VisualizacionReflexiones: React.FC<VisualizacionReflexionesProps> = ({ planificaciones }) => {
    const [selectedNivel, setSelectedNivel] = useState<NivelPlanificacion | 'todos'>('todos');
    const [selectedAsignatura, setSelectedAsignatura] = useState<string>('todos');

    // Extraer asignaturas únicas para el filtro
    const asignaturasUnicas = useMemo(() => {
        const set = new Set(planificaciones.map(p => p.asignatura));
        return ['todos', ...Array.from(set)];
    }, [planificaciones]);

    // Filtrar planificaciones según los selectores
    const filteredPlanificaciones = useMemo(() => {
        return planificaciones.filter(p => {
            const nivelMatch = selectedNivel === 'todos' || p.nivel === selectedNivel;
            const asignaturaMatch = selectedAsignatura === 'todos' || p.asignatura === selectedAsignatura;
            return nivelMatch && asignaturaMatch && p.reflexionUnidad;
        });
    }, [planificaciones, selectedNivel, selectedAsignatura]);

    // Procesar datos para el ranking de habilidades
    const rankingHabilidades = useMemo(() => {
        const skillScores: { [key: string]: number } = {};
        HABILIDADES_BLOOM.forEach(skill => { skillScores[skill] = 0; });

        filteredPlanificaciones.forEach(p => {
            const orden = p.reflexionUnidad?.ordenHabilidades || [];
            orden.forEach((skill, index) => {
                if (skillScores[skill] !== undefined) {
                    skillScores[skill] += (HABILIDADES_BLOOM.length - index); // Ponderar por posición
                }
            });
        });

        return Object.entries(skillScores)
            .map(([text, value]) => ({ text, value }))
            .sort((a, b) => b.value - a.value);

    }, [filteredPlanificaciones]);

    // Procesar datos para la nube de palabras
    const wordCloudData = useMemo(() => {
        const stopWords = new Set(['y', 'e', 'o', 'u', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'a', 'ante', 'bajo', 'con', 'contra', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'segun', 'sin', 'sobre', 'tras', 'que', 'se', 'del', 'al', 'no', 'si', 'fue', 'fueron', 'ha', 'han', 'es', 'son', 'muy', 'mas', 'les', 'les', 'lo', 'como', 'sus', 'con', 'para', 'por', 'este', 'esta', 'estos', 'estas', 'actividad', 'actividades', 'clase', 'clases', 'alumnos', 'estudiantes', 'docente', 'logro', 'lograron', 'mejorar', 'trabajar', 'desarrollar']);
        
        const text = filteredPlanificaciones
            .map(p => `${p.reflexionUnidad?.fortalezas || ''} ${p.reflexionUnidad?.debilidades || ''}`)
            .join(' ');

        const words = text.toLowerCase().match(/\b(\w{4,})\b/g) || []; // Palabras de 4+ letras

        const wordCounts: { [key: string]: number } = {};
        words.forEach(word => {
            if (!stopWords.has(word)) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        });

        return Object.entries(wordCounts)
            .map(([text, value]) => ({ text, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 50); // Limitar a las 50 palabras más frecuentes

    }, [filteredPlanificaciones]);

    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md animate-fade-in max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-6">Análisis de Reflexiones Docentes</h1>
            
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nivel</label>
                    <select value={selectedNivel} onChange={e => setSelectedNivel(e.target.value as NivelPlanificacion | 'todos')} className={inputStyles}>
                        <option value="todos">Todos los Niveles</option>
                        {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
                    <select value={selectedAsignatura} onChange={e => setSelectedAsignatura(e.target.value)} className={inputStyles}>
                        {asignaturasUnicas.map(a => <option key={a} value={a}>{a === 'todos' ? 'Todas las Asignaturas' : a}</option>)}
                    </select>
                </div>
            </div>

            {/* Visualizaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking de Habilidades */}
                <div className="p-6 border dark:border-slate-700 rounded-lg">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Ranking de Habilidades (Bloom)</h2>
                    {rankingHabilidades.every(h => h.value === 0) ? (
                        <p className="text-slate-500 dark:text-slate-400 text-center py-10">No hay datos de habilidades para la selección actual.</p>
                    ) : (
                        <ul className="space-y-3">
                            {rankingHabilidades.map((skill, index) => (
                                <li key={skill.text} className="flex items-center gap-4">
                                    <span className="font-bold text-lg text-amber-500 w-6 text-center">{index + 1}</span>
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">{skill.text}</p>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                            <div 
                                                className="bg-blue-500 h-2.5 rounded-full" 
                                                style={{ width: `${(skill.value / (rankingHabilidades[0].value || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Nube de Palabras */}
                <div className="p-6 border dark:border-slate-700 rounded-lg flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Nube de Contenidos y Experiencias</h2>
                    {wordCloudData.length > 0 ? (
                        <WordCloud words={wordCloudData} />
                    ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-center py-10">No hay suficientes palabras para generar la nube con la selección actual.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VisualizacionReflexiones;

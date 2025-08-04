import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toPng } from 'html-to-image';
import type { CrosswordPuzzle, CrosswordClue, CrosswordGridCell, User } from '../../../types';
import { 
    subscribeToCrucigramas,
    saveCrucigrama,
    deleteCrucigrama 
} from '../../../src/firebaseHelpers/recursosHelper';

// --- ICONS ---
const Spinner = () => (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const SparklesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>);

// --- MAIN COMPONENT ---
interface CrucigramasProps {
    onBack: () => void;
    currentUser: User;
}

const Crucigramas: FC<CrucigramasProps> = ({ onBack, currentUser }) => {
    const [savedPuzzles, setSavedPuzzles] = useState<CrosswordPuzzle[]>([]);
    const [numWords, setNumWords] = useState<number>(10);
    const [isCustomNumWords, setIsCustomNumWords] = useState(false);
    const [words, setWords] = useState<string[]>(Array(10).fill(''));
    const [clues, setClues] = useState<string[]>(Array(10).fill(''));
    const [aiTheme, setAiTheme] = useState('');
    const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
    const [showSolution, setShowSolution] = useState(false);
    const [loading, setLoading] = useState({ ai: false, puzzle: false, data: true });
    const [aiLoadingClueIndex, setAiLoadingClueIndex] = useState<number | null>(null);
    const puzzleRef = useRef<HTMLDivElement>(null);

    // ✅ SOLUCIÓN 2: Reconstruir la grilla al cargar los datos desde Firestore
    useEffect(() => {
        setLoading(p => ({ ...p, data: true }));
        const unsubscribe = subscribeToCrucigramas((dataFromFirestore) => {
            const reconstructedPuzzles = dataFromFirestore.map((puzzleData: any) => {
                const { grid_flat, grid_width, ...rest } = puzzleData;
                const grid: CrosswordGridCell[][] = [];
                if (grid_flat && grid_width > 0) {
                    for (let i = 0; i < grid_flat.length; i += grid_width) {
                        grid.push(grid_flat.slice(i, i + grid_width));
                    }
                }
                return { ...rest, grid };
            });
            setSavedPuzzles(reconstructedPuzzles);
            setLoading(p => ({ ...p, data: false }));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const newSize = numWords;
        setWords(prev => Array.from({ length: newSize }, (_, i) => prev[i] || ''));
        setClues(prev => Array.from({ length: newSize }, (_, i) => prev[i] || ''));
    }, [numWords]);

    const handleWordChange = (index: number, value: string) => {
        const newWords = [...words];
        newWords[index] = value;
        setWords(newWords);
    };

    const handleClueChange = (index: number, value: string) => {
        const newClues = [...clues];
        newClues[index] = value;
        setClues(newClues);
    };

    const handleGenerateWordsAndClues = async () => {
        if (!aiTheme.trim()) return;
        setLoading(p => ({ ...p, ai: true }));
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                alert("La API Key de Gemini no está configurada.");
                setLoading(p => ({ ...p, ai: false }));
                return;
            }

            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            
            const prompt = `
                Genera una lista de ${numWords} palabras y sus pistas correspondientes para un crucigrama, basado en el tema "${aiTheme}".
                Tu respuesta DEBE ser un único objeto JSON válido sin texto adicional ni bloques \`\`\`json.
                El objeto debe tener una clave "items", que es un array de ${numWords} objetos.
                Cada objeto en el array "items" debe tener dos claves:
                1. "word": Un string con la palabra (sin espacios y en mayúsculas).
                2. "clue": Un string con la pista para esa palabra.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();


            let cleanedText = text.replace(/^```json\s*|```\s*$/g, '').trim();
            // Extraer solo el objeto JSON si hay texto antes/después
            const firstBrace = cleanedText.indexOf('{');
            const lastBrace = cleanedText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
            }

            // Solución: limpiar comas extra entre objetos del array
            cleanedText = cleanedText.replace(/},\s*([\r\n\s]*){/g, '}__SPLIT__{');
            if (cleanedText.includes('__SPLIT__')) {
                cleanedText = cleanedText.replace(/("items"\s*:\s*\[)([\s\S]*?)(\])/m, (match, p1, p2, p3) => {
                    const arr = p2.split('__SPLIT__').map(s => s.trim().replace(/,$/, ''));
                    return p1 + arr.join(',') + p3;
                });
            }

            // Eliminar comas extra antes de cerrar el array
            cleanedText = cleanedText.replace(/,\s*]/g, ']');

            let resultJson;
            try {
                resultJson = JSON.parse(cleanedText);
            } catch (err) {
                console.error('Respuesta IA no es JSON válido:', cleanedText);
                alert('La respuesta de la IA no es un JSON válido. Intenta de nuevo o ajusta el tema.');
                setLoading(p => ({ ...p, ai: false }));
                return;
            }
            if (!resultJson.items || !Array.isArray(resultJson.items)) {
                throw new Error("La respuesta de la IA no contiene la lista de 'items' esperada.");
            }

            const aiWords = resultJson.items.map((item: any) => (item.word || '').toUpperCase().replace(/\s/g, ''));
            const aiClues = resultJson.items.map((item: any) => item.clue || '');

            setWords(Array.from({ length: numWords }, (_, i) => aiWords[i] || ''));
            setClues(Array.from({ length: numWords }, (_, i) => aiClues[i] || ''));

        } catch (error) {
            console.error("Error generating words/clues with AI:", error);
            alert("No se pudieron generar las palabras y pistas. Inténtelo de nuevo.");
        } finally {
            setLoading(p => ({ ...p, ai: false }));
        }
    };
    
    const handleAIGenerateClue = async (index: number) => {
        const wordToGetClueFor = words[index];
        if (!wordToGetClueFor || !wordToGetClueFor.trim()) {
            alert("Por favor, escribe una palabra antes de generar su pista.");
            return;
        }
        setAiLoadingClueIndex(index);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
             if (!apiKey) {
                alert("La API Key de Gemini no está configurada.");
                setAiLoadingClueIndex(null);
                return;
            }
            
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

            const prompt = `Para un crucigrama con el tema "${aiTheme || 'general'}", genera una pista concisa y creativa para la palabra "${wordToGetClueFor}". La respuesta debe ser un único objeto JSON válido sin texto adicional, con una sola clave: "clue".`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const resultJson = JSON.parse(cleanedText);

            if (resultJson.clue) {
                handleClueChange(index, resultJson.clue);
            }

        } catch (error) {
            console.error("Error generating clue with AI:", error);
            alert("No se pudo generar la pista.");
        } finally {
            setAiLoadingClueIndex(null);
        }
    };

    const generateCrossword = useCallback(() => {
        try {
            const entries = words.map((word, i) => ({ word: word.toUpperCase().replace(/[^A-ZÑ]/g, ''), clue: clues[i] })).filter(e => e.word.length > 0);
            if (entries.length === 0) {
                alert("Por favor, ingrese al menos una palabra válida.");
                return null;
            }
    
            entries.sort((a, b) => b.word.length - a.word.length);
            
            // ... (resto de la lógica de generación de la grilla sin cambios)
            const longestWordLength = entries[0].word.length;
            const gridSize = Math.max(longestWordLength, entries.length) * 2;
    
            let grid: (string | null)[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
            const placedWords: Omit<CrosswordClue, 'number'>[] = [];
    
            const firstWord = entries.shift()!;
            const startRow = Math.floor(gridSize / 2);
            const startCol = Math.floor((gridSize - firstWord.word.length) / 2);
            for (let i = 0; i < firstWord.word.length; i++) {
                grid[startRow][startCol + i] = firstWord.word[i];
            }
            placedWords.push({ word: firstWord.word, clue: firstWord.clue, direction: 'across', row: startRow, col: startCol });
    
            for (const entry of entries) {
                let bestFit = { score: -1, row: -1, col: -1, direction: 'across' as 'across' | 'down' };
                
                for (const pWord of placedWords) {
                    for (let i = 0; i < pWord.word.length; i++) {
                        for (let j = 0; j < entry.word.length; j++) {
                            if (pWord.word[i] === entry.word[j]) {
                                let score = 0;
                                let row: number, col: number;
                                let direction: 'across' | 'down';
                                
                                if (pWord.direction === 'across') {
                                    direction = 'down';
                                    row = pWord.row - j;
                                    col = pWord.col + i;
                                } else {
                                    direction = 'across';
                                    row = pWord.row + i;
                                    col = pWord.col - j;
                                }
                                
                                let isValid = true;
                                for (let k = 0; k < entry.word.length; k++) {
                                    const r = row + (direction === 'down' ? k : 0);
                                    const c = col + (direction === 'across' ? k : 0);
                                    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
                                        isValid = false; break;
                                    }
                                    const cell = grid[r][c];
                                    const isIntersection = r === pWord.row + (pWord.direction === 'down' ? i : 0) && c === pWord.col + (pWord.direction === 'across' ? i : 0);
                                    if (cell && !isIntersection) { isValid = false; break; }
                                    if (cell && isIntersection && cell !== entry.word[j]) { isValid = false; break; }
    
                                    if (!isIntersection) {
                                        if (direction === 'across' && ( (r > 0 && grid[r-1][c]) || (r < gridSize-1 && grid[r+1][c]) )) { isValid = false; break; }
                                        if (direction === 'down' && ( (c > 0 && grid[r][c-1]) || (c < gridSize-1 && grid[r][c+1]) )) { isValid = false; break; }
                                    }
    
                                    if (cell) score++;
                                }
    
                                if (isValid && score > bestFit.score) {
                                    bestFit = { score, row, col, direction };
                                }
                            }
                        }
                    }
                }
                
                if (bestFit.score > -1) {
                    for (let k = 0; k < entry.word.length; k++) {
                        const r = bestFit.row + (bestFit.direction === 'down' ? k : 0);
                        const c = bestFit.col + (bestFit.direction === 'across' ? k : 0);
                        grid[r][c] = entry.word[k];
                    }
                    placedWords.push({ word: entry.word, clue: entry.clue, direction: bestFit.direction, row: bestFit.row, col: bestFit.col });
                }
            }
            
            let minRow = gridSize, maxRow = -1, minCol = gridSize, maxCol = -1;
            placedWords.forEach(w => {
                minRow = Math.min(minRow, w.row);
                maxRow = Math.max(maxRow, w.row + (w.direction === 'down' ? w.word.length -1 : 0));
                minCol = Math.min(minCol, w.col);
                maxCol = Math.max(maxCol, w.col + (w.direction === 'across' ? w.word.length - 1: 0));
            });

            if (maxRow === -1) {
                minRow = placedWords[0].row;
                maxRow = placedWords[0].row;
                minCol = placedWords[0].col;
                maxCol = placedWords[0].col + placedWords[0].word.length -1;
            }
            
            const cropMargin = 1;
            const cropStartRow = Math.max(0, minRow - cropMargin);
            const endRow = Math.min(gridSize, maxRow + 1 + cropMargin);
            const cropStartCol = Math.max(0, minCol - cropMargin);
            const endCol = Math.min(gridSize, maxCol + 1 + cropMargin);

            const finalGrid = grid.slice(cropStartRow, endRow).map(r => r.slice(cropStartCol, endCol));
            
            const finalPlacedWords = placedWords.map(w => ({ 
                ...w, 
                row: w.row - cropStartRow,
                col: w.col - cropStartCol
            })).sort((a,b) => a.row - b.row || a.col - b.col);
            
            let clueNum = 1;
            const numberedClues: CrosswordClue[] = [];
            const starts = new Map<string, number>();

            finalPlacedWords.forEach(w => {
                const key = `${w.row},${w.col}`;
                if (!starts.has(key)) {
                    starts.set(key, clueNum++);
                }
                numberedClues.push({ ...w, number: starts.get(key)! });
            });
            
            const finalGridWithNumbers: CrosswordGridCell[][] = finalGrid.map(row => row.map(cell => ({ char: cell, number: null })));
            
            numberedClues.forEach(clue => {
                const key = `${clue.row},${clue.col}`;
                if (finalGridWithNumbers[clue.row] && finalGridWithNumbers[clue.row][clue.col] !== undefined) {
                    finalGridWithNumbers[clue.row][clue.col].number = starts.get(key)!;
                }
            });
    
            return {
                grid: finalGridWithNumbers,
                clues: {
                    across: numberedClues.filter(c => c.direction === 'across').sort((a,b)=> a.number - b.number),
                    down: numberedClues.filter(c => c.direction === 'down').sort((a,b)=> a.number - b.number)
                }
            };
        } catch (error) {
            console.error("Error generating crossword grid:", error);
            alert("Ocurrió un error inesperado al generar el crucigrama. Intente con palabras diferentes.");
            return null;
        }
    }, [words, clues]);

    const handleGeneratePuzzle = async () => {
        setLoading(p => ({ ...p, puzzle: true }));
        setPuzzle(null);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = generateCrossword();
        if (result) {
            // Este es el objeto para el estado local, que necesita la grilla 2D para renderizar
            const newPuzzleForState: Omit<CrosswordPuzzle, 'id' | 'fechaCreacion'> = {
                creadorId: currentUser.id,
                creadorNombre: currentUser.nombreCompleto,
                tema: aiTheme || 'Personalizado',
                grid: result.grid,
                clues: result.clues,
            };

            // Crear un objeto separado para Firestore, con la grilla aplanada
            // Firestore no permite arrays anidados, así que guardamos solo los caracteres
            const dataToSave = {
                ...newPuzzleForState,
                grid_flat: result.grid.flat().map(cell => cell.char || ''),
                grid_width: result.grid[0]?.length || 0,
            };

            try {
                // Se envía el objeto aplanado a Firestore
                const newId = await saveCrucigrama(dataToSave, currentUser);
                // Se actualiza el estado local con la grilla 2D y el ID nuevo
                setPuzzle({
                    ...newPuzzleForState,
                    id: newId,
                    fechaCreacion: new Date().toISOString(),
                });
            } catch (error) {
                console.error("Error saving puzzle:", error);
                alert("No se pudo guardar el crucigrama en la base de datos.");
            }
        }
        setLoading(p => ({ ...p, puzzle: false }));
    };

    const handleDownloadPNG = () => {
        if (!puzzleRef.current) return;
        setShowSolution(false);
        setTimeout(() => {
             toPng(puzzleRef.current!, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `crucigrama.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => console.error('Error generating image', err));
        }, 100);
    };

    const renderPuzzle = () => {
        // ... (el resto del componente renderPuzzle no necesita cambios)
    };

    // ... (el resto del componente no necesita cambios)

    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-4">
                <span className="text-4xl">✏️</span>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Crucigramas</h1>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:underline">&larr; Volver a Recursos</button>
                </div>
            </div>

            {puzzle ? ( 
                <div className="space-y-6">
                    <div ref={puzzleRef} className="p-6 bg-white dark:bg-slate-900 text-black dark:text-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                 <div className="border border-black dark:border-white" style={{ display: 'grid', gridTemplateColumns: `repeat(${puzzle.grid[0].length}, 2rem)` }}>
                                    {puzzle.grid.flat().map((cell, i) => (
                                        <div key={i} className="relative w-8 h-8 border border-black dark:border-white flex items-center justify-center font-bold uppercase" style={{ backgroundColor: cell.char ? 'white' : 'black' }}>
                                            {cell.number && <span className="absolute top-0 left-0.5 text-[8px]">{cell.number}</span>}
                                            {(showSolution && cell.char) && <span>{cell.char}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="text-sm">
                                <h3 className="font-bold text-lg mb-2">HORIZONTALES</h3>
                                <ul className="space-y-1">{puzzle.clues.across.map(c => <li key={`${c.word}-${c.clue}`}><strong>{c.number}.</strong> {c.clue}</li>)}</ul>
                                <h3 className="font-bold text-lg mt-4 mb-2">VERTICALES</h3>
                                <ul className="space-y-1">{puzzle.clues.down.map(c => <li key={`${c.word}-${c.clue}`}><strong>{c.number}.</strong> {c.clue}</li>)}</ul>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={showSolution} onChange={() => setShowSolution(!showSolution)} className="h-5 w-5 rounded"/>
                            <span>Mostrar Solución</span>
                        </label>
                        <div className="flex gap-4">
                            <button onClick={() => setPuzzle(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">Crear otro</button>
                            <button onClick={handleDownloadPNG} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Descargar como PNG</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 pt-4 border-t dark:border-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Número de palabras</label>
                        <div className="flex flex-wrap gap-2">
                            {[5, 10, 15, 20].map(n => <button key={n} onClick={() => { setNumWords(n); setIsCustomNumWords(false); }} className={`px-4 py-2 rounded-md font-semibold text-sm ${!isCustomNumWords && numWords === n ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{n}</button>)}
                            <button onClick={() => setIsCustomNumWords(true)} className={`px-4 py-2 rounded-md font-semibold text-sm ${isCustomNumWords ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Personalizado</button>
                            {isCustomNumWords && <input type="number" value={numWords} onChange={e => setNumWords(parseInt(e.target.value, 10))} min="1" max="30" className="w-24 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="ai-theme" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Completar palabras y pistas con IA (Opcional)</label>
                        <div className="flex gap-2">
                            <input id="ai-theme" type="text" value={aiTheme} onChange={e => setAiTheme(e.target.value)} placeholder="Envía un tema..." className="flex-grow border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                            <button onClick={handleGenerateWordsAndClues} disabled={loading.ai} className="bg-sky-500 text-white font-semibold px-4 py-2 rounded-md flex items-center justify-center min-w-[120px]">
                                {loading.ai ? <Spinner /> : <><SparklesIcon /><span className="ml-2">Generar</span></>}
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {Array.from({ length: numWords }).map((_, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input type="text" value={words[index]} onChange={e => handleWordChange(index, e.target.value)} placeholder={`Palabra ${index + 1}`} className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                                <div className="md:col-span-2 flex items-center gap-2">
                                    <textarea value={clues[index]} onChange={e => handleClueChange(index, e.target.value)} placeholder={`Pista ${index + 1}`} rows={1} className="flex-grow border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                                    <button onClick={() => handleAIGenerateClue(index)} disabled={aiLoadingClueIndex === index} className="p-2 bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 disabled:opacity-50" title="Generar Pista con IA">
                                        {aiLoadingClueIndex === index ? <div className="w-5 h-5 border-2 border-slate-400 border-t-amber-500 rounded-full animate-spin"></div> : <SparklesIcon />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-right pt-4">
                        <button onClick={handleGeneratePuzzle} disabled={loading.puzzle} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 min-w-[200px]">
                            {loading.puzzle ? 'Generando...' : 'Generar Crucigrama'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Crucigramas;
import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toPng } from 'html-to-image';
import type { WordSearchPuzzle, User } from '../../../types';
import {
    subscribeToSopasDeLetras,
    saveSopaDeLetras,
    deleteSopaDeLetras
} from '../../../src/firebaseHelpers/recursosHelper';

// --- ICONS ---
const Spinner = () => (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const SparklesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>);

interface SopaDeLetrasProps {
    onBack: () => void;
    currentUser: User;
}

const SopaDeLetras: React.FC<SopaDeLetrasProps> = ({ onBack, currentUser }) => {
    const [savedPuzzles, setSavedPuzzles] = useState<WordSearchPuzzle[]>([]);
    const [difficulty, setDifficulty] = useState<'Fácil' | 'Media' | 'Difícil'>('Media');
    const [numWords, setNumWords] = useState<number>(10);
    const [isCustomNumWords, setIsCustomNumWords] = useState(false);
    const [words, setWords] = useState<string[]>(Array(10).fill(''));
    const [aiTheme, setAiTheme] = useState('');
    const [puzzle, setPuzzle] = useState<WordSearchPuzzle | null>(null);
    const [loading, setLoading] = useState({ ai: false, puzzle: false, data: true });
    const puzzleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(p => ({ ...p, data: true }));
        const unsubscribe = subscribeToSopasDeLetras((data) => {
            setSavedPuzzles(data);
            setLoading(p => ({ ...p, data: false }));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        setWords(prev => {
            const newWords = Array(numWords).fill('');
            for (let i = 0; i < Math.min(prev.length, numWords); i++) {
                newWords[i] = prev[i];
            }
            return newWords;
        });
    }, [numWords]);

    const handleWordChange = (index: number, value: string) => {
        const newWords = [...words];
        newWords[index] = value;
        setWords(newWords);
    };

    const handleGenerateWordsWithAI = async () => {
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
                Genera una lista de ${numWords} palabras clave en español, estrictamente relacionadas con el tema "${aiTheme}".
                Tu respuesta DEBE ser un único objeto JSON válido sin texto adicional ni bloques \`\`\`json.
                El objeto debe tener una sola clave: "palabras".
                El valor de "palabras" debe ser un array de ${numWords} strings.
                Cada string en el array debe ser una sola palabra, sin espacios ni caracteres especiales.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const resultJson = JSON.parse(cleanedText);

            if (!resultJson.palabras || !Array.isArray(resultJson.palabras)) {
                throw new Error("La respuesta de la IA no contiene el array 'palabras' esperado.");
            }

            const aiWords = resultJson.palabras
                .map((w: string) => w.toUpperCase().replace(/[^A-ZÑ]/g, ''))
                .slice(0, numWords);
            
            const finalWords = [...aiWords];
            while (finalWords.length < numWords) {
                finalWords.push('');
            }
            setWords(finalWords);

        } catch (error) {
            console.error("Error generating words with AI:", error);
            alert("No se pudieron generar las palabras. La respuesta de la IA pudo tener un formato incorrecto. Inténtelo de nuevo.");
        } finally {
            setLoading(p => ({ ...p, ai: false }));
        }
    };
    
    const canPlaceWord = (word: string, grid: (string | null)[][], row: number, col: number, dir: { x: number; y: number }, size: number): boolean => {
        for (let i = 0; i < word.length; i++) {
            const newRow = row + i * dir.y;
            const newCol = col + i * dir.x;
            if (newRow < 0 || newRow >= size || newCol < 0 || newCol >= size) return false;
            if (grid[newRow][newCol] && grid[newRow][newCol] !== word[i]) return false;
        }
        return true;
    };

    const placeWord = (word: string, grid: (string | null)[][], row: number, col: number, dir: { x: number; y: number }) => {
        for (let i = 0; i < word.length; i++) {
            grid[row + i * dir.y][col + i * dir.x] = word[i];
        }
    };

    const handleGeneratePuzzle = async () => {
        setLoading(p => ({ ...p, puzzle: true }));
        setPuzzle(null);

        await new Promise(resolve => setTimeout(resolve, 100));

        const cleanWords = words.map(w => w.toUpperCase().replace(/[^A-ZÑ]/g, '')).filter(Boolean);
        if (cleanWords.length === 0) {
            alert("Por favor, ingrese al menos una palabra válida.");
            setLoading(p => ({ ...p, puzzle: false }));
            return;
        }

        const longestWord = Math.max(...cleanWords.map(w => w.length));
        let size = Math.max(longestWord, cleanWords.length) + 2;
        if (difficulty === 'Media') size += 3;
        if (difficulty === 'Difícil') size += 5;
        size = Math.min(Math.max(size, 10), 25);

        const grid: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
        const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
        if (difficulty !== 'Fácil') directions.push({ x: 1, y: -1 });
        if (difficulty === 'Difícil') directions.push({ x: -1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: -1 }, { x: -1, y: 1 });

        for (const word of cleanWords.sort((a, b) => b.length - a.length)) {
            let placed = false;
            for (let i = 0; i < 100; i++) {
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const row = Math.floor(Math.random() * size);
                const col = Math.floor(Math.random() * size);
                if (canPlaceWord(word, grid, row, col, dir, size)) {
                    placeWord(word, grid, row, col, dir);
                    placed = true;
                    break;
                }
            }
            if (!placed) console.warn(`No se pudo colocar la palabra: ${word}`);
        }

        const finalGrid = grid.map(row => row.map(cell => cell || 'ABCDEFGHIJKLMNOPQRSTUVWXYZÑ'[Math.floor(Math.random() * 27)]));
        
        // ✅ SOLUCIÓN 1: Convertir la matriz en un array de strings antes de guardar
        const newPuzzleData: Omit<WordSearchPuzzle, 'id' | 'createdAt'> = {
            tema: aiTheme || 'Personalizado',
            grid: finalGrid.map(row => row.join('')), // Convertir cada array de fila en un string
            words: cleanWords.sort()
        };

        try {
            const newId = await saveSopaDeLetras(newPuzzleData, currentUser);
            setPuzzle({ ...newPuzzleData, id: newId, createdAt: new Date().toISOString() });
        } catch (error) {
            console.error("Error saving puzzle:", error);
            alert("No se pudo guardar la sopa de letras.");
        } finally {
            setLoading(p => ({ ...p, puzzle: false }));
        }
    };

    const handleDownloadPNG = () => {
        if (!puzzleRef.current) return;
        toPng(puzzleRef.current, { cacheBust: true, backgroundColor: 'white', quality: 0.95, pixelRatio: 2 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = 'sopa-de-letras.png';
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('oops, something went wrong!', err);
                alert('No se pudo generar la imagen. Inténtelo de nuevo.');
            });
    };

    const renderPuzzle = () => {
        if (!puzzle) return null;

        // ✅ SOLUCIÓN 2: Convertir el array de strings de vuelta en un array plano de letras para renderizar
        const gridWidth = puzzle.grid[0]?.length || 1; // Ancho de la grilla
        const flatLetters = puzzle.grid.join('').split(''); // Une todas las filas y luego las separa en letras individuales

        return (
            <div className="space-y-6">
                <div ref={puzzleRef} className="p-6 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                            <div className="grid border-2 border-slate-700" style={{ gridTemplateColumns: `repeat(${gridWidth}, minmax(0, 1fr))` }}>
                                {flatLetters.map((letter, i) => (
                                    <div key={i} className="flex items-center justify-center aspect-square border border-slate-300 font-mono font-bold text-lg text-slate-800">
                                        {letter}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 mb-4 border-b-2 border-slate-700 pb-2">PALABRAS A BUSCAR</h3>
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 font-semibold text-slate-700">
                                {puzzle.words.map(w => <li key={w}>{w}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-4">
                    <button onClick={() => setPuzzle(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300">Crear otra</button>
                    <button onClick={handleDownloadPNG} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600">Descargar como PNG</button>
                </div>
            </div>
        );
    };

    if (loading.data) {
        return <div className="text-center py-10">Cargando...</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-4">
                <span className="text-4xl">🅰️</span>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Sopa de Letras</h1>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:underline">&larr; Volver a Recursos</button>
                </div>
            </div>

            {!puzzle && (
                <div className="space-y-6 pt-4 border-t dark:border-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dificultad</label>
                        <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)} className="w-full md:w-1/3 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600">
                            <option>Fácil</option>
                            <option>Media</option>
                            <option>Difícil</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Número de palabras</label>
                        <div className="flex flex-wrap gap-2">
                            {[5, 10, 15, 20].map(n => (
                                <button key={n} onClick={() => { setNumWords(n); setIsCustomNumWords(false); }} className={`px-4 py-2 rounded-md font-semibold text-sm ${!isCustomNumWords && numWords === n ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    {n}
                                </button>
                            ))}
                            <button onClick={() => setIsCustomNumWords(true)} className={`px-4 py-2 rounded-md font-semibold text-sm ${isCustomNumWords ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                Personalizado
                            </button>
                            {isCustomNumWords && (
                                <input type="number" value={numWords} onChange={e => setNumWords(parseInt(e.target.value, 10))} min="1" max="30" className="w-24 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600" />
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="ai-theme" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Completar palabras con IA (Opcional)</label>
                        <div className="flex gap-2">
                            <input id="ai-theme" type="text" value={aiTheme} onChange={e => setAiTheme(e.target.value)} placeholder="Envía un tema..." className="flex-grow border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                            <button onClick={handleGenerateWordsWithAI} disabled={loading.ai} className="bg-sky-500 text-white font-semibold px-4 py-2 rounded-md flex items-center justify-center min-w-[120px]">
                                {loading.ai ? <Spinner /> : <><SparklesIcon /><span className="ml-2">Generar</span></>}
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Palabras <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {words.map((word, index) => (
                                <input key={index} type="text" value={word} onChange={e => handleWordChange(index, e.target.value)} placeholder={`Palabra ${index + 1}`} className="border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
                            ))}
                        </div>
                    </div>

                    <div className="text-right pt-4">
                        <button onClick={handleGeneratePuzzle} disabled={loading.puzzle} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 disabled:bg-slate-400 min-w-[200px]">
                            {loading.puzzle ? 'Generando...' : 'Generar Sopa de Letras'}
                        </button>
                    </div>
                </div>
            )}
            
            {puzzle && renderPuzzle()}
        </div>
    );
};

export default SopaDeLetras;

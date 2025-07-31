import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { toPng } from 'html-to-image';
import type { CrosswordPuzzle, CrosswordClue, CrosswordGridCell } from '../../../types';

// --- ICONS ---
const Spinner = () => (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const SparklesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>);

// --- MAIN COMPONENT ---
const Crucigramas: FC<{ onBack: () => void; }> = ({ onBack }) => {
    const [numWords, setNumWords] = useState<number>(10);
    const [isCustomNumWords, setIsCustomNumWords] = useState(false);
    const [words, setWords] = useState<string[]>(Array(10).fill(''));
    const [clues, setClues] = useState<string[]>(Array(10).fill(''));
    const [aiTheme, setAiTheme] = useState('');
    const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
    const [showSolution, setShowSolution] = useState(false);
    const [loading, setLoading] = useState({ ai: false, puzzle: false });
    const puzzleRef = useRef<HTMLDivElement>(null);

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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Genera una lista de ${numWords} palabras y sus pistas correspondientes para un crucigrama, basado en el tema "${aiTheme}". Las palabras no deben contener espacios.`;
            const schema = {
                type: Type.OBJECT,
                properties: {
                    items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                word: { type: Type.STRING },
                                clue: { type: Type.STRING }
                            },
                            required: ["word", "clue"]
                        }
                    }
                },
                required: ["items"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema }
            });

            const result = JSON.parse(response.text);
            const aiWords = result.items.map((item: any) => item.word.toUpperCase().replace(/\s/g, ''));
            const aiClues = result.items.map((item: any) => item.clue);
            
            setWords(Array.from({ length: numWords }, (_, i) => aiWords[i] || ''));
            setClues(Array.from({ length: numWords }, (_, i) => aiClues[i] || ''));

        } catch (error) {
            console.error("Error generating words/clues with AI:", error);
            alert("No se pudieron generar las palabras y pistas. Inténtelo de nuevo.");
        } finally {
            setLoading(p => ({ ...p, ai: false }));
        }
    };
    
    // --- Crucigramas Generation Logic ---
    const generateCrossword = useCallback(() => {
        try {
            const entries = words.map((word, i) => ({ word: word.toUpperCase().replace(/[^A-ZÑ]/g, ''), clue: clues[i] })).filter(e => e.word.length > 0);
            if (entries.length === 0) {
                alert("Por favor, ingrese al menos una palabra válida.");
                return null;
            }
    
            entries.sort((a, b) => b.word.length - a.word.length);
            
            const longestWordLength = entries[0].word.length;
            const gridSize = Math.max(longestWordLength, entries.length) * 2;
    
            let grid: (string | null)[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
            const placedWords: Omit<CrosswordClue, 'number'>[] = [];
    
            // Place first word
            const firstWord = entries.shift()!;
            const startRow = Math.floor(gridSize / 2);
            const startCol = Math.floor((gridSize - firstWord.word.length) / 2);
            for (let i = 0; i < firstWord.word.length; i++) {
                grid[startRow][startCol + i] = firstWord.word[i];
            }
            placedWords.push({ word: firstWord.word, clue: firstWord.clue, direction: 'across', row: startRow, col: startCol });
    
            // Place subsequent words
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
            
            // Finalize grid
            let minRow = gridSize, maxRow = -1, minCol = gridSize, maxCol = -1;
            placedWords.forEach(w => {
                minRow = Math.min(minRow, w.row);
                maxRow = Math.max(maxRow, w.row + (w.direction === 'down' ? w.word.length -1 : 0));
                minCol = Math.min(minCol, w.col);
                maxCol = Math.max(maxCol, w.col + (w.direction === 'across' ? w.word.length - 1: 0));
            });

            if (maxRow === -1) { // Only one word was placed
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
            
            // Assign numbers
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

    const handleGeneratePuzzle = () => {
        setLoading(p => ({ ...p, puzzle: true }));
        setPuzzle(null);
        setTimeout(() => {
            const result = generateCrossword();
            if (result) {
                setPuzzle(result);
            }
            setLoading(p => ({ ...p, puzzle: false }));
        }, 100);
    };

    const handleDownloadPNG = () => {
        if (!puzzleRef.current) return;
        setShowSolution(false); // Ensure solution isn't shown in the base puzzle
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
        if (!puzzle) return null;
        return (
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
        );
    };


    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-4">
                <span className="text-4xl">✏️</span>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Crucigramas</h1>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:underline">&larr; Volver a Recursos</button>
                </div>
            </div>

            {puzzle ? renderPuzzle() : (
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
                                <textarea value={clues[index]} onChange={e => handleClueChange(index, e.target.value)} placeholder={`Pista ${index + 1}`} rows={1} className="md:col-span-2 border-slate-300 rounded-md shadow-sm dark:bg-slate-700 dark:border-slate-600"/>
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

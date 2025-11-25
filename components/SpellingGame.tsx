
import React, { useState, useEffect } from 'react';
import { WordPair } from '../types';

interface SpellingGameProps {
  words: WordPair[];
  onComplete: () => void;
  onUpdateScore: (score: number) => void;
}

interface LetterState {
  char: string;
  isHidden: boolean;
  userInput: string;
}

// QWERTY Layout for Virtual Keyboard
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const SpellingGame: React.FC<SpellingGameProps> = ({ words, onComplete, onUpdateScore }) => {
  // Game State
  const [queue, setQueue] = useState<WordPair[]>([]);
  const [mistakenWords, setMistakenWords] = useState<WordPair[]>([]);
  
  // Current Round State
  const [letters, setLetters] = useState<LetterState[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hasErrorOnCurrent, setHasErrorOnCurrent] = useState(false); 
  const [isFinished, setIsFinished] = useState(false);
  
  // Input Focus Tracking
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Keyboard State
  const [isUpperCase, setIsUpperCase] = useState(false);

  // Stats
  const [initialCount, setInitialCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // Initialize Queue
  useEffect(() => {
    setQueue([...words]);
    setInitialCount(words.length);
    setCompletedCount(0);
    setMistakenWords([]);
    setIsFinished(false);
    setHasErrorOnCurrent(false);
  }, [words]);

  const currentWord = queue.length > 0 ? queue[0] : null;

  // Initialize Letters for current word
  useEffect(() => {
    if (!currentWord) {
        if (initialCount > 0 && completedCount >= initialCount && queue.length === 0) {
            setIsFinished(true);
        }
        return;
    }

    const chars = currentWord.en.split('');
    const newLetters: LetterState[] = chars.map((char) => {
      const isAlpha = /[a-zA-Z]/.test(char);
      const isHidden = isAlpha && Math.random() > 0.4; 
      return {
        char,
        isHidden,
        userInput: ''
      };
    });

    const alphaIndices = newLetters.map((l, i) => l.isHidden ? i : -1).filter(i => i !== -1);
    if (alphaIndices.length === 0 && /[a-zA-Z]/.test(currentWord.en)) {
       for (let i = newLetters.length - 1; i >= 0; i--) {
         if (/[a-zA-Z]/.test(newLetters[i].char)) {
           newLetters[i].isHidden = true;
           break;
         }
       }
    }

    setLetters(newLetters);
    setFeedback('idle');
    setHasErrorOnCurrent(false);
    
    // Find first hidden index to set as active
    const firstHidden = newLetters.findIndex(l => l.isHidden);
    setActiveIndex(firstHidden);

  }, [currentWord, completedCount, initialCount, queue.length]);

  const updateLetterState = (index: number, char: string) => {
    if (feedback === 'wrong') {
        setFeedback('idle');
    }

    const newLetters = [...letters];
    newLetters[index].userInput = char;
    setLetters(newLetters);

    // Auto-advance
    if (char) {
      let nextInputIndex = -1;
      for (let i = index + 1; i < letters.length; i++) {
        if (letters[i].isHidden) {
          nextInputIndex = i;
          break;
        }
      }
      // Update active index regardless of focus
      if (nextInputIndex !== -1) {
        setActiveIndex(nextInputIndex);
      }
    }
  };

  // Virtual Keyboard Handler
  const handleVirtualKey = (key: string) => {
      if (feedback === 'correct' || activeIndex === -1) return;
      if (feedback === 'wrong') setFeedback('idle');

      if (key === 'BACKSPACE') {
          const currentVal = letters[activeIndex].userInput;
          if (currentVal) {
              // Clear current
              const newLetters = [...letters];
              newLetters[activeIndex].userInput = '';
              setLetters(newLetters);
          } else {
              // Move back and clear
              let prevInputIndex = -1;
              for (let i = activeIndex - 1; i >= 0; i--) {
                if (letters[i].isHidden) {
                  prevInputIndex = i;
                  break;
                }
              }
              if (prevInputIndex !== -1) {
                  setActiveIndex(prevInputIndex);
                  const newLetters = [...letters];
                  newLetters[prevInputIndex].userInput = '';
                  setLetters(newLetters);
              }
          }
      } else {
          // Character Input
          updateLetterState(activeIndex, key);
      }
  };

  const checkAnswer = () => {
    if (feedback === 'correct' || !currentWord) return;

    const userWord = letters.map(l => l.isHidden ? l.userInput : l.char).join('');
    const targetWord = currentWord.en;

    if (userWord.toLowerCase() === targetWord.toLowerCase()) {
      setFeedback('correct');
      onUpdateScore(completedCount + 1);
      setTimeout(() => {
        setCompletedCount(prev => prev + 1);
        setQueue(prev => prev.slice(1)); 
      }, 400); // Reduced delay for faster gameplay
    } else {
      setFeedback('wrong');
      if (!hasErrorOnCurrent) {
          setHasErrorOnCurrent(true);
          setMistakenWords(prev => {
              const alreadyExists = prev.some(w => w.en === currentWord.en);
              return alreadyExists ? prev : [...prev, currentWord];
          });
          setQueue(prev => [...prev, currentWord]);
      }
      
      // On error, reset focus/active to first hidden letter to allow retry
      const firstHidden = letters.findIndex(l => l.isHidden);
      setActiveIndex(firstHidden);
    }
  };

  if (isFinished) {
    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px] animate-[fadeIn_0.5s_ease-out]">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full border border-slate-100 flex flex-col items-center text-center">
                <h2 className="text-3xl font-bold text-slate-800 mb-4">Spelling Complete! ✍️</h2>
                {mistakenWords.length === 0 ? (
                    <div className="mb-8">
                        <div className="text-6xl mb-4">🏆</div>
                        <p className="text-xl text-green-600 font-medium">Perfect! You didn't make a single mistake.</p>
                    </div>
                ) : (
                    <div className="w-full mb-8">
                        <p className="text-slate-600 mb-4">You mastered these words after some practice:</p>
                        <div className="bg-red-50 rounded-xl p-4 max-h-60 overflow-y-auto border border-red-100">
                            <ul className="divide-y divide-red-100">
                                {mistakenWords.map((w, i) => (
                                    <li key={i} className="py-2 flex justify-between items-center text-sm sm:text-base">
                                        <span className="font-bold text-slate-700">{w.en}</span>
                                        <span className="text-slate-500">{w.cn}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
                <button
                    onClick={onComplete}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-200"
                >
                    Finish Game
                </button>
            </div>
        </div>
    );
  }

  if (!currentWord) return null;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
      <div className={`bg-white rounded-2xl shadow-xl p-4 sm:p-8 w-full border border-slate-100 flex flex-col items-center text-center transition-all duration-300 ${feedback === 'wrong' ? 'animate-[shake_0.5s_ease-in-out] border-red-300' : ''}`}>
        
        {/* Progress */}
        <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
           <div 
             className="bg-indigo-500 h-full transition-all duration-500"
             style={{ width: `${Math.min(100, (completedCount / initialCount) * 100)}%` }}
           ></div>
        </div>

        {/* Chinese Definition */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-8">
          {currentWord.cn}
        </h2>

        {/* Word Input Boxes (Divs) */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {letters.map((letter, idx) => {
            if (!letter.isHidden) {
              return (
                <span key={idx} className="w-8 h-12 sm:w-10 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-mono font-bold text-slate-500 bg-slate-50 rounded-lg border border-transparent select-none">
                  {letter.char}
                </span>
              );
            }

            const isActive = idx === activeIndex;

            return (
              <div
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`w-8 h-12 sm:w-10 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-mono font-bold border-2 rounded-lg transition-all cursor-pointer select-none
                  ${feedback === 'idle' ? 'text-slate-800' : ''}
                  ${isActive && feedback === 'idle' ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}
                  ${feedback === 'correct' ? 'border-green-500 bg-green-50 text-green-700' : ''}
                  ${feedback === 'wrong' ? 'border-red-500 bg-red-50 text-red-700' : ''}
                `}
              >
                {letter.userInput}
              </div>
            );
          })}
        </div>

        {/* Feedback Text */}
        <div className="h-6 mb-4">
            {feedback === 'wrong' && <p className="text-red-500 font-bold">Incorrect. Try again!</p>}
            {feedback === 'correct' && <p className="text-green-500 font-bold animate-[pulse_0.5s_ease-in-out_infinite]">Correct!</p>}
        </div>

        {/* Check Button */}
        <button
          onClick={checkAnswer}
          disabled={feedback === 'correct'}
          className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-md mb-8
             ${feedback === 'correct'
                ? 'bg-green-500 hover:bg-green-600' 
                : feedback === 'wrong'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-indigo-600 hover:bg-indigo-700'
             }
          `}
        >
          {feedback === 'correct' ? 'Next...' : feedback === 'wrong' ? 'Retry' : 'Check Answer'}
        </button>

        {/* Virtual Keyboard */}
        <div className="w-full pt-4 border-t border-slate-100">
            <div className="flex flex-col gap-2">
                {KEYBOARD_ROWS.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex justify-center gap-1 sm:gap-2">
                        {row.map((char) => {
                            const displayChar = isUpperCase ? char.toUpperCase() : char;
                            return (
                                <button
                                    key={char}
                                    onClick={() => handleVirtualKey(displayChar)}
                                    className="w-8 h-14 sm:w-14 sm:h-16 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-lg shadow-sm text-lg sm:text-2xl transition-colors"
                                >
                                    {displayChar}
                                </button>
                            );
                        })}
                    </div>
                ))}
                {/* Backspace & Caps Row */}
                <div className="flex justify-center gap-2 mt-2">
                    <button
                        onClick={() => setIsUpperCase(!isUpperCase)}
                        className={`px-4 h-14 sm:h-16 font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors ${
                            isUpperCase 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300 active:bg-slate-400'
                        }`}
                        aria-label="Toggle Uppercase"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <button
                        onClick={() => handleVirtualKey('BACKSPACE')}
                        className="px-6 h-14 sm:h-16 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-600 font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors text-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Backspace
                    </button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SpellingGame;

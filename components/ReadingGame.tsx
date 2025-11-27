
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WordPair } from '../types';

interface ReadingGameProps {
  sentences: WordPair[];
  onComplete: () => void;
  onUpdateScore: (score: number) => void;
}

const ReadingGame: React.FC<ReadingGameProps> = ({ sentences, onComplete, onUpdateScore }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [options, setOptions] = useState<string[]>([]);
  
  // New states for the listening phase
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const currentPair = sentences[currentIndex];

  // Helper to shuffle array
  const shuffle = <T,>(array: T[]): T[] => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const speakSentence = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    setIsAudioPlaying(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.5; // Slow rate for reading

    // Attempt to select a female English voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
        voice.lang.startsWith('en') && (
            voice.name.includes('Google US English') || 
            voice.name.includes('Samantha') || 
            voice.name.includes('Microsoft Zira') ||
            voice.name.toLowerCase().includes('female')
        )
    );

    if (femaleVoice) {
        utterance.voice = femaleVoice;
    }

    utterance.onend = () => {
        setIsAudioPlaying(false);
    };
    utterance.onerror = () => {
        setIsAudioPlaying(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  // Generate options when current sentence changes
  useEffect(() => {
    if (!currentPair) return;

    // Correct answer
    const correct = currentPair.cn;

    // 1. Filter out the correct answer from potential distractors
    const potentialDistractors = sentences.filter(s => s.cn !== correct);

    // 2. Score distractors based on "confusion" level relative to the correct answer
    const scoredDistractors = potentialDistractors.map(s => {
        let score = 0;
        const distractorText = s.cn;
        
        // A. Length Similarity Score
        // If length is identical or very close, it's harder to distinguish visually
        const lenDiff = Math.abs(correct.length - distractorText.length);
        if (lenDiff === 0) score += 5;
        else if (lenDiff <= 2) score += 3;
        else if (lenDiff <= 4) score += 1;

        // B. Character Overlap Score
        // If they share characters (e.g., "This is my..." vs "That is my..."), it's tricky
        const correctChars = new Set(correct.split(''));
        let overlapCount = 0;
        for (const char of distractorText) {
            if (correctChars.has(char)) {
                overlapCount++;
            }
        }
        score += (overlapCount * 2);

        return {
            text: distractorText,
            score: score,
            random: Math.random() // Add randomness for tie-breaking so we don't always get the exact same subset
        };
    });

    // 3. Sort by score descending (most confusing first), then random
    scoredDistractors.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        return a.random - b.random;
    });

    // 4. Pick top 3 "trickiest" distractors
    const topDistractors = scoredDistractors.slice(0, 3).map(d => d.text);
    
    // 5. Combine with correct answer and shuffle for display
    const finalOptions = shuffle([correct, ...topDistractors]);
    
    setOptions(finalOptions);
    setSelectedOption(null);
    setFeedback('idle');
    setIsRevealed(false); // Initially hide options

    // Auto-play audio
    speakSentence(currentPair.en);

  }, [currentIndex, sentences, currentPair, speakSentence]);

  const handleOptionClick = (option: string) => {
    // Only block input if we already have the correct answer and are transitioning
    if (feedback === 'correct') return; 

    setSelectedOption(option);
    
    if (option === currentPair.cn) {
      setFeedback('correct');
      onUpdateScore(completedCount + 1);
      
      // Auto-advance after delay
      setTimeout(() => {
        if (currentIndex < sentences.length - 1) {
          setCompletedCount(prev => prev + 1);
          setCurrentIndex(prev => prev + 1);
        } else {
          setCompletedCount(prev => prev + 1);
          onComplete();
        }
      }, 700); // Reduced delay for faster transition
    } else {
      setFeedback('wrong');
    }
  };

  if (!currentPair) return null;

  const progressPercentage = ((currentIndex) / sentences.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 w-full border border-slate-100 flex flex-col items-center text-center">
        
        {/* Progress */}
        <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
           <div 
             className="bg-indigo-500 h-full transition-all duration-500"
             style={{ width: `${progressPercentage}%` }}
           ></div>
        </div>

        {/* English Sentence Display */}
        <div className="w-full mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-relaxed mb-4">
                {currentPair.en}
            </h2>
            
            <button 
                onClick={() => speakSentence(currentPair.en)}
                className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-colors shadow-sm ${isAudioPlaying ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'}`}
            >
                {isAudioPlaying ? (
                    <>
                       <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                        </span>
                        Playing...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        Play Audio
                    </>
                )}
            </button>
        </div>

        {/* Question Prompt */}
        <p className="text-slate-500 mb-4 text-sm uppercase tracking-wider font-semibold">
            Select the correct meaning:
        </p>

        {/* Options Grid or Reveal Button */}
        {!isRevealed ? (
             <div className="w-full h-64 flex items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                {isAudioPlaying ? (
                     <div className="flex flex-col items-center text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 animate-pulse text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <p className="font-medium">Listen carefully...</p>
                     </div>
                ) : (
                     <button
                        onClick={() => setIsRevealed(true)}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                     >
                        Show Options
                     </button>
                )}
             </div>
        ) : (
            <div className="w-full grid gap-3">
                {options.map((opt, idx) => {
                    let stateClass = "bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700";
                    
                    if (selectedOption === opt) {
                        if (feedback === 'correct') {
                            stateClass = "bg-green-100 border-green-500 text-green-800 shadow-md ring-1 ring-green-500";
                        } else if (feedback === 'wrong') {
                            stateClass = "bg-red-50 border-red-500 text-red-800 shadow-md ring-1 ring-red-500 animate-[shake_0.4s_ease-in-out]";
                        }
                    }

                    return (
                        <button
                            key={idx}
                            onClick={() => handleOptionClick(opt)}
                            disabled={feedback === 'correct'}
                            className={`w-full p-4 rounded-xl border-2 text-lg font-medium transition-all transform active:scale-[0.99] ${stateClass}`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        )}

        {/* Feedback Messages Container */}
        <div className="mt-6 h-8">
            {feedback === 'wrong' && (
                 <p className="text-red-500 font-bold animate-[shake_0.5s_ease-in-out]">Incorrect. Try another!</p>
            )}

            {feedback === 'correct' && (
                 <div className="flex items-center justify-center text-green-600 font-bold gap-2 animate-bounce">
                    <span>Good Job!</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                 </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default ReadingGame;

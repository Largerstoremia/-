
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CardItem, GameLevel, GameState, WordPair, CustomDeck, GameMode } from './types';
import { fetchWordPairs, fetchSentences } from './services/geminiService';
import Card from './components/Card';
import GameControls from './components/GameControls';
import ResultModal from './components/ResultModal';
import DeckBuilderModal from './components/DeckBuilderModal';
import SpellingGame from './components/SpellingGame';
import ReadingGame from './components/ReadingGame';

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

const STORAGE_KEY = 'lingoflip_custom_decks';
const BATCH_SIZE_PAIRS = 8; // 8 pairs = 16 cards max

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Idle);
  const [gameMode, setGameMode] = useState<GameMode>('match');
  
  // Deck State
  const [currentDeckId, setCurrentDeckId] = useState<string>(GameLevel.Unit1);
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>([]);
  
  // Builder/Edit State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState<CustomDeck | null>(null);
  
  // Deletion State
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [deckToDeleteId, setDeckToDeleteId] = useState<string | null>(null);

  // Game Data
  const [allRoundPairs, setAllRoundPairs] = useState<WordPair[]>([]); // All pairs for this game session
  const [pendingPairs, setPendingPairs] = useState<WordPair[]>([]); // Pairs waiting for next batch
  const [cards, setCards] = useState<CardItem[]>([]); // Currently visible cards
  
  // Gameplay State
  const [firstCardId, setFirstCardId] = useState<string | null>(null);
  const [secondCardId, setSecondCardId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set()); // Matched IDs in CURRENT batch
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for timer interval
  const timerRef = useRef<number | null>(null);

  // Load custom decks from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCustomDecks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom decks", e);
      }
    }
  }, []);

  const saveCustomDeck = (name: string, pairs: WordPair[], existingId?: string) => {
    let updatedDecks: CustomDeck[];
    let targetId = existingId;

    if (existingId) {
      // Edit existing
      updatedDecks = customDecks.map(d => 
        d.id === existingId 
          ? { ...d, name, pairs, createdAt: Date.now() } // Update timestamp?
          : d
      );
    } else {
      // Create new
      targetId = `custom-${Date.now()}`;
      const newDeck: CustomDeck = {
        id: targetId,
        name,
        pairs,
        createdAt: Date.now()
      };
      updatedDecks = [...customDecks, newDeck];
    }

    setCustomDecks(updatedDecks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks));
    
    if (targetId) {
        setCurrentDeckId(targetId); 
    }
  };

  const deleteCustomDeck = (id: string) => {
    const newDecks = customDecks.filter(d => d.id !== id);
    setCustomDecks(newDecks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDecks));
    
    // If the deleted deck was the one currently being played, reset to Unit 1
    if (currentDeckId === id) {
      setCurrentDeckId(GameLevel.Unit1);
      // Ensure we are in idle state
      setGameState(GameState.Idle);
      setCards([]);
    }
    
    setIsDeleteMode(false);
    setDeckToDeleteId(null);
  };

  const openBuilderForEdit = () => {
    const deck = customDecks.find(d => d.id === currentDeckId);
    if (deck) {
      setDeckToEdit(deck);
      setIsBuilderOpen(true);
    }
  };

  const openBuilderNew = () => {
    setDeckToEdit(null);
    setIsBuilderOpen(true);
  };

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  const generateCardsFromPairs = (pairs: WordPair[]) => {
    const newCards: CardItem[] = [];
    pairs.forEach((pair, index) => {
      const uniqueSuffix = Math.random().toString(36).substr(2, 5); // Ensure unique IDs across batches if needed
      const pairId = `pair-${index}-${uniqueSuffix}`; 
      newCards.push({
        id: `${pairId}-en`,
        pairId: pairId,
        content: pair.en,
        type: 'en',
        isFlipped: true,
        isMatched: false,
      });
      newCards.push({
        id: `${pairId}-cn`,
        pairId: pairId,
        content: pair.cn,
        type: 'cn',
        isFlipped: true,
        isMatched: false,
      });
    });
    return shuffleArray(newCards);
  };

  const startBatch = useCallback((pairsForBatch: WordPair[]) => {
    const batchCards = generateCardsFromPairs(pairsForBatch);
    setCards(batchCards);
    setMatchedPairIds(new Set()); // Reset matches for the new batch
    setFirstCardId(null);
    setSecondCardId(null);
  }, []);

  const initGame = useCallback(async (overrideDeckId?: string) => {
    stopTimer();
    setGameState(GameState.Loading);
    setMoves(0);
    setTimer(0);
    setCards([]);
    setMatchedPairIds(new Set());
    setPendingPairs([]);
    setFirstCardId(null);
    setSecondCardId(null);

    const deckIdToUse = overrideDeckId || currentDeckId;
    let pairs: WordPair[] = [];

    // Determine source of words
    const customDeck = customDecks.find(d => d.id === deckIdToUse);
    
    if (gameMode === 'read') {
         // Reading Mode: use sentences
         // Note: Custom decks currently only store words, but if we extended them we'd load here
         // For now, only built-in levels support sentences properly
         pairs = await fetchSentences(deckIdToUse as GameLevel);
         
         // Shuffle sentences for random order
         setAllRoundPairs(shuffleArray(pairs));
         setGameState(GameState.Playing);

    } else {
        // Match or Spell Mode: use words
        if (customDeck) {
            pairs = [...customDeck.pairs]; // Copy
        } else {
            pairs = await fetchWordPairs(deckIdToUse as GameLevel);
        }

        // Shuffle all pairs first
        const shuffledPairs = shuffleArray(pairs);
        setAllRoundPairs(shuffledPairs);

        if (gameMode === 'match') {
            // MATCH MODE
            // Slice first batch
            const firstBatch = shuffledPairs.slice(0, BATCH_SIZE_PAIRS);
            const remaining = shuffledPairs.slice(BATCH_SIZE_PAIRS);

            setPendingPairs(remaining);
            
            // Start game
            startBatch(firstBatch);
            setGameState(GameState.Playing);
            startTimer();
        } else {
            // SPELLING MODE
            // Use all words sequentially
            setGameState(GameState.Playing);
        }
    }

  }, [currentDeckId, customDecks, startTimer, stopTimer, startBatch, gameMode]);

  // Check Win / Batch Completion Condition (MATCH MODE ONLY)
  useEffect(() => {
    if (gameMode === 'match' && gameState === GameState.Playing && cards.length > 0) {
      const isBatchComplete = matchedPairIds.size === cards.length / 2;
      
      if (isBatchComplete) {
        // If there are more pairs pending, load them
        if (pendingPairs.length > 0) {
           // Small delay to show empty board before new cards appear
           const timeoutId = setTimeout(() => {
             const nextBatch = pendingPairs.slice(0, BATCH_SIZE_PAIRS);
             const remaining = pendingPairs.slice(BATCH_SIZE_PAIRS);
             setPendingPairs(remaining);
             startBatch(nextBatch);
           }, 600);
           return () => clearTimeout(timeoutId);
        } else {
           // No more pairs -> Game Won
           stopTimer();
           setGameState(GameState.Won);
        }
      }
    }
  }, [matchedPairIds, cards.length, gameState, pendingPairs, stopTimer, startBatch, gameMode]);

  const handleCardClick = (clickedCard: CardItem) => {
    if (
      gameState !== GameState.Playing || 
      isProcessing || 
      clickedCard.isMatched ||
      clickedCard.id === firstCardId 
    ) {
      // If clicking the already selected first card, deselect it
      if (clickedCard.id === firstCardId) {
        setFirstCardId(null);
      }
      return;
    }

    if (!firstCardId) {
      // --- Selection 1 ---
      // Just highlight the border (logic handled in Card via isSelected)
      setFirstCardId(clickedCard.id);
    } else {
      // --- Selection 2 ---
      setSecondCardId(clickedCard.id);
      setMoves(prev => prev + 1);
      
      const firstCard = cards.find(c => c.id === firstCardId);
      
      if (firstCard) {
        if (firstCard.pairId === clickedCard.pairId) {
          // --- MATCH ---
          setIsProcessing(true);
          
          // Flip both cards (animate to back)
          setCards(prev => prev.map(c => 
            c.pairId === firstCard.pairId ? { ...c, isFlipped: false } : c
          ));

          // Wait for animation then mark matched
          setTimeout(() => {
            setMatchedPairIds(prev => new Set(prev).add(firstCard.pairId));
            setCards(prev => prev.map(c => 
              c.pairId === firstCard.pairId ? { ...c, isMatched: true } : c
            ));
            setFirstCardId(null);
            setSecondCardId(null);
            setIsProcessing(false);
          }, 500);
          
        } else {
          // --- MISMATCH ---
          setIsProcessing(true);
          // Allow both to show selected state briefly
          setTimeout(() => {
             // Restore both to initial state (unselected)
             setFirstCardId(null);
             setSecondCardId(null);
             setIsProcessing(false);
          }, 400);
        }
      }
    }
  };

  const handleRestart = () => {
    initGame();
  };

  const handleExit = () => {
    stopTimer();
    setGameState(GameState.Idle);
    setCards([]);
    setTimer(0);
    setMoves(0);
  };

  const handleToggleDeleteMode = () => {
    setIsDeleteMode(prev => !prev);
    setDeckToDeleteId(null); // Always reset selection when toggling
  };

  const handleDeckChange = (id: string) => {
    if (isDeleteMode) {
      const isCustom = customDecks.some(d => d.id === id);
      if (isCustom) {
        // Step 1: Select for deletion
        setDeckToDeleteId(id);
      } else if (id !== "") {
        alert("You cannot delete standard textbook units.");
        setDeckToDeleteId(null);
      }
      return;
    }

    setCurrentDeckId(id);
  };

  const handleConfirmDelete = () => {
    if (deckToDeleteId) {
      deleteCustomDeck(deckToDeleteId);
    }
  };

  const handleSubGameComplete = () => {
    setGameState(GameState.Won);
  };

  const renderGameContent = () => {
    switch (gameMode) {
        case 'match':
            return cards.length > 0 ? (
                <div className="grid grid-cols-4 gap-3 sm:gap-4 auto-rows-fr perspective-1000">
                    {cards.map(card => (
                    <Card 
                        key={card.id} 
                        card={card} 
                        onClick={handleCardClick} 
                        disabled={isProcessing}
                        isSelected={firstCardId === card.id || secondCardId === card.id}
                    />
                    ))}
                </div>
            ) : null;
        case 'spell':
            return (
                <SpellingGame 
                    words={allRoundPairs} 
                    onComplete={handleSubGameComplete} 
                    onUpdateScore={(newScore) => setMoves(newScore)}
                />
            );
        case 'read':
            return (
                <ReadingGame 
                    sentences={allRoundPairs}
                    onComplete={handleSubGameComplete}
                    onUpdateScore={(newScore) => setMoves(newScore)}
                />
            );
        default:
            return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-slate-100 p-4 font-sans text-slate-900">
      
      <GameControls 
        currentDeckId={currentDeckId}
        setDeckId={handleDeckChange}
        customDecks={customDecks}
        gameState={gameState}
        onRestart={handleRestart}
        onExit={handleExit}
        onOpenBuilder={openBuilderNew}
        onEditDeck={openBuilderForEdit}
        moves={moves}
        timer={timer}
        isDeleteMode={isDeleteMode}
        onToggleDeleteMode={handleToggleDeleteMode}
        deckToDeleteId={deckToDeleteId}
        onConfirmDelete={handleConfirmDelete}
        gameMode={gameMode}
        setGameMode={setGameMode}
      />

      <main className="max-w-xl mx-auto pb-10">
        {gameState === GameState.Loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
             <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
             <p className="text-slate-500 font-medium animate-pulse">Preparing your game...</p>
          </div>
        ) : gameState === GameState.Playing ? (
            renderGameContent()
        ) : gameState === GameState.Idle ? (
            <div className="flex flex-col items-center justify-center h-80 text-center text-slate-400">
                <p className="text-lg">Ready to play?</p>
                <p className="text-sm">Select a deck, choose a mode, and click Start</p>
            </div>
        ) : null}
      </main>

      <ResultModal 
        isOpen={gameState === GameState.Won} 
        moves={moves}
        time={timer}
        onClose={handleRestart}
        words={allRoundPairs}
      />

      <DeckBuilderModal 
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSave={saveCustomDeck}
        editingDeck={deckToEdit}
      />

    </div>
  );
};

export default App;

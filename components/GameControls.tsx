
import React from 'react';
import { GameLevel, GameState, CustomDeck, GameMode } from '../types';

interface GameControlsProps {
  currentDeckId: string;
  setDeckId: (id: string) => void;
  customDecks: CustomDeck[];
  gameState: GameState;
  onRestart: () => void;
  onExit: () => void;
  onOpenBuilder: () => void;
  onEditDeck: () => void;
  moves: number;
  timer: number;
  isDeleteMode: boolean;
  onToggleDeleteMode: () => void;
  deckToDeleteId: string | null;
  onConfirmDelete: () => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const GameControls: React.FC<GameControlsProps> = ({
  currentDeckId,
  setDeckId,
  customDecks,
  gameState,
  onRestart,
  onExit,
  onOpenBuilder,
  onEditDeck,
  moves,
  timer,
  isDeleteMode,
  onToggleDeleteMode,
  deckToDeleteId,
  onConfirmDelete,
  gameMode,
  setGameMode
}) => {
  const isCustomDeck = customDecks.some(d => d.id === currentDeckId);

  // Determine button state behavior
  const handleDeleteButtonClick = () => {
    if (isDeleteMode && deckToDeleteId) {
      onConfirmDelete();
    } else {
      onToggleDeleteMode();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200">
      
      {/* Top Row: Brand & Game Mode Toggle */}
      <div className="flex w-full lg:w-auto justify-between lg:justify-start items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
            <div className="w-12 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200 text-lg">
            铭
            </div>
            <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Match&Spell</h1>
            <p className="text-xs text-slate-500">Match & Spell</p>
            </div>
        </div>

        {/* Game Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
                onClick={() => setGameMode('match')}
                disabled={gameState === GameState.Playing}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    gameMode === 'match' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                Match
            </button>
            <button
                onClick={() => setGameMode('spell')}
                disabled={gameState === GameState.Playing}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    gameMode === 'spell' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                Spell
            </button>
        </div>
      </div>

      {/* Stats (Hidden on mobile? Or moved to bottom? Keeping visible for now but might wrap) */}
      <div className="flex items-center gap-6 text-sm font-medium text-slate-600 order-3 lg:order-2 w-full lg:w-auto justify-center lg:justify-start py-2 lg:py-0 border-t lg:border-none border-slate-100 lg:bg-transparent">
        {gameMode === 'match' && (
          <>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Time</span>
              <span className="text-lg font-mono text-slate-800">{formatTime(timer)}</span>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
          </>
        )}
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-400 uppercase tracking-wider">{gameMode === 'match' ? 'Moves' : 'Score'}</span>
          <span className="text-lg font-mono text-slate-800">{moves}</span>
        </div>
      </div>

      {/* Bottom Row: Controls */}
      <div className="flex flex-nowrap justify-center items-center gap-2 order-2 lg:order-3 w-full lg:w-auto">
        
        {/* Delete Mode Toggle / Confirm Button */}
        <button
          onClick={handleDeleteButtonClick}
          disabled={gameState === GameState.Playing}
          className={`flex-shrink-0 px-3 py-2 border rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 ${
            isDeleteMode 
              ? deckToDeleteId
                ? 'bg-green-600 border-green-600 text-white hover:bg-green-700 focus:ring-green-500' // Confirm State
                : 'bg-red-50 border-red-500 text-red-600 focus:ring-red-500' // Active Mode State
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50' // Default State
          }`}
        >
          {isDeleteMode && deckToDeleteId ? (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
             </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>

        {/* Deck Selector - Adjusted width for mobile */}
        <select
          value={isDeleteMode ? (deckToDeleteId || "") : currentDeckId}
          onChange={(e) => setDeckId(e.target.value)}
          disabled={gameState === GameState.Playing}
          className={`w-28 sm:w-40 lg:w-48 px-2 py-2 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors text-ellipsis overflow-hidden ${
             isDeleteMode 
               ? 'bg-red-50 border-red-300 text-red-600 focus:ring-red-500' 
               : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-indigo-500'
          }`}
        >
          {isDeleteMode && <option value="" disabled>Select...</option>}
          <optgroup label="Textbook Units">
            <option value={GameLevel.Unit1}>Unit 1</option>
            <option value={GameLevel.Unit1Supplement}>Unit 1 补充</option>
            <option value={GameLevel.Unit2}>Unit 2</option>
            <option value={GameLevel.Unit2Supplement}>Unit 2 补充</option>
            <option value={GameLevel.Unit3}>Unit 3</option>
            <option value={GameLevel.Unit4}>Unit 4</option>
            <option value={GameLevel.Unit5}>Unit 5</option>
            <option value={GameLevel.Unit6}>Unit 6</option>
          </optgroup>
          {customDecks.length > 0 && (
            <optgroup label="My Decks">
              {customDecks.map(deck => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </optgroup>
          )}
        </select>

        {/* Edit Button */}
        {isCustomDeck && gameState !== GameState.Playing && !isDeleteMode && (
          <button
            onClick={onEditDeck}
            className="flex-shrink-0 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        )}

        {/* Create New Button */}
        <button
          onClick={onOpenBuilder}
          disabled={gameState === GameState.Playing || isDeleteMode}
          className="flex-shrink-0 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Action Button: Start/Restart or Exit */}
        {gameState === GameState.Playing ? (
          <button
            onClick={onExit}
            className="flex-shrink-0 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
          >
            Exit
          </button>
        ) : (
          <button
            onClick={onRestart}
            disabled={isDeleteMode}
            className="flex-shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-indigo-400"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
};

export default GameControls;

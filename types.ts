
export enum GameLevel {
  Unit1 = 'Unit 1',
  Unit1Supplement = 'Unit 1 补充',
  Unit2 = 'Unit 2',
  Unit2Supplement = 'Unit 2 补充',
  Unit3 = 'Unit 3',
  Unit4 = 'Unit 4',
  Unit5 = 'Unit 5',
  Unit6 = 'Unit 6',
  Custom = 'Custom',
}

export interface WordPair {
  en: string; // English word
  cn: string; // Chinese translation
}

export interface CustomDeck {
  id: string;
  name: string;
  pairs: WordPair[];
  createdAt: number;
}

export interface CardItem {
  id: string; // Unique ID for React keys
  pairId: string; // ID connecting the EN and CN pair
  content: string; // The text to display
  type: 'en' | 'cn';
  isFlipped: boolean; // true = Face Up (Text Visible), false = Face Down (Back Visible)
  isMatched: boolean;
}

export enum GameState {
  Idle = 'Idle',
  Loading = 'Loading',
  Playing = 'Playing',
  Won = 'Won',
}
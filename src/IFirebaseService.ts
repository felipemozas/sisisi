import { User } from 'firebase/auth';

export interface UserScore {
  userId: string;
  email: string;
  highScore: number;
  updatedAt: any;
}

export interface IFirebaseService {
  onAuthStateChange(callback: (user: User | null) => void): () => void;
  signInWithGoogle(): Promise<User>;
  signOut(): Promise<void>;
  getUserHighScore(userId: string): Promise<number>;
  saveUserHighScore(userId: string, email: string, score: number): Promise<void>;
  getCurrentUser(): User | null;
}

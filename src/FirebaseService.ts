import { 
  User, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { IFirebaseService } from './IFirebaseService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
  * Clase FirebaseService (Capa de Servicio - OOP)
  */
export class FirebaseService implements IFirebaseService {
  private googleProvider: GoogleAuthProvider;

  constructor() {
    this.googleProvider = new GoogleAuthProvider();
  }

  /**
   * Manejador de errores obligatorio conforme al Skill de Firebase
   */
  private handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
    const currentUser = auth.currentUser;
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: currentUser?.uid || null,
        email: currentUser?.email || null,
        emailVerified: currentUser?.emailVerified || null,
        isAnonymous: currentUser?.isAnonymous || null,
        tenantId: currentUser?.tenantId || null,
        providerInfo: currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  /**
   * Registra un callback para cambios en el estado de autenticación
   */
  public onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Inicia sesión utilizando Google con Popup (preferido para el Preview)
   */
  public async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, this.googleProvider);
      return result.user;
    } catch (error) {
      console.error('Error during Google Sign-In:', error);
      throw error;
    }
  }

  /**
   * Cierra la sesión activa
   */
  public async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error during Sign-Out:', error);
      throw error;
    }
  }

  /**
   * Obtiene el usuario autenticado actual
   */
  public getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Obtiene el high score del usuario desde la colección 'scores'
   */
  public async getUserHighScore(userId: string): Promise<number> {
    const path = `scores/${userId}`;
    try {
      const docRef = doc(db, 'scores', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return typeof data.highScore === 'number' ? data.highScore : 0;
      }
      return 0;
    } catch (error) {
      this.handleFirestoreError(error, OperationType.GET, path);
    }
  }

  /**
   * Guarda o actualiza el high score del usuario de forma atómica y segura
   */
  public async saveUserHighScore(userId: string, email: string, score: number): Promise<void> {
    const path = `scores/${userId}`;
    try {
      const docRef = doc(db, 'scores', userId);
      
      // Dado que usamos serverTimestamp() en updatedAt, enviamos la estructura correspondiente
      await setDoc(docRef, {
        userId,
        email,
        highScore: score,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      this.handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

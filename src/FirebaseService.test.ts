import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseService, OperationType } from './FirebaseService';
import { auth } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';

// Mocking './firebase' to avoid authenticating with live Google services during testing
vi.mock('./firebase', () => {
  return {
    auth: {
      currentUser: {
        uid: 'test-user-123',
        email: 'test@example.com',
        emailVerified: true,
        isAnonymous: false,
        tenantId: null,
        providerData: []
      }
    },
    db: {}
  };
});

vi.mock('firebase/auth', () => {
  const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
  class MockGoogleAuthProvider {}
  return {
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: MockGoogleAuthProvider,
    signInWithPopup: vi.fn().mockResolvedValue({ user: mockUser }),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn((_auth, callback) => {
      callback(mockUser);
      return vi.fn(); // unsubscribe mock
    })
  };
});

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-server-timestamp')
  };
});

describe('FirebaseService Unit Tests (TDD)', () => {
  let service: FirebaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FirebaseService();
  });

  it('should initialize and register onAuthStateChange callback successfully', () => {
    const callback = vi.fn();
    service.onAuthStateChange(callback);
    expect(onAuthStateChanged).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ uid: 'test-user-123', email: 'test@example.com' });
  });

  it('should sign in with Google popup', async () => {
    const user = await service.signInWithGoogle();
    expect(signInWithPopup).toHaveBeenCalled();
    expect(user.uid).toBe('test-user-123');
  });

  it('should sign out successfully', async () => {
    await service.signOut();
    expect(signOut).toHaveBeenCalled();
  });

  it('should return 0 when user high score document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null
    } as any);

    const score = await service.getUserHighScore('test-user-123');
    expect(score).toBe(0);
    expect(getDoc).toHaveBeenCalled();
  });

  it('should return the score when user high score document exists', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ highScore: 154.23 })
    } as any);

    const score = await service.getUserHighScore('test-user-123');
    expect(score).toBe(154.23);
  });

  it('should catch Firestore exceptions and throw formatted JSON error conformant to guidelines', async () => {
    const errorMsg = 'Missing or insufficient permissions';
    vi.mocked(getDoc).mockRejectedValueOnce(new Error(errorMsg));

    let threw = false;
    try {
      await service.getUserHighScore('test-user-123');
    } catch (err: any) {
      threw = true;
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toContain(errorMsg);
      expect(parsed.operationType).toBe(OperationType.GET);
      expect(parsed.path).toBe('scores/test-user-123');
      expect(parsed.authInfo.userId).toBe('test-user-123');
    }
    expect(threw).toBe(true);
  });

  it('should save the high score with merge configuration', async () => {
    vi.mocked(setDoc).mockResolvedValueOnce(undefined as any);

    await service.saveUserHighScore('test-user-123', 'test@example.com', 200.5);
    expect(setDoc).toHaveBeenCalled();
  });
});

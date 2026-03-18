import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  Heart, 
  Dog, 
  Calendar, 
  ClipboardCheck, 
  MessageSquare, 
  Mail, 
  Phone, 
  MapPin, 
  ChevronRight, 
  Star, 
  Menu, 
  X,
  Instagram,
  Facebook,
  CheckCircle2,
  Info,
  Settings,
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  LogOut,
  LogIn,
  Sparkles,
  Upload,
  Clock,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from './firebase';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Database Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path || 'unknown path'}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="bg-white p-8 rounded-[40px] shadow-xl max-w-md w-full text-center border border-stone-100">
            <div className="bg-red-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <X className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">Oops!</h2>
            <p className="text-stone-600 mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-brand-primary text-white py-4 rounded-full font-bold hover:bg-brand-primary/90 transition-all shadow-md"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Types ---

type Page = 'home' | 'about' | 'our-dogs' | 'process' | 'faq' | 'contact' | 'apply' | 'admin';

interface Animal {
  id: string;
  name: string;
  category: 'puppy' | 'dam' | 'sire';
  image: string;
  description: string;
  status?: 'available' | 'reserved'; // Only for puppies
  gender?: 'Male' | 'Female';
  dob?: string;
  weight?: string;
  color?: string;
  role?: string;
  price?: number;
  createdAt?: any;
}

interface Testimonial {
  id: string;
  name: string;
  location: string;
  text: string;
  image: string;
  rating: number;
  createdAt?: any;
}

interface SiteSettings {
  companyName: string;
  email: string;
  phone: string;
  location: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  aboutText: string;
  aboutImage: string;
  aboutImage2: string;
  instagram: string;
  facebook: string;
  geneticHealthTesting: string;
  vetChecks: string;
  returnPolicy: string;
}

interface Application {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  otherPets: string;
  children: string;
  interestReason: string;
  preferredGender: string;
  preferredSize: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: any;
}

const DEFAULT_SETTINGS: SiteSettings = {
  companyName: 'Yorkie Haven',
  email: 'hello@yorkiehaven.com',
  phone: '(512) 555-0123',
  location: 'Austin, Texas',
  heroTitle: 'Health-Tested Yorkie Puppies in Austin',
  heroSubtitle: 'Raising well-socialized, genetically-cleared Yorkshire Terriers for loving families.',
  heroImage: '', // Start empty to avoid flickering
  aboutText: 'My journey with Yorkshire Terriers began over 15 years ago when I brought home my first Yorkie, Sophie. Her intelligence, loyalty, and spunky personality completely stole my heart.',
  aboutImage: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=800',
  aboutImage2: 'https://images.unsplash.com/photo-1512546148165-e44e731426df?auto=format&fit=crop&q=80&w=800',
  instagram: '#',
  facebook: '#',
  geneticHealthTesting: 'All our breeding dogs undergo extensive genetic testing for common Yorkshire Terrier health issues including Patellar Luxation, Legg-Calve-Perthes Disease, and Progressive Retinal Atrophy (PRA).',
  vetChecks: 'Every puppy receives a comprehensive wellness exam from our licensed veterinarian at 6, 9, and 12 weeks of age. They come with a full health record and up-to-date vaccinations.',
  returnPolicy: 'We offer a 2-year genetic health guarantee. If a life-threatening genetic condition is discovered, we provide a replacement puppy or a full refund. We also have a lifetime return policy—if you can ever no longer care for your dog, they must return to us.'
};

// --- Components ---

const Navbar = ({ currentPage, setPage, user, isAdmin, settings }: { currentPage: Page, setPage: (p: Page) => void, user: any, isAdmin: boolean, settings: SiteSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navItems: { label: string, value: Page }[] = [
    { label: 'Home', value: 'home' },
    { label: 'About', value: 'about' },
    { label: 'Our Dogs', value: 'our-dogs' },
    { label: 'Process', value: 'process' },
    { label: 'FAQ', value: 'faq' },
    { label: 'Contact', value: 'contact' },
  ];

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        alert("The login popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // This is usually fine, just means another request was started or it was closed
      } else {
        alert("Login failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-brand-secondary/80 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => setPage('home')}>
            <Heart className="h-8 w-8 text-brand-primary mr-2" />
            <span className="text-2xl font-serif font-bold tracking-tight text-brand-primary">{settings.companyName}</span>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 items-center">
            {navItems.map((item) => (
              <button
                key={item.value}
                onClick={() => setPage(item.value)}
                className={`text-sm font-medium transition-colors hover:text-brand-accent ${
                  currentPage === item.value ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-stone-600'
                }`}
              >
                {item.label}
              </button>
            ))}
            
            {isAdmin && (
              <button
                onClick={() => setPage('admin')}
                className={`p-2 rounded-full transition-colors ${currentPage === 'admin' ? 'bg-brand-primary text-white' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                <Settings className="h-5 w-5" />
              </button>
            )}

            {user ? (
              <div className="flex items-center space-x-4">
                <img src={user.photoURL} alt={user.displayName} className="h-8 w-8 rounded-full border border-stone-200" />
                <button onClick={() => signOut(auth)} className="text-stone-500 hover:text-red-500 transition-colors">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin} 
                disabled={isLoggingIn}
                className="text-stone-600 hover:text-brand-primary transition-colors flex items-center disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <LogIn className="h-5 w-5 mr-2" />} Admin
              </button>
            )}

            <button 
              onClick={() => setPage('apply')}
              className="bg-brand-primary text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-brand-primary/90 transition-all shadow-sm"
            >
              Apply Now
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-stone-600">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-brand-secondary border-b border-stone-200 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.value}
                  onClick={() => { setPage(item.value); setIsOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-base font-medium text-stone-600 hover:bg-stone-100 rounded-md"
                >
                  {item.label}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => { setPage('admin'); setIsOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-base font-medium text-brand-primary hover:bg-stone-100 rounded-md"
                >
                  Admin Dashboard
                </button>
              )}
              <button 
                onClick={() => { setPage('apply'); setIsOpen(false); }}
                className="block w-full text-center bg-brand-primary text-white px-3 py-3 rounded-full text-base font-medium mt-4"
              >
                Apply Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Utils ---

const compressImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- Admin Dashboard Components ---

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-stone-100"
      >
        <div className="bg-red-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{title}</h3>
        <p className="text-stone-500 mb-8">{message}</p>
        <div className="flex space-x-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-6 rounded-xl font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-3 px-6 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-all shadow-md shadow-red-200"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: 'Approved' | 'Rejected' | 'Pending' }) => {
  const config = {
    Approved: {
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Approved'
    },
    Rejected: {
      color: 'bg-rose-50 text-rose-700 border-rose-100',
      icon: <XCircle className="h-3 w-3" />,
      label: 'Rejected'
    },
    Pending: {
      color: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending'
    }
  };

  const { color, icon, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${color}`}>
      {icon}
      {label}
    </span>
  );
};

const ApplicationModal = ({ 
  application, 
  onClose 
}: { 
  application: Application | null, 
  onClose: () => void 
}) => {
  if (!application) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 max-w-2xl w-full shadow-2xl border border-stone-100 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-3xl font-serif font-bold text-stone-900">{application.fullName}</h3>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-stone-500">{application.email} • {application.phone}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="h-6 w-6 text-stone-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Location</h4>
              <p className="text-stone-900 font-medium">{application.location}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Other Pets</h4>
              <p className="text-stone-900 font-medium">{application.otherPets || 'None'}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Children</h4>
              <p className="text-stone-900 font-medium">{application.children || 'None'}</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Preferences</h4>
              <p className="text-stone-900 font-medium">{application.preferredGender} • {application.preferredSize}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Reason for Interest</h4>
              <p className="text-stone-900 font-medium leading-relaxed">{application.interestReason}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-stone-100 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AdminDashboard = ({ puppies, dogs, testimonials, settings, applications }: { puppies: Animal[], dogs: Animal[], testimonials: Testimonial[], settings: SiteSettings, applications: Application[] }) => {
  const [activeTab, setActiveTab] = useState<'dogs' | 'testimonials' | 'settings' | 'applications' | 'health'>('dogs');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingTestimonial, setIsGeneratingTestimonial] = useState(false);
  const [editingDogId, setEditingDogId] = useState<string | null>(null);
  const [dogCategory, setDogCategory] = useState<'Puppy' | 'Dam' | 'Sire'>('Puppy');
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  
  const [newDog, setNewDog] = useState<any>({
    name: '',
    gender: 'Female',
    status: 'available',
    dob: new Date().toISOString().split('T')[0],
    image: '',
    description: '',
    role: 'Dam',
    weight: '',
    color: '',
    price: 0
  });
  const [newTestimonial, setNewTestimonial] = useState<Partial<Testimonial>>({
    name: '',
    location: '',
    text: '',
    rating: 5,
    image: 'https://picsum.photos/seed/user/100/100'
  });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(settings);
  const [imageGuidance, setImageGuidance] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string;
    type: 'puppy' | 'dog' | 'testimonial' | 'application';
    title: string;
  }>({ show: false, id: '', type: 'puppy', title: '' });
  const [viewingApplication, setViewingApplication] = useState<Application | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [approvalDialog, setApprovalDialog] = useState<{ show: boolean, id: string, email: string, fullName: string, subject: string }>({
    show: false,
    id: '',
    email: '',
    fullName: '',
    subject: 'Your Puppy Application has been Approved!'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const testimonialFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSiteSettings(settings);
  }, [settings]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result as string;
      const compressed = await compressImage(base64Str);
      setNewDog(prev => ({ ...prev, image: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const handleTestimonialFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result as string;
      const compressed = await compressImage(base64Str, 400, 400); // Smaller for testimonials
      setNewTestimonial(prev => ({ ...prev, image: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const generateDogImage = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `A high-quality, professional studio portrait of a cute Yorkshire Terrier ${dogCategory === 'Puppy' ? 'puppy' : dogCategory === 'Dam' ? 'female adult dog' : 'male adult dog'}${imageGuidance ? `, ${imageGuidance}` : ''}, soft lighting, neutral background, 4k resolution.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const rawImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          const compressedImageUrl = await compressImage(rawImageUrl);
          setNewDog(prev => ({ ...prev, image: compressedImageUrl }));
          break;
        }
      }
    } catch (error) {
      console.error("Image generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePuppyDescription = async () => {
    if (!newDog.name) {
      alert("Please enter a name first.");
      return;
    }
    
    setIsGeneratingDescription(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a charming, short (2-3 sentences) description for a ${newDog.gender} Yorkie puppy named ${newDog.name} who is currently ${newDog.status}. Focus on their personality and cuteness.`,
      });
      
      if (response.text) {
        setNewDog(prev => ({ ...prev, description: response.text.trim() }));
      }
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const generateTestimonial = async () => {
    setIsGeneratingTestimonial(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Generate a realistic, heartwarming testimonial for a Yorkshire Terrier breeder named 'Yorkie Haven'. Include a full name, a location (City, State), and a 2-3 sentence testimonial about their experience with their new puppy and the breeder's professionalism. Return as JSON.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              location: { type: Type.STRING },
              text: { type: Type.STRING },
              rating: { type: Type.NUMBER }
            },
            required: ["name", "location", "text", "rating"]
          }
        }
      });
      
      const data = JSON.parse(response.text);
      if (data) {
        const randomSeed = Math.floor(Math.random() * 1000);
        setNewTestimonial({
          ...newTestimonial,
          name: data.name,
          location: data.location,
          text: data.text,
          rating: data.rating || 5,
          image: `https://picsum.photos/seed/user${randomSeed}/100/100`
        });
      }
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGeneratingTestimonial(false);
    }
  };

  const handleSaveDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDog.name || !newDog.image) return;

    const collectionName = 'animals';

    try {
      const finalImage = await compressImage(newDog.image!);
      const dogData = { 
        ...newDog, 
        image: finalImage,
        category: dogCategory.toLowerCase() as 'puppy' | 'dam' | 'sire',
        status: newDog.status?.toLowerCase() as 'available' | 'reserved'
      };
      
      // Clean up data based on category
      if (dogCategory === 'Puppy') {
        delete dogData.role;
        delete dogData.weight;
        delete dogData.color;
      } else {
        delete dogData.gender;
        delete dogData.status;
        delete dogData.dob;
        delete dogData.description;
        dogData.role = dogCategory;
      }

      if (editingDogId) {
        const path = `${collectionName}/${editingDogId}`;
        try {
          await updateDoc(doc(db, collectionName, editingDogId), {
            ...dogData,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
        setEditingDogId(null);
      } else {
        const dogRef = doc(collection(db, collectionName));
        try {
          await setDoc(dogRef, {
            ...dogData,
            id: dogRef.id,
            createdAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, collectionName);
        }
      }
      setNewDog({
        name: '',
        gender: 'Female',
        status: 'Available',
        dob: new Date().toISOString().split('T')[0],
        image: '',
        description: '',
        role: 'Dam',
        weight: '',
        color: '',
        price: 0
      });
    } catch (error) {
      console.error("Failed to save dog", error);
    }
  };

  const handleEditDog = (dog: Animal) => {
    setEditingDogId(dog.id);
    const categoryMap: Record<string, 'Puppy' | 'Dam' | 'Sire'> = {
      'puppy': 'Puppy',
      'dam': 'Dam',
      'sire': 'Sire'
    };
    setDogCategory(categoryMap[dog.category]);
    setNewDog(dog);
    setActiveTab('dogs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePuppy = (id: string, name: string) => {
    setDeleteConfirm({ show: true, id, type: 'puppy', title: name });
  };

  const handleDeleteDog = (id: string, name: string) => {
    setDeleteConfirm({ show: true, id, type: 'dog', title: name });
  };

  const handleDeleteTestimonial = (id: string, name: string) => {
    setDeleteConfirm({ show: true, id, type: 'testimonial', title: name });
  };

  const handleDeleteApplication = (id: string, name: string) => {
    setDeleteConfirm({ show: true, id, type: 'application', title: name });
  };

  const confirmDelete = async () => {
    const { id, type } = deleteConfirm;
    try {
      const collectionName = (type === 'puppy' || type === 'dog') ? 'animals' : 
                            (type === 'testimonial' ? 'testimonials' : 'applications');
      const path = `${collectionName}/${id}`;
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
      setDeleteConfirm({ ...deleteConfirm, show: false });
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestimonial.name || !newTestimonial.text) return;

    try {
      const testimonialData = { ...newTestimonial };
      if (editingTestimonialId) {
        const path = `testimonials/${editingTestimonialId}`;
        try {
          await updateDoc(doc(db, 'testimonials', editingTestimonialId), {
            ...testimonialData,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
        setEditingTestimonialId(null);
      } else {
        const testimonialRef = doc(collection(db, 'testimonials'));
        try {
          await setDoc(testimonialRef, {
            ...testimonialData,
            id: testimonialRef.id,
            createdAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'testimonials');
        }
      }
      setNewTestimonial({
        name: '',
        location: '',
        text: '',
        rating: 5,
        image: 'https://picsum.photos/seed/user/100/100'
      });
    } catch (error) {
      console.error("Failed to save testimonial", error);
    }
  };

  const handleEditTestimonial = (testimonial: Testimonial) => {
    setEditingTestimonialId(testimonial.id);
    setNewTestimonial(testimonial);
    setActiveTab('testimonials');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const compressedHero = await compressImage(siteSettings.heroImage);
      const compressedAbout1 = await compressImage(siteSettings.aboutImage);
      const compressedAbout2 = await compressImage(siteSettings.aboutImage2);
      
      const finalSettings = {
        ...siteSettings,
        heroImage: compressedHero,
        aboutImage: compressedAbout1,
        aboutImage2: compressedAbout2
      };

      try {
        await setDoc(doc(db, 'settings', 'global'), finalSettings);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'settings/global');
      }
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  };

  const handleUpdateAppStatus = async (id: string, status: 'Approved' | 'Rejected' | 'Pending', customSubject?: string) => {
    if (isUpdatingStatus === id) return;
    setIsUpdatingStatus(id);
    const path = `applications/${id}`;
    try {
      await updateDoc(doc(db, 'applications', id), { status });
      
      if (status === 'Approved' || status === 'Rejected') {
        const app = applications.find(a => a.id === id);
        if (app) {
          fetch('/api/send-application-status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: app.email,
              fullName: app.fullName,
              companyName: settings.companyName,
              status: status,
              subject: customSubject
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.error) {
              console.error("Email API error:", data.error);
              setStatusMessage({ text: `Status updated but email failed: ${data.error}`, type: 'error' });
            } else {
              console.log("Email API success:", data.message);
              setStatusMessage({ text: `Application ${status.toLowerCase()} and email sent!`, type: 'success' });
            }
            setTimeout(() => setStatusMessage(null), 5000);
          })
          .catch(err => {
            console.error("Failed to send status email", err);
            setStatusMessage({ text: `Status updated but email failed to send.`, type: 'error' });
            setTimeout(() => setStatusMessage(null), 5000);
          })
          .finally(() => setIsUpdatingStatus(null));
        } else {
          setIsUpdatingStatus(null);
        }
      } else {
        setStatusMessage({ text: `Application status set to ${status}.`, type: 'success' });
        setTimeout(() => setStatusMessage(null), 5000);
        setIsUpdatingStatus(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      setIsUpdatingStatus(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <ApplicationModal 
        application={viewingApplication} 
        onClose={() => setViewingApplication(null)} 
      />
      <ConfirmDialog 
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, show: false })}
        onConfirm={confirmDelete}
        title={`Delete ${deleteConfirm.type === 'application' ? 'Application' : deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)}?`}
        message={`Are you sure you want to delete "${deleteConfirm.title}"? This action cannot be undone.`}
      />
      
      {/* Approval Dialog */}
      <AnimatePresence>
        {approvalDialog.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-stone-100"
            >
              <h3 className="text-2xl font-serif font-bold text-stone-900 mb-4">Approve Application</h3>
              <p className="text-stone-500 text-sm mb-6 leading-relaxed">
                You are about to approve <strong>{approvalDialog.fullName}</strong>'s application. 
                An email will be sent to <strong>{approvalDialog.email}</strong>.
              </p>
              
              <div className="mb-8">
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-2 tracking-widest">
                  Email Subject Line
                </label>
                <input 
                  type="text"
                  value={approvalDialog.subject}
                  onChange={(e) => setApprovalDialog({ ...approvalDialog, subject: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                  placeholder="Enter custom subject line..."
                />
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={() => setApprovalDialog({ ...approvalDialog, show: false })}
                  className="flex-1 bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleUpdateAppStatus(approvalDialog.id, 'Approved', approvalDialog.subject);
                    setApprovalDialog({ ...approvalDialog, show: false });
                  }}
                  className="flex-[2] bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-md"
                >
                  Approve & Send Email
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <SectionHeading title="Admin Dashboard" subtitle="Manage your puppies and site content." />
      
      {statusMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          <span className="font-bold">{statusMessage.text}</span>
        </motion.div>
      )}
      
      <div className="flex space-x-4 mb-8 border-b border-stone-200 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('dogs')}
          className={`pb-4 px-4 font-bold whitespace-nowrap transition-all ${activeTab === 'dogs' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-stone-400'}`}
        >
          Manage Dogs
        </button>
        <button 
          onClick={() => setActiveTab('testimonials')}
          className={`pb-4 px-4 font-bold whitespace-nowrap transition-all ${activeTab === 'testimonials' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-stone-400'}`}
        >
          Testimonials
        </button>
        <button 
          onClick={() => setActiveTab('health')}
          className={`pb-4 px-4 font-bold whitespace-nowrap transition-all ${activeTab === 'health' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-stone-400'}`}
        >
          Health Guarantee
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-4 px-4 font-bold whitespace-nowrap transition-all ${activeTab === 'settings' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-stone-400'}`}
        >
          Site Settings
        </button>
        <button 
          onClick={() => setActiveTab('applications')}
          className={`pb-4 px-4 font-bold whitespace-nowrap transition-all ${activeTab === 'applications' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-stone-400'}`}
        >
          Applications {applications.filter(a => a.status === 'Pending').length > 0 && (
            <span className="ml-2 bg-brand-primary text-white text-[10px] px-2 py-0.5 rounded-full">
              {applications.filter(a => a.status === 'Pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'dogs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Add/Edit Dog Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100 sticky top-24">
              <h3 className="text-xl font-serif font-bold mb-6 flex items-center">
                {editingDogId ? <Settings className="h-5 w-5 mr-2 text-brand-primary" /> : <Plus className="h-5 w-5 mr-2 text-brand-primary" />}
                {editingDogId ? 'Edit Dog' : 'Add New Dog'}
              </h3>
              <form onSubmit={handleSaveDog} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Category</label>
                  <select 
                    value={dogCategory}
                    onChange={e => setDogCategory(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  >
                    <option value="Puppy">Puppy</option>
                    <option value="Dam">Dam</option>
                    <option value="Sire">Sire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Name</label>
                  <input 
                    required 
                    type="text" 
                    value={newDog.name}
                    onChange={e => setNewDog({...newDog, name: e.target.value})}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Price ($)</label>
                  <input 
                    type="number" 
                    value={newDog.price}
                    onChange={e => setNewDog({...newDog, price: Number(e.target.value)})}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                    placeholder="e.g., 2500"
                  />
                </div>
                
                {dogCategory === 'Puppy' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Gender</label>
                        <select 
                          value={newDog.gender}
                          onChange={e => setNewDog({...newDog, gender: e.target.value as any})}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                        >
                          <option>Male</option>
                          <option>Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Status</label>
                        <select 
                          value={newDog.status}
                          onChange={e => setNewDog({...newDog, status: e.target.value as any})}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                        >
                          <option value="available">Available</option>
                          <option value="reserved">Reserved</option>
                          <option value="upcoming">Upcoming</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1">DOB</label>
                      <input 
                        type="date" 
                        value={newDog.dob}
                        onChange={e => setNewDog({...newDog, dob: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-stone-500 uppercase">Description</label>
                        <button 
                          type="button"
                          onClick={generatePuppyDescription}
                          disabled={isGeneratingDescription}
                          className="text-[10px] font-bold text-brand-primary hover:text-brand-accent flex items-center transition-colors disabled:opacity-50"
                        >
                          {isGeneratingDescription ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                          AI Generate
                        </button>
                      </div>
                      <textarea 
                        rows={3} 
                        value={newDog.description}
                        onChange={e => setNewDog({...newDog, description: e.target.value})}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm"
                        placeholder="Tell us about this puppy's personality..."
                      ></textarea>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Weight</label>
                        <input 
                          type="text" 
                          value={newDog.weight}
                          onChange={e => setNewDog({...newDog, weight: e.target.value})}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                          placeholder="e.g., 5 lbs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Color</label>
                        <input 
                          type="text" 
                          value={newDog.color}
                          onChange={e => setNewDog({...newDog, color: e.target.value})}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                          placeholder="e.g., Blue & Gold"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <label className="block text-xs font-bold text-stone-500 uppercase">Image</label>
                  </div>
                  <div className="flex flex-col space-y-2">
                    {newDog.image ? (
                      <div className="relative group aspect-square rounded-xl overflow-hidden border border-stone-200">
                        <img src={newDog.image} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all"
                            title="Change Image"
                          >
                            <Upload className="h-6 w-6" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setNewDog({...newDog, image: ''})}
                            className="p-3 bg-red-500/50 hover:bg-red-500/70 rounded-full text-white transition-all"
                            title="Remove Image"
                          >
                            <Trash2 className="h-6 w-6" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-2">
                        <input 
                          type="text" 
                          placeholder="AI Prompt (e.g., 'sitting', 'playing')..."
                          value={imageGuidance}
                          onChange={e => setImageGuidance(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-[10px]" 
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={generateDogImage}
                            disabled={isGenerating}
                            className="py-6 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center text-stone-400 hover:border-brand-primary hover:text-brand-primary transition-all"
                          >
                            {isGenerating ? (
                              <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-6 w-6 mb-2" />
                                <span className="text-[10px] font-bold">AI Generate</span>
                              </>
                            )}
                          </button>
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-6 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center text-stone-400 hover:border-brand-primary hover:text-brand-primary transition-all"
                          >
                            <Upload className="h-6 w-6 mb-2" />
                            <span className="text-[10px] font-bold">Upload File</span>
                          </button>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Or paste image URL..."
                          value={newDog.image}
                          onChange={e => setNewDog({...newDog, image: e.target.value})}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs" 
                        />
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex space-x-2">
                  {editingDogId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingDogId(null);
                        setNewDog({
                          name: '',
                          gender: 'Female',
                          status: 'Available',
                          dob: new Date().toISOString().split('T')[0],
                          image: '',
                          description: '',
                          role: 'Dam',
                          weight: '',
                          color: ''
                        });
                      }}
                      className="flex-1 bg-stone-200 text-stone-700 py-3 rounded-xl font-bold hover:bg-stone-300 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-[2] bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-sm"
                  >
                    {editingDogId ? 'Update Dog' : 'Save Dog'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Dogs List */}
          <div className="lg:col-span-2">
            <div className="space-y-8">
              {/* Puppies Section */}
              <div>
                <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Puppies</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {puppies.map(puppy => (
                    <div key={puppy.id} className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm flex items-center space-x-4">
                      <img src={puppy.image} alt={puppy.name} className="h-20 w-20 rounded-2xl object-cover" />
                      <div className="flex-grow">
                        <h4 className="font-bold text-stone-900">{puppy.name}</h4>
                        <p className="text-xs text-stone-500">{puppy.status} • {puppy.gender}</p>
                        {puppy.price > 0 && <p className="text-xs font-bold text-brand-primary mt-1">${puppy.price.toLocaleString()}</p>}
                      </div>
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => handleEditDog(puppy)}
                          className="p-2 text-stone-300 hover:text-brand-primary transition-colors"
                        >
                          <Settings className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDeletePuppy(puppy.id, puppy.name)}
                          className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {puppies.length === 0 && <p className="text-stone-400 text-sm italic">No puppies added.</p>}
                </div>
              </div>

              {/* Adults Section */}
              <div>
                <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Dams & Sires</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {dogs.map(dog => (
                    <div key={dog.id} className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm flex items-center space-x-4">
                      <img src={dog.image} alt={dog.name} className="h-20 w-20 rounded-2xl object-cover" />
                      <div className="flex-grow">
                        <h4 className="font-bold text-stone-900">{dog.name}</h4>
                        <p className="text-xs text-stone-500">{dog.role} • {dog.weight}</p>
                        {dog.price > 0 && <p className="text-xs font-bold text-brand-primary mt-1">${dog.price.toLocaleString()}</p>}
                      </div>
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => handleEditDog(dog)}
                          className="p-2 text-stone-300 hover:text-brand-primary transition-colors"
                        >
                          <Settings className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDog(dog.id, dog.name)}
                          className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {dogs.length === 0 && <p className="text-stone-400 text-sm italic">No dams or sires added.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
          <h3 className="text-2xl font-serif font-bold mb-8 flex items-center">
            <Heart className="h-6 w-6 mr-2 text-brand-primary" /> Health Guarantee & Policies
          </h3>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Genetic Health Testing</label>
              <textarea 
                rows={4}
                value={siteSettings.geneticHealthTesting}
                onChange={e => setSiteSettings({...siteSettings, geneticHealthTesting: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                placeholder="Describe your genetic testing protocols..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Vet Checks & Vaccinations</label>
              <textarea 
                rows={4}
                value={siteSettings.vetChecks}
                onChange={e => setSiteSettings({...siteSettings, vetChecks: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                placeholder="Describe your veterinary care and vaccination schedule..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Return Policy & Health Guarantee</label>
              <textarea 
                rows={4}
                value={siteSettings.returnPolicy}
                onChange={e => setSiteSettings({...siteSettings, returnPolicy: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                placeholder="Detail your health guarantee and lifetime return policy..."
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-md"
            >
              Save Health Policies
            </button>
          </form>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
          <h3 className="text-2xl font-serif font-bold mb-8 flex items-center">
            <Settings className="h-6 w-6 mr-2 text-brand-primary" /> Company Information
          </h3>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Company Name</label>
                <input 
                  type="text" 
                  value={siteSettings.companyName}
                  onChange={e => setSiteSettings({...siteSettings, companyName: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Email</label>
                <input 
                  type="email" 
                  value={siteSettings.email}
                  onChange={e => setSiteSettings({...siteSettings, email: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Phone</label>
                <input 
                  type="text" 
                  value={siteSettings.phone}
                  onChange={e => setSiteSettings({...siteSettings, phone: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Location</label>
                <input 
                  type="text" 
                  value={siteSettings.location}
                  onChange={e => setSiteSettings({...siteSettings, location: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Hero Title</label>
              <input 
                type="text" 
                value={siteSettings.heroTitle}
                onChange={e => setSiteSettings({...siteSettings, heroTitle: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Hero Image URL</label>
              <input 
                type="text" 
                value={siteSettings.heroImage}
                onChange={e => setSiteSettings({...siteSettings, heroImage: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Hero Subtitle</label>
              <textarea 
                rows={2}
                value={siteSettings.heroSubtitle}
                onChange={e => setSiteSettings({...siteSettings, heroSubtitle: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">About Us Image 1 URL</label>
              <input 
                type="text" 
                value={siteSettings.aboutImage}
                onChange={e => setSiteSettings({...siteSettings, aboutImage: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">About Us Image 2 URL</label>
              <input 
                type="text" 
                value={siteSettings.aboutImage2}
                onChange={e => setSiteSettings({...siteSettings, aboutImage2: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">About Us Text</label>
              <textarea 
                rows={4}
                value={siteSettings.aboutText}
                onChange={e => setSiteSettings({...siteSettings, aboutText: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Instagram URL</label>
                <input 
                  type="text" 
                  value={siteSettings.instagram}
                  onChange={e => setSiteSettings({...siteSettings, instagram: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Facebook URL</label>
                <input 
                  type="text" 
                  value={siteSettings.facebook}
                  onChange={e => setSiteSettings({...siteSettings, facebook: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-md"
            >
              Save Site Settings
            </button>
          </form>
        </div>
      )}

      {activeTab === 'testimonials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100 sticky top-24">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-bold flex items-center">
                  {editingTestimonialId ? <Settings className="h-5 w-5 mr-2 text-brand-primary" /> : <Plus className="h-5 w-5 mr-2 text-brand-primary" />}
                  {editingTestimonialId ? 'Edit Testimonial' : 'Add Testimonial'}
                </h3>
                {!editingTestimonialId && (
                  <button
                    type="button"
                    onClick={generateTestimonial}
                    disabled={isGeneratingTestimonial}
                    className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 py-1.5 bg-brand-secondary text-brand-primary rounded-full hover:bg-brand-secondary/80 transition-all disabled:opacity-50"
                  >
                    {isGeneratingTestimonial ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate with AI
                  </button>
                )}
              </div>
              <form onSubmit={handleSaveTestimonial} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Name</label>
                  <input 
                    required 
                    type="text" 
                    value={newTestimonial.name}
                    onChange={e => setNewTestimonial({...newTestimonial, name: e.target.value})}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Location</label>
                  <input 
                    type="text" 
                    value={newTestimonial.location}
                    onChange={e => setNewTestimonial({...newTestimonial, location: e.target.value})}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                    placeholder="e.g., Austin, TX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Rating (1-5)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="5"
                    value={newTestimonial.rating}
                    onChange={e => setNewTestimonial({...newTestimonial, rating: parseInt(e.target.value)})}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Image</label>
                  <div className="flex flex-col space-y-2">
                    {newTestimonial.image ? (
                      <div className="relative group w-24 h-24 rounded-2xl overflow-hidden border border-stone-200">
                        <img src={newTestimonial.image} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                          <button 
                            type="button"
                            onClick={() => testimonialFileInputRef.current?.click()}
                            className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all"
                            title="Change Image"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setNewTestimonial({...newTestimonial, image: ''})}
                            className="p-1.5 bg-red-500/50 hover:bg-red-500/70 rounded-full text-white transition-all"
                            title="Remove Image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => testimonialFileInputRef.current?.click()}
                        className="w-24 h-24 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center text-stone-400 hover:border-brand-primary hover:text-brand-primary transition-all"
                      >
                        <Upload className="h-5 w-5 mb-1" />
                        <span className="text-[10px] font-bold text-center">Upload Photo</span>
                      </button>
                    )}
                    <input 
                      type="text" 
                      placeholder="Or paste image URL..."
                      value={newTestimonial.image}
                      onChange={e => setNewTestimonial({...newTestimonial, image: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs" 
                    />
                    <input 
                      type="file" 
                      ref={testimonialFileInputRef}
                      onChange={handleTestimonialFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Testimonial Text</label>
                  <textarea 
                    required
                    rows={4} 
                    value={newTestimonial.text}
                    onChange={e => setNewTestimonial({...newTestimonial, text: e.target.value})}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  ></textarea>
                </div>
                <div className="flex space-x-2">
                  {editingTestimonialId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingTestimonialId(null);
                        setNewTestimonial({ name: '', location: '', text: '', rating: 5, image: 'https://picsum.photos/seed/user/100/100' });
                      }}
                      className="flex-1 bg-stone-200 text-stone-700 py-3 rounded-xl font-bold hover:bg-stone-300 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-[2] bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-sm"
                  >
                    {editingTestimonialId ? 'Update Testimonial' : 'Save Testimonial'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {testimonials.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm flex items-center space-x-4">
                  <img src={t.image} alt={t.name} className="h-20 w-20 rounded-2xl object-cover" />
                  <div className="flex-grow">
                    <h4 className="font-bold text-stone-900">{t.name}</h4>
                    <p className="text-[10px] text-stone-500 mb-1">{t.location}</p>
                    <p className="text-[11px] text-stone-600 line-clamp-2 italic">"{t.text}"</p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <button 
                      onClick={() => handleEditTestimonial(t)}
                      className="p-2 text-stone-300 hover:text-brand-primary transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTestimonial(t.id, t.name)}
                      className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {testimonials.length === 0 && (
                <div className="col-span-full py-20 text-center text-stone-400">
                  <p>No testimonials added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          {applications.map(app => (
            <div key={app.id} className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-serif font-bold text-stone-900">{app.fullName}</h3>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="text-stone-500 text-sm">{app.email} • {app.phone} • {app.location}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setViewingApplication(app)}
                    className="bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
                  >
                    View
                  </button>
                  {app.status !== 'Approved' && (
                    <button 
                      onClick={() => setApprovalDialog({
                        show: true,
                        id: app.id,
                        email: app.email,
                        fullName: app.fullName,
                        subject: 'Your Puppy Application has been Approved!'
                      })}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition-all"
                    >
                      Approve
                    </button>
                  )}
                  {app.status !== 'Rejected' && (
                    <button 
                      onClick={() => handleUpdateAppStatus(app.id, 'Rejected')}
                      className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-all"
                    >
                      Reject
                    </button>
                  )}
                  {app.status !== 'Pending' && (
                    <button 
                      onClick={() => handleUpdateAppStatus(app.id, 'Pending')}
                      className="bg-stone-100 text-stone-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all"
                    >
                      Reset
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteApplication(app.id, app.fullName)}
                    className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                <div className="space-y-4">
                  <div>
                    <p className="text-stone-400 font-bold uppercase text-[10px] mb-1">Other Pets</p>
                    <p className="text-stone-700">{app.otherPets || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 font-bold uppercase text-[10px] mb-1">Children</p>
                    <p className="text-stone-700">{app.children || 'None'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-stone-400 font-bold uppercase text-[10px] mb-1">Preferences</p>
                    <p className="text-stone-700">{app.preferredGender} • {app.preferredSize}</p>
                  </div>
                  <div>
                    <p className="text-stone-400 font-bold uppercase text-[10px] mb-1">Reason for Interest</p>
                    <p className="text-stone-700">{app.interestReason}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-stone-50 text-[10px] text-stone-400">
                Submitted on {app.createdAt?.toDate ? app.createdAt.toDate().toLocaleDateString() : 'Recently'}
              </div>
            </div>
          ))}
          {applications.length === 0 && (
            <div className="py-20 text-center text-stone-400">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No applications received yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Page Views ---

const HomePage = ({ setPage, puppies, testimonials, settings, settingsLoading }: { setPage: (p: Page) => void, puppies: Animal[], testimonials: Testimonial[], settings: SiteSettings, settingsLoading: boolean }) => (
  <div>
    <Hero setPage={setPage} settings={settings} settingsLoading={settingsLoading} />
    
    {/* Featured Puppies */}
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading 
          title="Meet Our Little Ones" 
          subtitle="Hand-raised with love and ready to become a part of your family."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {puppies.slice(0, 3).map(puppy => (
            <PuppyCard key={puppy.id} puppy={puppy} setPage={setPage} />
          ))}
          {puppies.length === 0 && (
            <div className="col-span-full text-center py-10 text-stone-400">
              <p>Check our "Available Puppies" page for updates!</p>
            </div>
          )}
        </div>
        <div className="mt-16 text-center">
          <button 
            onClick={() => setPage('our-dogs')}
            className="inline-flex items-center text-brand-primary font-bold hover:text-brand-accent transition-colors"
          >
            See More <ChevronRight className="ml-1 h-5 w-5" />
          </button>
        </div>
      </div>
    </section>

    {/* Why Choose Us */}
    <section className="py-24 bg-brand-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionHeading 
              title="Why We Breed Yorkies" 
              subtitle="Our mission is to improve the breed through careful selection and health testing."
              centered={false}
            />
            <div className="space-y-8">
              {[
                { icon: Heart, title: 'Health First', desc: 'All our breeding dogs undergo extensive genetic testing and OFA clearances.' },
                { icon: Dog, title: 'Temperament', desc: 'We focus on breeding calm, confident, and affectionate companions.' },
                { icon: CheckCircle2, title: 'Socialization', desc: 'Puppies are raised in our home and exposed to various sights, sounds, and people.' }
              ].map((item, i) => (
                <div key={i} className="flex items-start">
                  <div className="bg-white p-3 rounded-2xl shadow-sm mr-4">
                    <item.icon className="h-6 w-6 text-brand-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">{item.title}</h4>
                    <p className="text-stone-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <img 
              src={settings.aboutImage2 || "https://images.unsplash.com/photo-1512546148165-e44e731426df?auto=format&fit=crop&q=80&w=800"} 
              alt="Breeder with Yorkie" 
              className="rounded-[40px] shadow-xl w-full aspect-[4/5] object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-3xl shadow-lg max-w-xs hidden md:block">
              <p className="text-brand-primary font-serif italic text-lg mb-2">"A Yorkie isn't just a pet, they are a piece of your heart."</p>
              <p className="text-stone-500 text-sm font-bold">— {settings.companyName} Family</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Happy Families" subtitle="Hear from those who have welcomed a Yorkie Haven puppy into their homes." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.length > 0 ? (
            testimonials.map(t => <TestimonialCard key={t.id} testimonial={t} />)
          ) : (
            <div className="col-span-full text-center py-10 text-stone-400 italic">
              "We are so happy with our new puppy!" — Example Testimonial
            </div>
          )}
        </div>
      </div>
    </section>

    {/* CTA Section */}
    <section className="py-24 bg-brand-primary text-white text-center">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">Ready to find your new best friend?</h2>
        <p className="text-xl opacity-90 mb-10">Join our waitlist or apply for an available puppy today.</p>
        <button 
          onClick={() => setPage('apply')}
          className="bg-white text-brand-primary px-10 py-4 rounded-full text-lg font-bold hover:bg-stone-100 transition-all shadow-lg"
        >
          Start Your Application
        </button>
      </div>
    </section>
  </div>
);

const Hero = ({ setPage, settings, settingsLoading }: { setPage: (p: Page) => void, settings: SiteSettings, settingsLoading: boolean }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Preload image
  useEffect(() => {
    if (settings.heroImage) {
      const img = new Image();
      img.src = settings.heroImage;
      img.onload = () => setImageLoaded(true);
    }
  }, [settings.heroImage]);

  // Don't render anything until settings are loaded and image is preloaded
  if (settingsLoading || !settings.heroImage || !imageLoaded) {
    return (
      <section className="relative h-[80vh] flex items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </section>
    );
  }

  return (
    <section className="relative h-[80vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src={settings.heroImage} 
          alt="Happy Yorkie" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <h1 className="text-5xl md:text-7xl font-serif font-bold leading-tight mb-6">
            {settings.heroTitle}
          </h1>
          <p className="text-xl md:text-2xl font-light mb-8 opacity-90">
            {settings.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => setPage('our-dogs')}
              className="bg-brand-primary text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-brand-primary/90 transition-all flex items-center justify-center"
            >
              See Available Puppies <ChevronRight className="ml-2 h-5 w-5" />
            </button>
            <button 
              onClick={() => setPage('process')}
              className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-full text-lg font-medium hover:bg-white/30 transition-all flex items-center justify-center"
            >
              Our Process
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const SectionHeading = ({ title, subtitle, centered = true }: { title: string, subtitle?: string, centered?: boolean }) => (
  <div className={`mb-12 ${centered ? 'text-center' : ''}`}>
    <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4">{title}</h2>
    {subtitle && <p className="text-lg text-stone-600 max-w-2xl mx-auto">{subtitle}</p>}
    <div className={`h-1 w-20 bg-brand-accent mt-6 ${centered ? 'mx-auto' : ''}`}></div>
  </div>
);

const PuppyCard: React.FC<{ puppy: Animal, setPage: (p: Page) => void }> = ({ puppy, setPage }) => (
  <motion.div 
    whileHover={{ y: -10 }}
    className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 flex flex-col h-full"
  >
    <div className="relative aspect-[3/4] overflow-hidden">
      <img 
        src={puppy.image} 
        alt={puppy.name} 
        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
        referrerPolicy="no-referrer"
      />
      <div className={`absolute top-4 right-4 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
        puppy.status === 'available' ? 'bg-green-500/90 text-white' : 'bg-stone-500/90 text-white'
      }`}>
        {puppy.status}
      </div>
    </div>
    <div className="p-6 flex-grow flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-2xl font-serif font-bold text-stone-900">{puppy.name}</h3>
        <div className="text-right">
          <span className="block text-sm text-stone-500">{puppy.gender}</span>
          {puppy.price > 0 && <span className="block text-lg font-bold text-brand-primary">${puppy.price.toLocaleString()}</span>}
        </div>
      </div>
      <p className="text-stone-600 text-sm mb-6 flex-grow">{puppy.description}</p>
      {puppy.status === 'available' ? (
        <button 
          onClick={() => setPage('apply')}
          className="w-full py-3 border border-brand-primary text-brand-primary rounded-full font-medium hover:bg-brand-primary hover:text-white transition-all"
        >
          Apply for {puppy.name}
        </button>
      ) : (
        <button 
          disabled
          className="w-full py-3 border border-stone-200 text-stone-400 rounded-full font-medium cursor-not-allowed"
        >
          Reserved
        </button>
      )}
    </div>
  </motion.div>
);

const TestimonialCard: React.FC<{ testimonial: Testimonial }> = ({ testimonial }) => (
  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
    <div className="flex items-center mb-6">
      <img 
        src={testimonial.image} 
        alt={testimonial.name} 
        className="w-12 h-12 rounded-full object-cover mr-4"
        referrerPolicy="no-referrer"
      />
      <div>
        <h4 className="font-bold text-stone-900">{testimonial.name}</h4>
        <p className="text-xs text-stone-500">{testimonial.location}</p>
      </div>
      <div className="ml-auto flex">
        {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-brand-accent fill-brand-accent" />)}
      </div>
    </div>
    <p className="text-stone-600 italic leading-relaxed">"{testimonial.text}"</p>
  </div>
);

const Footer = ({ setPage, settings }: { setPage: (p: Page) => void, settings: SiteSettings }) => (
  <footer className="bg-stone-900 text-white pt-20 pb-10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center mb-6">
            <Heart className="h-6 w-6 text-brand-accent mr-2" />
            <span className="text-xl font-serif font-bold tracking-tight">{settings.companyName}</span>
          </div>
          <p className="text-stone-400 text-sm leading-relaxed mb-6">
            Dedicated to breeding the healthiest and happiest Yorkshire Terriers in Texas. Our dogs are family first.
          </p>
          <div className="flex space-x-4">
            <a href={settings.instagram} className="text-stone-400 hover:text-white transition-colors"><Instagram className="h-5 w-5" /></a>
            <a href={settings.facebook} className="text-stone-400 hover:text-white transition-colors"><Facebook className="h-5 w-5" /></a>
          </div>
        </div>
        
        <div>
          <h4 className="font-serif font-bold text-lg mb-6">Quick Links</h4>
          <ul className="space-y-4 text-sm text-stone-400">
            <li><button onClick={() => setPage('home')} className="hover:text-white transition-colors">Home</button></li>
            <li><button onClick={() => setPage('about')} className="hover:text-white transition-colors">About Us</button></li>
            <li><button onClick={() => setPage('our-dogs')} className="hover:text-white transition-colors">Our Dogs & Puppies</button></li>
            <li><button onClick={() => setPage('process')} className="hover:text-white transition-colors">Our Process</button></li>
          </ul>
        </div>

        <div>
          <h4 className="font-serif font-bold text-lg mb-6">Resources</h4>
          <ul className="space-y-4 text-sm text-stone-400">
            <li><button onClick={() => setPage('faq')} className="hover:text-white transition-colors">FAQ</button></li>
            <li><a href="#" className="hover:text-white transition-colors">Puppy Care Guide</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Health Guarantee</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-serif font-bold text-lg mb-6">Contact Us</h4>
          <ul className="space-y-4 text-sm text-stone-400">
            <li className="flex items-start"><MapPin className="h-4 w-4 mr-3 mt-1 text-brand-accent" /> {settings.location}</li>
            <li className="flex items-center"><Phone className="h-4 w-4 mr-3 text-brand-accent" /> {settings.phone}</li>
            <li className="flex items-center"><Mail className="h-4 w-4 mr-3 text-brand-accent" /> {settings.email}</li>
          </ul>
        </div>
      </div>
      
      <div className="border-t border-stone-800 pt-8 text-center text-stone-500 text-xs">
        <p>&copy; {new Date().getFullYear()} {settings.companyName} Breeders. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

const AboutPage = ({ settings }: { settings: SiteSettings }) => (
  <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <SectionHeading title="Our Story" subtitle="Transparency and love are at the core of everything we do." />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
      <div className="prose prose-stone lg:prose-lg">
        <p className="text-stone-600 leading-relaxed mb-6">
          {settings.aboutText}
        </p>
        <p className="text-stone-600 leading-relaxed mb-6">
          What started as a personal passion grew into a dedicated breeding program. I saw a need for breeders who prioritized health and temperament over everything else. Too often, Yorkies were being bred without regard for genetic issues or proper socialization.
        </p>
        <h3 className="text-2xl font-serif font-bold text-stone-900 mt-10 mb-4">Our Philosophy</h3>
        <p className="text-stone-600 leading-relaxed mb-6">
          We believe that every puppy deserves the best start in life. This means:
        </p>
        <ul className="space-y-4 text-stone-600">
          <li className="flex items-start"><CheckCircle2 className="h-5 w-5 text-brand-primary mr-3 mt-1" /> <strong>Health Testing:</strong> All our parents are cleared for genetic diseases common in Yorkies.</li>
          <li className="flex items-start"><CheckCircle2 className="h-5 w-5 text-brand-primary mr-3 mt-1" /> <strong>Home Raised:</strong> Our puppies are born and raised in our living room, not a kennel.</li>
          <li className="flex items-start"><CheckCircle2 className="h-5 w-5 text-brand-primary mr-3 mt-1" /> <strong>Lifetime Support:</strong> When you take home a Yorkie Haven puppy, you become part of our family. We are here for you for the life of your dog.</li>
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <img src={settings.aboutImage} alt="Yorkie Playing" className="rounded-3xl shadow-md w-full aspect-[4/5] object-cover" referrerPolicy="no-referrer" />
        <img src={settings.aboutImage2} alt="Yorkie Sleeping" className="rounded-3xl shadow-md w-full aspect-[4/5] object-cover mt-12" referrerPolicy="no-referrer" />
      </div>
    </div>
  </section>
);

const OurDogsPage = ({ dogs, puppies, setPage }: { dogs: Animal[], puppies: Animal[], setPage: (p: Page) => void }) => {
  const dams = dogs.filter(d => d.category === 'dam');
  const sires = dogs.filter(d => d.category === 'sire');

  return (
    <div className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading title="Available Puppies" subtitle="All our current puppies, including available and reserved ones. Hand-raised with love." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        {puppies.map(puppy => <PuppyCard key={puppy.id} puppy={puppy} setPage={setPage} />)}
        {puppies.length === 0 && <p className="col-span-full text-center text-stone-400 py-10">No puppies currently listed. Check back soon!</p>}
      </div>

      <SectionHeading title="Our Dams & Sires" subtitle="The foundation of our program. Each of our adult dogs is a beloved family pet first." />
      
      {/* Sires Section */}
      <div className="mb-16">
        <h3 className="text-2xl font-serif font-bold text-stone-900 mb-8 flex items-center">
          <div className="w-8 h-1 bg-brand-accent mr-3"></div>
          Our Sires
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {sires.map((dog) => (
            <div key={dog.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100">
              <img src={dog.image} alt={dog.name} className="w-full h-64 object-cover" referrerPolicy="no-referrer" />
              <div className="p-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-3xl font-serif font-bold text-stone-900">{dog.name}</h3>
                  <div className="flex flex-col items-end">
                    {dog.role && <span className="bg-brand-secondary text-brand-primary px-4 py-1 rounded-full text-xs font-bold uppercase mb-2">{dog.role}</span>}
                    {dog.price > 0 && <span className="text-xl font-bold text-brand-primary">${dog.price.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-stone-600">
                  <div className="flex items-center"><Info className="h-4 w-4 mr-2 text-brand-accent" /> Weight: {dog.weight}</div>
                  <div className="flex items-center"><Info className="h-4 w-4 mr-2 text-brand-accent" /> Color: {dog.color}</div>
                  <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-brand-accent" /> Health Tested</div>
                  <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-brand-accent" /> AKC Registered</div>
                </div>
              </div>
            </div>
          ))}
          {sires.length === 0 && (
            <div className="col-span-full py-10 text-center text-stone-400">
              <p>Our sires will be listed here soon.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dams Section */}
      <div>
        <h3 className="text-2xl font-serif font-bold text-stone-900 mb-8 flex items-center">
          <div className="w-8 h-1 bg-brand-accent mr-3"></div>
          Our Dams
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {dams.map((dog) => (
            <div key={dog.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100">
              <img src={dog.image} alt={dog.name} className="w-full h-64 object-cover" referrerPolicy="no-referrer" />
              <div className="p-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-3xl font-serif font-bold text-stone-900">{dog.name}</h3>
                  <div className="flex flex-col items-end">
                    {dog.role && <span className="bg-brand-secondary text-brand-primary px-4 py-1 rounded-full text-xs font-bold uppercase mb-2">{dog.role}</span>}
                    {dog.price > 0 && <span className="text-xl font-bold text-brand-primary">${dog.price.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-stone-600">
                  <div className="flex items-center"><Info className="h-4 w-4 mr-2 text-brand-accent" /> Weight: {dog.weight}</div>
                  <div className="flex items-center"><Info className="h-4 w-4 mr-2 text-brand-accent" /> Color: {dog.color}</div>
                  <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-brand-accent" /> Health Tested</div>
                  <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-brand-accent" /> AKC Registered</div>
                </div>
              </div>
            </div>
          ))}
          {dams.length === 0 && (
            <div className="col-span-full py-10 text-center text-stone-400">
              <p>Our dams will be listed here soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProcessPage = ({ settings }: { settings: SiteSettings }) => (
  <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <SectionHeading title="Our Adoption Process" subtitle="We want to ensure every puppy goes to a home where they will be cherished." />
    <div className="max-w-4xl mx-auto mb-24">
      {[
        { step: '01', title: 'Submit Application', desc: 'Fill out our detailed application form to tell us about your home and lifestyle.' },
        { step: '02', title: 'Phone Interview', desc: 'We\'ll schedule a call to discuss your application and answer any questions you have.' },
        { step: '03', title: 'Place Deposit', desc: 'Once approved, a non-refundable deposit secures your place on our waitlist.' },
        { step: '04', title: 'Puppy Updates', desc: 'Receive weekly photos and videos as your puppy grows and develops.' },
        { step: '05', title: 'Go-Home Day', desc: 'At 10-12 weeks, your puppy is ready to join your family! We provide a full puppy starter kit.' }
      ].map((item, i) => (
        <div key={i} className="flex mb-12 last:mb-0">
          <div className="mr-8">
            <div className="text-5xl font-serif font-bold text-brand-accent/30">{item.step}</div>
          </div>
          <div className="pt-2 border-l-2 border-brand-accent/20 pl-8">
            <h4 className="text-2xl font-serif font-bold text-stone-900 mb-2">{item.title}</h4>
            <p className="text-stone-600 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-brand-secondary rounded-[48px] p-8 md:p-16 border border-stone-100">
      <div className="text-center mb-16">
        <h3 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-4">Health Guarantee & Policies</h3>
        <p className="text-stone-600 max-w-2xl mx-auto">We take the health of our puppies seriously. Here is what you can expect when you adopt from us.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6">
            <Sparkles className="h-6 w-6 text-brand-primary" />
          </div>
          <h4 className="text-xl font-serif font-bold text-stone-900 mb-4">Genetic Testing</h4>
          <p className="text-stone-600 text-sm leading-relaxed">{settings.geneticHealthTesting}</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle2 className="h-6 w-6 text-brand-primary" />
          </div>
          <h4 className="text-xl font-serif font-bold text-stone-900 mb-4">Vet Checks</h4>
          <p className="text-stone-600 text-sm leading-relaxed">{settings.vetChecks}</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6">
            <Heart className="h-6 w-6 text-brand-primary" />
          </div>
          <h4 className="text-xl font-serif font-bold text-stone-900 mb-4">Return Policy</h4>
          <p className="text-stone-600 text-sm leading-relaxed">{settings.returnPolicy}</p>
        </div>
      </div>
    </div>
  </section>
);

const FAQPage = () => (
  <section className="py-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
    <SectionHeading title="Frequently Asked Questions" />
    <div className="space-y-6">
      {[
        { q: 'How much are your puppies?', a: 'Our pet-only puppies typically range from $2,500 to $4,500 depending on size, color, and pedigree.' },
        { q: 'Do you ship puppies?', a: 'We prefer local pickup in Austin, TX, but we can arrange for a flight nanny to deliver your puppy to your nearest major airport for an additional fee.' },
        { q: 'What is included with the puppy?', a: 'Each puppy comes with a health guarantee, age-appropriate vaccinations, deworming, microchip, a sample of food, and a "scent blanket" from mom.' },
        { q: 'Are your dogs AKC registered?', a: 'Yes, all our breeding dogs are AKC registered. Puppies are sold with limited AKC registration (no breeding rights).' },
        { q: 'How big will my Yorkie get?', a: 'Yorkies typically weigh between 4-7 lbs. We can provide an estimated adult weight based on the parents, but cannot guarantee it.' }
      ].map((item, i) => (
        <details key={i} className="group bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <summary className="flex justify-between items-center p-6 cursor-pointer font-bold text-stone-900 list-none">
            {item.q}
            <ChevronRight className="h-5 w-5 text-brand-accent transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-6 pb-6 text-stone-600 text-sm leading-relaxed">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  </section>
);

const ContactPage = ({ settings }: { settings: SiteSettings }) => (
  <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div>
        <SectionHeading title="Get In Touch" subtitle="Have questions? We'd love to hear from you." centered={false} />
        <div className="space-y-8 mb-12">
          <div className="flex items-center">
            <div className="bg-brand-secondary p-4 rounded-2xl mr-6">
              <Mail className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Email Us</p>
              <p className="text-lg font-medium text-stone-900">{settings.email}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-brand-secondary p-4 rounded-2xl mr-6">
              <Phone className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Call or Text</p>
              <p className="text-lg font-medium text-stone-900">{settings.phone}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-brand-secondary p-4 rounded-2xl mr-6">
              <MapPin className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Location</p>
              <p className="text-lg font-medium text-stone-900">{settings.location}</p>
            </div>
          </div>
        </div>
        <div className="bg-stone-100 p-8 rounded-3xl">
          <h4 className="font-serif font-bold text-xl mb-4">Follow Our Journey</h4>
          <p className="text-stone-600 text-sm mb-6">See daily updates, puppy videos, and life at {settings.companyName} on our social media.</p>
          <div className="flex space-x-4">
            <a href={settings.instagram} className="bg-white p-3 rounded-xl shadow-sm hover:text-brand-primary transition-colors"><Instagram className="h-6 w-6" /></a>
            <a href={settings.facebook} className="bg-white p-3 rounded-xl shadow-sm hover:text-brand-primary transition-colors"><Facebook className="h-6 w-6" /></a>
          </div>
        </div>
      </div>
      <div className="bg-white p-10 rounded-[40px] shadow-sm border border-stone-100">
        <h3 className="text-2xl font-serif font-bold text-stone-900 mb-8">Send a Message</h3>
        <form className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">First Name</label>
              <input type="text" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Last Name</label>
              <input type="text" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Email Address</label>
            <input type="email" className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Message</label>
            <textarea rows={4} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"></textarea>
          </div>
          <button className="w-full bg-brand-primary text-white py-4 rounded-full font-bold hover:bg-brand-primary/90 transition-all shadow-md">
            Send Message
          </button>
        </form>
      </div>
    </div>
  </section>
);

const ApplicationPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    otherPets: '',
    children: '',
    interestReason: '',
    preferredGender: 'No Preference',
    preferredSize: 'No Preference'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const appRef = doc(collection(db, 'applications'));
      try {
        await setDoc(appRef, {
          ...formData,
          id: appRef.id,
          status: 'Pending',
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'applications');
      }
      setSubmitted(true);
    } catch (error) {
      console.error("Application submission failed", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="py-24 max-w-2xl mx-auto px-4 text-center">
        <div className="bg-white p-12 rounded-[40px] shadow-sm border border-stone-100">
          <div className="bg-brand-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-10 w-10 text-brand-primary" />
          </div>
          <h2 className="text-4xl font-serif font-bold text-stone-900 mb-4">Application Submitted!</h2>
          <p className="text-stone-600 mb-10">Thank you for your interest in a Yorkie Haven puppy. We will review your application and get back to you within 48 hours.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-brand-primary text-white px-8 py-3 rounded-full font-bold"
          >
            Back to Home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeading title="Puppy Application" subtitle="Please fill out this form as completely as possible. This helps us match you with the perfect puppy." />
      <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-stone-100">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Section 1: Contact Info */}
          <div>
            <h4 className="text-xl font-serif font-bold text-stone-900 mb-6 pb-2 border-b border-stone-100">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Full Name</label>
                <input 
                  required 
                  type="text" 
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Email Address</label>
                <input 
                  required 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Phone Number</label>
                <input 
                  required 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">City, State</label>
                <input 
                  required 
                  type="text" 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Lifestyle */}
          <div>
            <h4 className="text-xl font-serif font-bold text-stone-900 mb-6 pb-2 border-b border-stone-100">Lifestyle & Home</h4>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Do you have other pets?</label>
                <textarea 
                  rows={2} 
                  value={formData.otherPets}
                  onChange={e => setFormData({...formData, otherPets: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                  placeholder="Please list breeds and ages..."
                ></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Do you have children at home?</label>
                <input 
                  type="text" 
                  value={formData.children}
                  onChange={e => setFormData({...formData, children: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3" 
                  placeholder="Ages of children..." 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Why are you interested in a Yorkie?</label>
                <textarea 
                  rows={3} 
                  value={formData.interestReason}
                  onChange={e => setFormData({...formData, interestReason: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Section 3: Puppy Preferences */}
          <div>
            <h4 className="text-xl font-serif font-bold text-stone-900 mb-6 pb-2 border-b border-stone-100">Puppy Preferences</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Preferred Gender</label>
                <select 
                  value={formData.preferredGender}
                  onChange={e => setFormData({...formData, preferredGender: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3"
                >
                  <option>No Preference</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Preferred Size</label>
                <select 
                  value={formData.preferredSize}
                  onChange={e => setFormData({...formData, preferredSize: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3"
                >
                  <option>No Preference</option>
                  <option>Standard (5-7 lbs)</option>
                  <option>Small (3-5 lbs)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button 
              disabled={isSubmitting}
              type="submit" 
              className="w-full bg-brand-primary text-white py-5 rounded-full font-bold text-lg hover:bg-brand-primary/90 transition-all shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
            <p className="text-center text-stone-400 text-xs mt-4">By submitting, you agree to our adoption process and waitlist terms.</p>
          </div>
        </form>
      </div>
    </section>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const puppies = animals.filter(a => a.category === 'puppy');
  const dogs = animals.filter(a => a.category === 'dam' || a.category === 'sire');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Check if user is admin (hardcoded for initial setup or check Firestore)
        setIsAdmin(user.email === 'chayiadrian890@gmail.com');
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    const qAnimals = query(collection(db, 'animals'), orderBy('createdAt', 'desc'));
    const unsubAnimals = onSnapshot(qAnimals, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Animal));
      setAnimals(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'animals');
      setLoading(false);
    });

    const qTestimonials = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'));
    const unsubTestimonials = onSnapshot(qTestimonials, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Testimonial));
      setTestimonials(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'testimonials');
    });

    let unsubApplications = () => {};
    if (isAdmin) {
      const qApplications = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
      unsubApplications = onSnapshot(qApplications, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Application));
        setApplications(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'applications');
      });
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SiteSettings);
      }
      setSettingsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
      setSettingsLoading(false);
    });

    return () => {
      unsubAnimals();
      unsubTestimonials();
      unsubApplications();
      unsubSettings();
    };
  }, [isAdmin]);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const renderPage = () => {
    if (loading && page !== 'home') {
      return (
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      );
    }

    switch (page) {
      case 'home': return <HomePage setPage={setPage} puppies={puppies} testimonials={testimonials} settings={settings} settingsLoading={settingsLoading} />;
      case 'about': return <AboutPage settings={settings} />;
      case 'our-dogs': return <OurDogsPage dogs={dogs} puppies={puppies} setPage={setPage} />;
      case 'process': return <ProcessPage settings={settings} />;
      case 'faq': return <FAQPage />;
      case 'contact': return <ContactPage settings={settings} />;
      case 'apply': return <ApplicationPage />;
      case 'admin': return isAdmin ? <AdminDashboard puppies={puppies} dogs={dogs} testimonials={testimonials} settings={settings} applications={applications} /> : <HomePage setPage={setPage} puppies={puppies} testimonials={testimonials} settings={settings} settingsLoading={settingsLoading} />;
      default: return <HomePage setPage={setPage} puppies={puppies} testimonials={testimonials} settings={settings} settingsLoading={settingsLoading} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-brand-accent/30">
      <Navbar currentPage={page} setPage={setPage} user={user} isAdmin={isAdmin} settings={settings} />
      
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer setPage={setPage} settings={settings} />
    </div>
  );
}

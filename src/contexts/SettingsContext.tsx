import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";

// Context default values
interface SettingsContextType {
  apiKey: string;
  getimgApiKey: string;
  modelTemperature: number;
  maxTokens: number;
  currentModel: string;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Setters
  setApiKey: React.Dispatch<React.SetStateAction<string>>;
  setGetimgApiKey: React.Dispatch<React.SetStateAction<string>>;
  setModelTemperature: React.Dispatch<React.SetStateAction<number>>;
  setMaxTokens: React.Dispatch<React.SetStateAction<number>>;
  setCurrentModel: React.Dispatch<React.SetStateAction<string>>;
  
  // Functions
  handleSaveSettings: (key: string, temp: number, tokens: number, model?: string) => void;
}

// Create context with default values
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State for settings
  const [apiKey, setApiKey] = useState("");
  const [getimgApiKey, setGetimgApiKey] = useState("");
  const [modelTemperature, setModelTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [currentModel, setCurrentModel] = useState<string>('x-ai/grok-4');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const { toast } = useToast();
  
  useEffect(() => {
    // Load settings from localStorage
    const storedApiKey = localStorage.getItem('apiKey');
    const storedGetimgApiKey = localStorage.getItem('getimgApiKey');
    const storedTemperature = localStorage.getItem('modelTemperature');
    const storedMaxTokens = localStorage.getItem('maxTokens');
    const storedModel = localStorage.getItem('currentModel');
    
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      // Automatically open settings panel if no API key is stored, unless using server proxy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const useProxy = (import.meta as any).env?.VITE_USE_PROXY === 'true';
      if (!useProxy) setSettingsOpen(true);
    }

    if (storedGetimgApiKey) {
      setGetimgApiKey(storedGetimgApiKey);
    }
    
    if (storedTemperature) {
      setModelTemperature(parseFloat(storedTemperature));
    }
    
    if (storedMaxTokens) {
      setMaxTokens(parseInt(storedMaxTokens, 10));
    }

    if (storedModel) {
      setCurrentModel(storedModel);
    }
  }, []);
  
  const handleSaveSettings = (key: string, temp: number, tokens: number, model?: string) => {
    setApiKey(key);
    setModelTemperature(temp);
    setMaxTokens(tokens);
    if (model) {
      setCurrentModel(model);
    }
    
    // Save to localStorage
    if (key) {
      localStorage.setItem('apiKey', key);
    }
    
    localStorage.setItem('modelTemperature', temp.toString());
    localStorage.setItem('maxTokens', tokens.toString());
    if (model) {
      localStorage.setItem('currentModel', model);
    }
    
    // Close settings after saving
    setSettingsOpen(false);
    
    toast({
      title: "Settings Saved",
      description: "Your settings have been saved successfully.",
    });
  };
  
  const value = {
    apiKey,
    getimgApiKey,
    modelTemperature,
    maxTokens,
    currentModel,
    settingsOpen,
    setSettingsOpen,
    
    setApiKey,
    setGetimgApiKey,
    setModelTemperature,
    setMaxTokens,
    setCurrentModel,
    
    handleSaveSettings,
  };
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook for using the settings context
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getEnabledModels, isModelEnabled } from '@/config/models';

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
  const [currentModel, setCurrentModel] = useState<string>('cognitivecomputations/dolphin-mistral-24b-venice-edition:free');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const { toast } = useToast();
  
  useEffect(() => {
    // Load settings from localStorage
    const storedApiKey = localStorage.getItem('apiKey');
    const storedGetimgApiKey = localStorage.getItem('getimgApiKey');
    const storedTemperature = localStorage.getItem('modelTemperature');
    const storedMaxTokens = localStorage.getItem('maxTokens');
    const storedModel = localStorage.getItem('currentModel');
    
    // Check if we're using server proxy mode
    const useProxy = String((import.meta as any).env?.VITE_USE_PROXY || '').toLowerCase() === 'true';
    
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else if (!useProxy) {
      // Only open settings panel if no API key is stored AND we're not using server proxy
      setSettingsOpen(true);
    }
    
    // If using proxy, we don't need to store or validate API keys client-side
    if (useProxy) {
      console.log('Using server proxy mode - API keys handled server-side');
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

    if (storedModel && isModelEnabled(storedModel)) {
      setCurrentModel(storedModel);
    } else {
      // If no model is stored or the stored model is disabled, use the first enabled model (UNCENSORED)
      const enabledModels = getEnabledModels();
      if (enabledModels.length > 0) {
        const defaultModel = enabledModels[0].id;
        setCurrentModel(defaultModel);
        localStorage.setItem('currentModel', defaultModel);
      }
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
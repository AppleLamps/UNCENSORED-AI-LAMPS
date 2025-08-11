import React, { useEffect, useMemo, useState } from 'react';
import { Plus, MessageSquare, Trash2, Settings, Menu, FolderKanban, Edit2, Check, X as XIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import { useChatContext } from '@/contexts/ChatContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { FEATURES } from '../app.config';

interface ChatSidebarProps {
  sidebarVisible: boolean;
  formatDate: (date: Date) => string;
  toggleSidebar: () => void;
}

/**
 * ChatSidebar component for displaying chat history and new chat button
 */
const ChatSidebar = ({ sidebarVisible, formatDate, toggleSidebar }: ChatSidebarProps) => {
  const {
    currentChatId,
    savedChats,
    handleStartNewChat,
    loadSavedChat,
    deleteSavedChat,
    renameSavedChat
  } = useChatContext();

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [activeBot, setActiveBot] = useState<{ id?: string; name: string } | null>(null);

  const { setSettingsOpen } = useSettings();
  const navigate = useNavigate();

  // Detect currently active project/bot for contextual chat grouping
  useEffect(() => {
    const readActiveBot = () => {
      let bot: { id?: string; name: string } | null = null;
      try {
        const raw = sessionStorage.getItem('activeCustomBot') || localStorage.getItem('currentCustomBot');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            bot = { id: parsed.id, name: parsed.name };
          }
        }
      } catch {}
      setActiveBot(bot);
    };
    readActiveBot();
    const onStorage = () => readActiveBot();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isProjectChat = (chat: typeof savedChats[number]) => {
    if (!activeBot) return false;
    if (chat.bot?.id && activeBot.id) return chat.bot.id === activeBot.id;
    if (chat.bot?.name && activeBot.name) return chat.bot.name === activeBot.name;
    return false;
  };

  const projectChats = useMemo(() => {
    if (!activeBot) return [] as typeof savedChats;
    return [...savedChats]
      .filter(isProjectChat)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }, [activeBot, savedChats]);

  // Handle starting rename
  const handleStartRename = (chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  // Handle confirming rename
  const handleConfirmRename = (chatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editingTitle.trim()) {
      renameSavedChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
    setEditingTitle('');
  };

  // Handle canceling rename
  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingChatId(null);
    setEditingTitle('');
  };

  // Handle key press in rename input
  const handleRenameKeyPress = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter') {
      handleConfirmRename(chatId);
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  // Group chats by date for display (excluding project chats to avoid duplication)
  const groupChatsByDate = (): Record<string, typeof savedChats> => {
    const groups: Record<string, typeof savedChats> = {};

    const nonProjectChats = savedChats.filter(c => !isProjectChat(c));
    nonProjectChats.sort((a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    ).forEach(chat => {
      const dateKey = formatDate(new Date(chat.lastUpdated));
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(chat);
    });

    return groups;
  };

  const groupedChats = groupChatsByDate();

  return (
    <div className={cn(
      "h-full flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900",
      "transition-all duration-300 ease-in-out",
      "md:pt-0 pt-16", // Add top padding on mobile to account for header
      !sidebarVisible && "md:opacity-0 md:w-0 md:overflow-hidden"
    )}>
      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={handleStartNewChat}
          className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-full shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50"
        >
          <Plus size={16} className="mr-2" />
          New chat
        </button>
      </div>

      {/* Sidebar Navigation */}
      <div className="px-3 py-2">
        {FEATURES.projects && (
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center justify-start w-full px-3 py-2 text-sm rounded-md text-left group transition-colors duration-150 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FolderKanban size={16} className="mr-2" />
            <span>Projects</span>
          </button>
        )}
      </div>

      {/* Active Project Chats */}
      {activeBot && projectChats.length > 0 && (
        <div className="px-2">
          <div className="flex items-center justify-between px-1 py-2">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 gap-2">
              <FolderKanban size={14} />
              <span className="font-semibold truncate max-w-[10rem]">{activeBot.name}</span>
              <span className="opacity-70">chats</span>
            </div>
            <button
              onClick={() => {
                if (activeBot?.id) {
                  navigate(`/projects/edit/${activeBot.id}`);
                } else {
                  navigate('/projects');
                }
              }}
              className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="View project"
            >
              <ExternalLink size={12} /> View
            </button>
          </div>
          <div className="space-y-1 mb-2">
            {projectChats.map(chat => (
              <div
                key={`pchat-${chat.id}-${chat.lastUpdated.toString()}`}
                onClick={() => editingChatId !== chat.id && loadSavedChat(chat.id)}
                // clickable row, avoid assigning interactive role to prevent nested control warnings
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 text-sm rounded-md text-left group transition-colors duration-150",
                  currentChatId === chat.id
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <div className="flex items-center space-x-2 truncate flex-1">
                  <MessageSquare size={16} className="flex-shrink-0" />
                  {editingChatId === chat.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyPress(e, chat.id)}
                      onBlur={() => handleConfirmRename(chat.id)}
                      className="flex-1 bg-transparent border-b border-gray-400 dark:border-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Rename chat title"
                      placeholder="Rename chat"
                      title="Rename chat title"
                    />
                  ) : (
                    <span className="truncate">{chat.title}</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {editingChatId === chat.id ? (
                    <>
                      <button
                        onClick={(e) => handleConfirmRename(chat.id, e)}
                        className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200 transition-colors duration-200"
                        aria-label="Confirm rename"
                        title="Confirm rename"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
                        aria-label="Cancel rename"
                        title="Cancel rename"
                      >
                        <XIcon size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleStartRename(chat.id, chat.title, e)}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-all duration-200"
                        aria-label="Rename chat"
                        title="Rename chat"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSavedChat(chat.id, e);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-all duration-200"
                        aria-label="Delete chat"
                        title="Delete chat"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-200 dark:bg-gray-800 mx-1 my-2" />
        </div>
      )}

      {/* Chats History - FIXED THE NESTED BUTTON ISSUE HERE */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {Object.entries(groupedChats).map(([dateGroup, chats]) => (
            <div key={dateGroup} className="space-y-1">
              <h3 className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {dateGroup}
              </h3>
              {chats.map(chat => (
                <div
                  key={`chat-${chat.id}-${chat.lastUpdated.toString()}`}
                  onClick={() => editingChatId !== chat.id && loadSavedChat(chat.id)}
                  // clickable row without extra interactive semantics to avoid nested controls
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-sm rounded-md text-left group transition-colors duration-150",
                    currentChatId === chat.id
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <div className="flex items-center space-x-2 truncate flex-1">
                    <MessageSquare size={16} className="flex-shrink-0" />
                  {editingChatId === chat.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyPress(e, chat.id)}
                        onBlur={() => handleConfirmRename(chat.id)}
                        className="flex-1 bg-transparent border-b border-gray-400 dark:border-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      aria-label="Rename chat title"
                      placeholder="Rename chat"
                      title="Rename chat title"
                      />
                    ) : (
                      <span className="truncate">{chat.title}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    {editingChatId === chat.id ? (
                      <>
                        <button
                          onClick={(e) => handleConfirmRename(chat.id, e)}
                          className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200 transition-colors duration-200"
                          aria-label="Confirm rename"
                        title="Confirm rename"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancelRename}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
                          aria-label="Cancel rename"
                        title="Cancel rename"
                        >
                          <XIcon size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleStartRename(chat.id, chat.title, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-all duration-200"
                          aria-label="Rename chat"
                        title="Rename chat"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedChat(chat.id, e);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-all duration-200"
                          aria-label="Delete chat"
                        title="Delete chat"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom of sidebar */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
            aria-label="Open settings"
            title="Open settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Mobile buttons - for small screens only when sidebar is closed */}
      {!sidebarVisible && (
        <>
          {/* New Chat Button */}
          <button
            onClick={handleStartNewChat}
            className="fixed bottom-20 left-4 z-50 p-3 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg transition-all duration-200 ease-in-out md:hidden transform hover:scale-105"
            aria-label="New chat"
          >
            <Plus size={24} />
          </button>
          
          {/* Sidebar Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="fixed bottom-4 left-4 z-50 p-3 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-lg transition-all duration-200 ease-in-out md:hidden transform hover:scale-105"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>
        </>
      )}
    </div>
  );
};

export default ChatSidebar;

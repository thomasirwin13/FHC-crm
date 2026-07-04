'use client';

import { useChat } from '@ai-sdk/react';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';
import { Expand, Minimize2, X, MessageSquare, History, Trash2, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  deleteChat,
  confirmEditCollection,
  confirmAddCollectionResource,
  confirmAddBlock,
  confirmEditBlock,
  confirmAddOrganization,
  confirmEditOrganization,
  confirmDeleteOrganization,
} from './chat/actions';
import type { UIMessage } from 'ai';
import type { ConfirmationType, ConfirmationStatus } from '@/components/chat/confirmation-display';

const SUGGESTED_PROMPTS = [
  'Tell me about our collections',
  'Show me our organizations',
  'Add a new organization called Acme Corp',
];

type ChatMode = 'minimized' | 'sidebar' | 'fullscreen';

interface Chat {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface DBMessage {
  id: number;
  chat_id: number;
  role: string;
  content: string;
  created_at: string;
}

interface DashboardChatProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  chats: Chat[];
}

export function DashboardChat({ mode, onModeChange, chats }: DashboardChatProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);
  const [currentChatId, setCurrentChatId] = useState<number | undefined>(undefined);
  const chatIdRef = useRef<number | undefined>(undefined);

  // Track confirmation states for management tools
  const [confirmationStates, setConfirmationStates] = useState<
    Record<string, { status: ConfirmationStatus; error?: string }>
  >({});

  // Convert DB messages to UI messages format
  const convertToUIMessages = (dbMessages: DBMessage[]): UIMessage[] => {
    return dbMessages.map(msg => ({
      id: msg.id.toString(),
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: new Date(msg.created_at),
    }));
  };

  // Intercept fetch to inject chatId into POST requests to /api/chat
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method?.toUpperCase() || 'GET';

      // Only intercept POST requests to the main chat API endpoint
      if (url.endsWith('/api/chat') && method === 'POST') {
        // Parse and inject chatId into request body
        let body: Record<string, unknown> = {};
        try {
          body = init?.body ? JSON.parse(init.body as string) : {};
        } catch {
          return originalFetch(input, init);
        }
        body.chatId = chatIdRef.current;

        const response = await originalFetch(input, {
          ...init,
          body: JSON.stringify(body),
        });

        // Extract chatId from response header
        const newChatId = response.headers.get('X-Chat-Id');
        if (newChatId && !chatIdRef.current) {
          const id = parseInt(newChatId, 10);
          chatIdRef.current = id;
          setCurrentChatId(id);
        }

        return response;
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const { messages, sendMessage, setMessages } = useChat({
    experimental_throttle: 50,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  const handlePromptClick = (prompt: string) => {
    sendMessage({ text: prompt });
  };

  const handleSelectChat = async (chatId: number) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`);
      if (response.ok) {
        const data = await response.json();
        const uiMessages = convertToUIMessages(data.messages || []);
        setMessages(uiMessages);
        setCurrentChatId(chatId);
        chatIdRef.current = chatId;
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(undefined);
    chatIdRef.current = undefined;
  };

  // Handle confirmation for management tools
  const handleConfirm = async (
    confirmationId: string,
    type: ConfirmationType,
    data: Record<string, any>
  ) => {
    setConfirmationStates(prev => ({
      ...prev,
      [confirmationId]: { status: 'loading' },
    }));

    try {
      let result;
      let successMessage = '';

      switch (type) {
        case 'edit_collection':
          result = await confirmEditCollection({
            collectionId: data.collectionId || data.productId,
            name: data.newName,
            owner: data.newOwner,
            description: data.newDescription,
          });
          if (!result?.error) {
            const changes = [];
            if (data.newName) changes.push(`name to "${data.newName}"`);
            if (data.newOwner) changes.push(`owner to "${data.newOwner}"`);
            if (data.newDescription) changes.push('description');
            successMessage = `I confirmed updating the collection ${changes.join(', ')}. View it at /app/library/collections/${data.collectionId || data.productId}`;
          }
          break;
        case 'add_resource':
          result = await confirmAddCollectionResource({
            collectionId: data.collectionId || data.productId,
            label: data.label,
            url: data.url,
            type: data.type,
          });
          if (!result?.error) {
            successMessage = `I confirmed adding the resource "${data.label}" to the collection. View it at /app/library/collections/${data.collectionId || data.productId}`;
          }
          break;
        case 'add_block':
          result = await confirmAddBlock({
            collectionId: data.collectionId || data.productId,
            title: data.title || data.feature,
            category: data.category,
            description: data.description,
          });
          if (!result?.error) {
            successMessage = `I confirmed adding the block "${data.title || data.feature}" to the collection. View it at /app/library/collections/${data.collectionId || data.productId}`;
          }
          break;
        case 'edit_block':
          result = await confirmEditBlock({
            blockId: data.blockId || data.featureId,
            title: data.title || data.feature,
            category: data.category,
            description: data.description,
          });
          if (!result?.error) {
            const collectionId = result.block?.collection_id;
            successMessage = `I confirmed updating the block.${collectionId ? ` View it at /app/library/collections/${collectionId}` : ''}`;
          }
          break;
        case 'add_organization':
          result = await confirmAddOrganization({
            name: data.name,
            description: data.description,
            website: data.website,
            type: data.type,
            size: data.size,
            status: data.status,
          });
          if (!result?.error) {
            const organizationId = result.organization?.id;
            successMessage = `I confirmed adding the organization "${data.name}".${organizationId ? ` View it at /app/organizations/${organizationId}` : ''}`;
          }
          break;
        case 'edit_organization':
          result = await confirmEditOrganization({
            organizationId: data.organizationId,
            name: data.newName,
            description: data.newDescription,
            website: data.newWebsite,
            type: data.newType,
            size: data.newSize,
            status: data.newStatus,
          });
          if (!result?.error) {
            successMessage = `I confirmed updating the organization. View it at /app/organizations/${data.organizationId}`;
          }
          break;
        case 'delete_organization':
          result = await confirmDeleteOrganization({
            organizationId: data.organizationId,
          });
          if (!result?.error) {
            successMessage = `I confirmed deleting the organization "${data.name}".`;
          }
          break;
        default:
          result = { error: 'Unknown confirmation type' };
      }

      if (result?.error) {
        setConfirmationStates(prev => ({
          ...prev,
          [confirmationId]: { status: 'error', error: result.error },
        }));
      } else {
        setConfirmationStates(prev => ({
          ...prev,
          [confirmationId]: { status: 'confirmed' },
        }));

        if (successMessage) {
          setTimeout(() => {
            sendMessage({ text: successMessage });
          }, 500);
        }
      }
    } catch (error) {
      setConfirmationStates(prev => ({
        ...prev,
        [confirmationId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to execute',
        },
      }));
    }
  };

  const handleCancel = (confirmationId: string) => {
    setConfirmationStates(prev => ({
      ...prev,
      [confirmationId]: { status: 'cancelled' },
    }));
  };

  const handleDeleteChat = async () => {
    if (chatToDelete === null) return;

    try {
      await deleteChat(chatToDelete);
      // If deleting the current chat, start fresh
      if (chatToDelete === currentChatId) {
        handleNewChat();
      }
      router.refresh();
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }

    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const confirmDelete = (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  const hasMessages = messages.length > 0;

  // Minimized state - floating button
  if (mode === 'minimized') {
    const handleOpenChat = () => {
      // On mobile (< 1024px / lg breakpoint), go directly to fullscreen
      // since the sidebar is hidden on mobile
      const isMobile = window.innerWidth < 1024;
      onModeChange(isMobile ? 'fullscreen' : 'sidebar');
    };

    return (
      <button
        onClick={handleOpenChat}
        className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="font-medium">sage</span>
        {hasMessages && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
      </button>
    );
  }

  // Fullscreen state - overlay
  if (mode === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold text-primary">sage</span>
            <span className="text-sm text-muted-foreground">
              Your AI assistant
            </span>
          </div>
          <div className="flex items-center gap-2">
            {chats.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" title="Chat history">
                    <History className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Recent chats
                  </div>
                  <DropdownMenuSeparator />
                  <div className="max-h-48 overflow-y-auto">
                    {chats.map((chat) => (
                      <DropdownMenuItem
                        key={chat.id}
                        className={`group flex items-center justify-between gap-2 cursor-pointer ${
                          chat.id === currentChatId ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleSelectChat(chat.id)}
                      >
                        <span className="truncate flex-1 text-sm">
                          {chat.title || 'Untitled chat'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive flex-shrink-0 transition-opacity"
                          onClick={(e) => confirmDelete(chat.id, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              title="New chat"
              className="h-9 w-9"
            >
              <SquarePen className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onModeChange('sidebar')}
              title="Exit fullscreen"
              className="h-9 w-9"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onModeChange('minimized')}
              title="Close"
              className="h-9 w-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto">
            {hasMessages ? (
              <ChatMessages
                messages={messages}
                confirmationStates={confirmationStates}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <h1 className="text-4xl font-bold tracking-tight mb-3">
                  <span className="text-primary">sage</span>
                </h1>
                <p className="text-muted-foreground mb-8">
                  Your AI assistant
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handlePromptClick(prompt)}
                      className="px-3 py-2 text-sm rounded-full border border-border/60 bg-card/50 hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {/* History section */}
                {chats.length > 0 && (
                  <div className="pt-6 mt-6 border-t border-border/30">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <History className="w-3 h-3" />
                      <DropdownMenu>
                        <DropdownMenuTrigger className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
                          Continue a previous conversation
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-64">
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Recent chats
                          </div>
                          <DropdownMenuSeparator />
                          <div className="max-h-48 overflow-y-auto">
                            {chats.slice(0, 10).map((chat) => (
                              <DropdownMenuItem
                                key={chat.id}
                                className="group flex items-center justify-between gap-2 cursor-pointer"
                                onClick={() => handleSelectChat(chat.id)}
                              >
                                <span className="truncate flex-1 text-sm">
                                  {chat.title || 'Untitled chat'}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive flex-shrink-0 transition-opacity"
                                  onClick={(e) => confirmDelete(chat.id, e)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border/30">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="Ask sage anything..."
              size="large"
            />
          </div>
        </div>
      </div>
    );
  }

  // Sidebar state - floating panel
  return (
    <>
      <div className="fixed bottom-6 right-6 z-[60] w-[400px] h-[600px] max-h-[80vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
        {hasMessages ? (
          /* Active chat state */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-primary">sage</span>
              </div>
              <div className="flex items-center gap-1">
                {chats.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Chat history">
                        <History className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Recent chats
                      </div>
                      <DropdownMenuSeparator />
                      <div className="max-h-48 overflow-y-auto">
                        {chats.map((chat) => (
                          <DropdownMenuItem
                            key={chat.id}
                            className={`group flex items-center justify-between gap-2 cursor-pointer ${
                              chat.id === currentChatId ? 'bg-accent' : ''
                            }`}
                            onClick={() => handleSelectChat(chat.id)}
                          >
                            <span className="truncate flex-1 text-sm">
                              {chat.title || 'Untitled chat'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive flex-shrink-0 transition-opacity"
                              onClick={(e) => confirmDelete(chat.id, e)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewChat}
                  title="New chat"
                  className="h-8 w-8"
                >
                  <SquarePen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onModeChange('fullscreen')}
                  title="Fullscreen"
                  className="h-8 w-8"
                >
                  <Expand className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onModeChange('minimized')}
                  title="Close"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ChatMessages
                messages={messages}
                confirmationStates={confirmationStates}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            </div>

            {/* Input at bottom */}
            <div className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-border/30">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                placeholder="Type a message..."
              />
            </div>
          </>
        ) : (
          /* Empty state */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-primary">sage</span>
                <span className="text-xs text-muted-foreground">
                  AI assistant
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onModeChange('fullscreen')}
                  title="Fullscreen"
                  className="h-8 w-8"
                >
                  <Expand className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onModeChange('minimized')}
                  title="Close"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content area with suggestions */}
            <div className="flex-1 flex flex-col justify-end px-4 pb-4">
              {/* History section */}
              {chats.length > 0 && (
                <div className="pb-4 mb-4 border-b border-border/30">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <History className="w-3 h-3" />
                    <DropdownMenu>
                      <DropdownMenuTrigger className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
                        Continue a previous conversation
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Recent chats
                        </div>
                        <DropdownMenuSeparator />
                        <div className="max-h-48 overflow-y-auto">
                          {chats.slice(0, 10).map((chat) => (
                            <DropdownMenuItem
                              key={chat.id}
                              className="group flex items-center justify-between gap-2 cursor-pointer"
                              onClick={() => handleSelectChat(chat.id)}
                            >
                              <span className="truncate flex-1 text-sm">
                                {chat.title || 'Untitled chat'}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive flex-shrink-0 transition-opacity"
                                onClick={(e) => confirmDelete(chat.id, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}

              {/* Suggestion chips */}
              <div className="space-y-2 mb-4">
                <p className="text-xs text-muted-foreground">Try asking</p>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="block w-full text-left px-3 py-2 text-sm rounded-lg border border-border/60 bg-card/50 hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input at bottom */}
              <div className="pt-3 border-t border-border/30">
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  placeholder="Ask sage anything..."
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

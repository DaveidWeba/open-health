'use client'

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Menu, Send, Settings} from 'lucide-react';
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import ChatSideBar from "@/components/chat/chat-side-bar";
import ChatMessage from "@/components/chat/chat-message";
import useSWR from "swr";
import {useParams} from "next/navigation";
import {ChatMessageListResponse} from "@/app/api/chat-rooms/[id]/messages/route";
import {AssistantModeListResponse} from "@/app/api/assistant-modes/route";
import {ChatRole} from "@prisma/client";

export default function Page() {
    const {id} = useParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [inputText, setInputText] = useState('');
    const [settings, setSettings] = useState({model: 'gpt4', apiKey: ''});
    const [selectedMode, setSelectedMode] = useState<string>();
    const [systemPrompt, setSystemPrompt] = useState<string>();
    const [sources] = useState([]);
    const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

    const {data, mutate} = useSWR<ChatMessageListResponse>(`/api/chat-rooms/${id}/messages`, async (url: string) => {
        const response = await fetch(url);
        return response.json();
    });
    const messages = useMemo(() => data?.chatMessages || [], [data]);

    const {data: assistantModesData} = useSWR<AssistantModeListResponse>('/api/assistant-modes', async (url: string) => {
        const response = await fetch(url);
        return response.json();
    })
    const ConsultingModes = useMemo(() => assistantModesData?.assistantModes || [], [assistantModesData]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({behavior: 'smooth'});
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        const selectedModeData = ConsultingModes.find(m => m.id === selectedMode);
        if (!selectedModeData) return;

        const oldMessages = [...messages, {
            id: new Date().toISOString(),
            content: inputText,
            role: 'USER' as ChatRole,
            createdAt: new Date(),
        }];
        await mutate({chatMessages: oldMessages}, {revalidate: false});

        const response = await fetch(`/api/chat-rooms/${id}/messages`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                content: inputText,
                role: 'USER'
            })
        });

        // Read as a stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
            let done = false;
            while (!done) {
                const {value, done: isDone} = await reader.read();
                done = isDone;

                const streamMessage = decoder.decode(value, {stream: !done});
                await mutate({
                    chatMessages: [
                        ...oldMessages,
                        {
                            id: new Date().toISOString(),
                            content: streamMessage,
                            role: 'ASSISTANT',
                            createdAt: new Date(),
                        }
                    ]
                }, {revalidate: false});
            }
            setInputText('');
            await mutate();
        }
    };

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-white border-b h-14 flex items-center px-4 shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}>
                        <Menu className="w-4 h-4"/>
                    </Button>
                    <h1 className="text-lg font-semibold">OpenHealth</h1>
                </div>
                <div className="flex-1"/>
                <Button variant="ghost" size="icon" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}>
                    <Settings className="w-4 h-4"/>
                </Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <ChatSideBar isLeftSidebarOpen={isLeftSidebarOpen}/>

                <div className="flex-1 flex flex-col bg-white min-w-0">
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {messages.map((message, index) => (
                            <ChatMessage key={index} message={message}/>
                        ))}
                        <div ref={messagesEndRef}/>
                    </div>
                    <div className="p-4 border-t">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Type your message..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <Button onClick={handleSendMessage}>
                                <Send className="w-4 h-4"/>
                            </Button>
                        </div>
                    </div>
                </div>

                <div className={`border-l bg-gray-50 flex flex-col transition-all duration-300 ease-in-out
          ${isRightSidebarOpen ? 'w-80' : 'w-0'} relative`}>
                    <div className={`absolute inset-0 ${isRightSidebarOpen ? 'opacity-100' : 'opacity-0'}
            transition-opacity duration-300 overflow-y-auto`}>
                        <div className="p-4 space-y-4">
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium">Model Settings</h4>
                                <div className="space-y-2">
                                    <Select value={settings.model}
                                            onValueChange={(value) => setSettings({...settings, model: value})}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select model"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gpt4">GPT-4</SelectItem>
                                            <SelectItem value="claude3">Claude 3</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="password"
                                        placeholder="Enter API key"
                                        value={settings.apiKey}
                                        onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">System Prompt</label>
                                <Textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    rows={6}
                                    className="resize-none"
                                />
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-medium">Assistant Mode</h4>
                                <div className="space-y-2">
                                    {ConsultingModes.map((mode) => (
                                        <button
                                            key={mode.id}
                                            className={`w-full p-3 rounded-lg text-left border transition-colors
                        ${selectedMode === mode.id ? 'bg-white border-gray-300' :
                                                'border-transparent hover:bg-gray-100'}`}
                                            onClick={() => {
                                                setSelectedMode(mode.id);
                                                setSystemPrompt(mode.systemPrompt);
                                            }}
                                        >
                                            <div className="text-sm font-medium">{mode.name}</div>
                                            <div className="text-xs text-gray-500">{mode.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={isJsonViewerOpen} onOpenChange={setIsJsonViewerOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader><DialogTitle>Source Data</DialogTitle></DialogHeader>
                    <div className="overflow-y-auto">
            <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">
              {JSON.stringify(sources, null, 2)}
            </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

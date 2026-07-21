"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Send, User as UserIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
    sender: {
        name: string;
        staffProfile?: { passportUrl: string };
    };
}

interface ProjectChatProps {
    projectId: string;
    currentUserId: string;
    initialMessages?: Message[];
}

export default function ProjectChat({ projectId, currentUserId, initialMessages = [] }: ProjectChatProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055';
        
        const socket = io(rawBaseUrl, {
            auth: { token },
            withCredentials: true
        });

        socket.on('connect', () => {
            socket.emit('join-project', projectId);
        });

        socket.on('new-message', (message: Message) => {
            setMessages(prev => {
                if (prev.find(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [projectId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socketRef.current) return;

        socketRef.current.emit('send-message', {
            projectId,
            text: input.trim()
        });
        
        setInput('');
    };

    return (
        <div className="flex flex-col h-full w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-emerald-50 flex-shrink-0">
                <h3 className="font-bold text-sm text-gray-800">Workspace Chat</h3>
                <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
            </div>
            
            {/* Scrollable Messages Container (expands to push typing bar to bottom) */}
            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 bg-white">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs space-y-1 my-auto">
                        <p className="font-semibold text-gray-500">No messages yet in this project.</p>
                        <p>Start co-authoring discussions below!</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.senderId === currentUserId;
                        return (
                            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`flex-shrink-0 ${isMe ? 'ml-2' : 'mr-2'} mt-1`}>
                                        {msg.sender?.staffProfile?.passportUrl ? (
                                            <img src={msg.sender.staffProfile.passportUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover shadow" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shadow-sm border border-emerald-200">
                                                <UserIcon size={14} />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[10px] text-gray-400 mb-1 font-bold">{isMe ? 'You' : (msg.sender?.name || 'Peer')}</span>
                                        <div 
                                            style={isMe ? { backgroundColor: '#006533', color: '#ffffff' } : { backgroundColor: '#f1f5f9', color: '#0f172a' }}
                                            className={`p-3 rounded-2xl shadow-sm text-xs leading-relaxed border ${isMe ? 'border-emerald-800' : 'border-gray-200'}`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Typing Input Box (LOCKED STUCK AT THE VERY BOTTOM) */}
            <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 mt-auto flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-grow p-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-gray-900"
                />
                <button
                    type="submit"
                    style={{ backgroundColor: '#006533', color: '#ffffff' }}
                    className="p-2.5 text-white rounded-xl hover:opacity-90 transition shadow-sm flex items-center justify-center"
                    title="Send Message"
                >
                    <Send size={15} />
                </button>
            </form>
        </div>
    );
}

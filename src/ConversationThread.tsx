import React, { useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

interface Props {
  messages: Message[];
}

const ConversationThread: React.FC<Props> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="conversation-thread">
      <p className="conversation-title">Conversation</p>
      <div className="conversation-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`conv-msg conv-msg-${msg.role}`}>
            <span className="conv-msg-role">{msg.role === 'user' ? 'You' : 'Heritage Keeper'}</span>
            <p className="conv-msg-text">{msg.text}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ConversationThread;

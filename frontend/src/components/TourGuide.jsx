import React, { useState } from 'react';
import { Sparkles, Users, MessageSquare, ShieldAlert, UserPlus, CheckCircle2, ChevronRight, ChevronLeft, X } from 'lucide-react';

export default function TourGuide({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to ChatSync! 🚀',
      description: 'Set up your unique username and choose an avatar to identify yourself in group chats and private rooms.',
      icon: <Sparkles className="w-12 h-12 text-indigo-400" />,
      highlight: 'Create profile details inside the welcome panel.'
    },
    {
      title: 'Groups & Shareable Links 🔗',
      description: 'Create a group to immediately generate a unique Group Code and Join Link. Copy the link to invite friends in one click!',
      icon: <Users className="w-12 h-12 text-emerald-400" />,
      highlight: 'Look for the "Create Group" and "Join Link" sections in the sidebar.'
    },
    {
      title: 'WhatsApp-style Chatting 🎬',
      description: 'Send messages, upload high-quality images/videos, pin important announcements, and double-click to reply/quote specific messages.',
      icon: <MessageSquare className="w-12 h-12 text-indigo-400" />,
      highlight: 'Hover over a message to reply, or double-click to quote it.'
    },
    {
      title: 'Group Admin Control 👑',
      description: 'As the group creator, you can pin important text, remove members, or delete the group entirely from the Group Details panel.',
      icon: <ShieldAlert className="w-12 h-12 text-red-400" />,
      highlight: 'Admin options appear next to member names for the group creator.'
    },
    {
      title: 'One-to-One Friends 💬',
      description: 'Click any member in a group chat to send a friend request. Once they accept, start private one-to-one message sessions.',
      icon: <UserPlus className="w-12 h-12 text-yellow-400" />,
      highlight: 'Manage active friends and incoming requests at the bottom of the sidebar.'
    },
    {
      title: 'You are Ready! 🎉',
      description: 'Start connecting in real-time. You can restart this tour guide anytime from the settings icon in the sidebar profile.',
      icon: <CheckCircle2 className="w-12 h-12 text-emerald-400" />,
      highlight: 'Enjoy real-time sync chatting!'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const current = steps[currentStep];

  return (
    <div className="tour-overlay">
      <div className="tour-card glass-panel">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'absolute', right: '16px', top: '16px' }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-indigo-950/50 rounded-full border border-indigo-500/20 animate-pulse">
            {current.icon}
          </div>
          
          <h2 className="text-xl font-bold text-slate-100 mt-2" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
            {current.title}
          </h2>
          
          <p className="text-slate-300 text-sm text-center leading-relaxed max-w-sm" style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '8px 0' }}>
            {current.description}
          </p>

          {current.highlight && (
            <div className="text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded border border-indigo-500/20 mt-2" style={{ fontSize: '0.8rem', color: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '6px 12px', borderRadius: '4px' }}>
              💡 {current.highlight}
            </div>
          )}
        </div>

        {/* Step Indicator Dots */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '16px' }}>
          {steps.map((_, idx) => (
            <div 
              key={idx} 
              className={`tour-step-dot ${idx === currentStep ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: '20px', gap: '12px' }}>
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center', opacity: currentStep === 0 ? 0.3 : 1, cursor: currentStep === 0 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <button
            onClick={handleNext}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

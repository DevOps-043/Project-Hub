'use client';

import { Bot } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useARIA } from '@/contexts/ARIAContext';
import { LIAChatWidget } from './LIAChatWidget';

interface LIAFloatingButtonProps {
  userName?: string;
  userRole?: string;
  userId?: string;
  teamId?: string;
}

export function LIAFloatingButton({
  userName,
  userRole,
  userId,
  teamId,
}: LIAFloatingButtonProps) {
  const params = useParams();
  const { isOpen, toggleARIA, closeARIA } = useARIA();
  const currentTeamId = teamId || (typeof params?.teamId === 'string' ? params.teamId : undefined);

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            type="button"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={toggleARIA}
            className="fixed bottom-6 right-6 z-[60] flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #00D4B3 0%, #0A2540 100%)',
              boxShadow: '0 14px 34px rgba(0, 212, 179, 0.28)',
            }}
            aria-label="Abrir ARIA Chat"
            title="Abrir ARIA Chat"
          >
            <Bot className="h-5 w-5" />
            <span>ARIA Chat</span>
            <span className="ml-1 h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      <LIAChatWidget
        isOpen={isOpen}
        onClose={closeARIA}
        userName={userName}
        userRole={userRole}
        userId={userId}
        teamId={currentTeamId}
      />
    </>
  );
}

export { LIAFloatingButton as ARIAFloatingButton };
export default LIAFloatingButton;

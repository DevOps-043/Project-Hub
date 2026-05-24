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
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="fixed bottom-6 right-6 z-[60]"
          >
            <div className="relative">
              {/* Halo expansivo (pulse) */}
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(0,212,179,0.45) 0%, rgba(0,212,179,0) 70%)',
                }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Botón principal */}
              <motion.button
                type="button"
                onClick={toggleARIA}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-[#00D4B3] focus-visible:ring-offset-2"
                style={{
                  background:
                    'radial-gradient(circle at 30% 25%, #2BE9C6 0%, #00D4B3 45%, #0A2540 100%)',
                  boxShadow:
                    '0 14px 40px rgba(0, 212, 179, 0.35), 0 4px 12px rgba(10, 37, 64, 0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
                aria-label="Abrir ARIA Chat"
              >
                <Bot className="h-6 w-6 drop-shadow" strokeWidth={1.8} />

                {/* Indicador "online" */}
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A2540]" />
                </span>

                {/* Tooltip al hacer hover */}
                <span
                  className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0A2540] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100"
                  style={{ boxShadow: '0 6px 18px rgba(10,37,64,0.45)' }}
                >
                  ARIA Chat
                  <span
                    aria-hidden="true"
                    className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent"
                    style={{ borderLeftColor: '#0A2540' }}
                  />
                </span>
              </motion.button>
            </div>
          </motion.div>
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

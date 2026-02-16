'use client';

import React, { useEffect, useState } from 'react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQ {
    faq_id: string;
    question: string;
    answer: string;
    category: string;
}

export default function FAQPage() {
    const { isDark } = useTheme();
    const colors = isDark ? themeColors.dark : themeColors.light;
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const res = await fetch('/api/faqs');
                const data = await res.json();
                setFaqs(data);
            } catch (error) {
                console.error('Failed to load FAQs');
            } finally {
                setLoading(false);
            }
        };
        fetchFaqs();
    }, []);

    const groupedFaqs = faqs.reduce((acc, faq) => {
        const cat = faq.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(faq);
        return acc;
    }, {} as Record<string, FAQ[]>);

    const toggle = (id: string) => setOpenId(openId === id ? null : id);

    const categoryLabels: Record<string, string> = {
        'general': 'General',
        'projects': 'Gestión de Proyectos',
        'account': 'Mi Cuenta',
        'technical': 'Soporte Técnico',
        'billing': 'Facturación'
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-6 animate-fadeIn">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold mb-4" style={{ color: colors.textPrimary }}>
                    Preguntas Frecuentes
                </h1>
                <p className="max-w-xl mx-auto" style={{ color: colors.textSecondary }}>
                    Encuentra respuestas rápidas a las dudas más comunes sobre el uso de la plataforma Project Hub.
                </p>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                    ))}
                </div>
            ) : (
                <div className="space-y-10">
                    {Object.entries(groupedFaqs).map(([category, items]) => (
                        <div key={category}>
                            <h2 className="text-lg font-semibold mb-4 capitalize px-2" style={{ color: '#00D4B3' }}>
                                {categoryLabels[category] || category}
                            </h2>
                            <div className="space-y-3">
                                {items.map((faq) => (
                                    <div 
                                        key={faq.faq_id} 
                                        className="rounded-xl overflow-hidden transition-all duration-200"
                                        style={{ 
                                            background: isDark ? 'rgba(30, 35, 41, 0.5)' : '#fff',
                                            border: `1px solid ${openId === faq.faq_id ? '#00D4B3' : colors.border}`
                                        }}
                                    >
                                        <button
                                            onClick={() => toggle(faq.faq_id)}
                                            className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                                        >
                                            <span className="font-medium" style={{ color: colors.textPrimary }}>{faq.question}</span>
                                            <span 
                                                className={`transform transition-transform duration-200 ${openId === faq.faq_id ? 'rotate-180' : ''}`}
                                                style={{ color: colors.textMuted }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                            </span>
                                        </button>
                                        <AnimatePresence>
                                            {openId === faq.faq_id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <div className="px-5 pb-5 pt-0" style={{ color: colors.textSecondary }}>
                                                        <div className="h-px w-full bg-gray-500/10 mb-4" />
                                                        <p className="leading-relaxed">{faq.answer}</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

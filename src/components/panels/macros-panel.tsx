import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePreferences } from "@/hooks/use-preferences";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { ToggleSwitch } from "@/components/toggle-switch";
import type { VoiceMacro, MacroAction } from "@/types";

export function MacrosPanel() {
    const { preferences, updatePreferences } = usePreferences();
    const [isAdding, setIsAdding] = useState(false);
    const [newMacro, setNewMacro] = useState<Partial<VoiceMacro>>({
        name: "",
        trigger: "",
        action: { type: "TypeText", value: "" },
        enabled: true,
    });

    const macros = preferences?.voiceMacros || [];

    const handleUpdateMacro = (index: number, updates: Partial<VoiceMacro>) => {
        if (!preferences) return;
        const nextMacros = [...macros];
        nextMacros[index] = { ...nextMacros[index], ...updates } as VoiceMacro;
        updatePreferences({ ...preferences, voiceMacros: nextMacros });
    };

    const handleDeleteMacro = (index: number) => {
        if (!preferences) return;
        const nextMacros = macros.filter((_, i) => i !== index);
        updatePreferences({ ...preferences, voiceMacros: nextMacros });
    };

    const handleAddMacro = () => {
        if (!preferences || !newMacro.name || !newMacro.trigger || !newMacro.action) return;
        updatePreferences({
            ...preferences,
            voiceMacros: [...macros, newMacro as VoiceMacro],
        });
        setIsAdding(false);
        setNewMacro({
            name: "",
            trigger: "",
            action: { type: "TypeText", value: "" },
            enabled: true,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Voice Macros
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Create voice commands to perform actions or insert text.
                    </p>
                </div>
                <motion.button
                    onClick={() => setIsAdding(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors shadow-sm cursor-pointer"
                    aria-label="Add new voice macro"
                >
                    Add Macro
                </motion.button>
            </div>

            <SettingsGroup title="Custom Macros">
                <AnimatePresence mode="popLayout">
                    {macros.length === 0 && !isAdding && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="py-12 flex flex-col items-center justify-center text-center space-y-3"
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">No macros yet</p>
                                <p className="text-xs text-gray-500 max-w-[200px]">Create shortcuts for words or actions you use frequently.</p>
                            </div>
                        </motion.div>
                    )}

                    {macros.map((macro, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2, delay: index * 0.04 }}
                        >
                            <SettingsRow
                                key={index}
                                label={macro.name}
                                description={
                                    <div className="flex items-center gap-1.5 mt-0.5 pointer-events-none">
                                        <span className="text-xs text-gray-400">When you say:</span>
                                        <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 rounded">"{macro.trigger}"</span>
                                    </div>
                                }
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-right mr-2 hidden sm:block">
                                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Action</p>
                                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            {macro.action.type === "TypeText" ? "Type Text" : macro.action.type === "PressKey" ? `Press ${macro.action.value}` : "Delete Word"}
                                        </p>
                                    </div>
                                    <ToggleSwitch
                                        checked={macro.enabled}
                                        onChange={() => handleUpdateMacro(index, { enabled: !macro.enabled })}
                                    />
                                    <button
                                        onClick={() => handleDeleteMacro(index)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all cursor-pointer"
                                        aria-label={`Delete custom macro ${macro.name}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </SettingsRow>
                        </motion.div>
                    ))}

                    {isAdding && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            className="p-5 bg-blue-50/30 dark:bg-blue-900/5 border border-blue-200 dark:border-blue-500/20 rounded-xl space-y-5 m-4 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-400">New Macro</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Friendly Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Code Block"
                                        className="w-full px-3 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                        value={newMacro.name}
                                        onChange={(e) => setNewMacro({ ...newMacro, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Voice Trigger (spoken)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., codeblock"
                                        className="w-full px-3 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                        value={newMacro.trigger}
                                        onChange={(e) => setNewMacro({ ...newMacro, trigger: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Action</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        className="px-3 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm sm:min-w-[140px]"
                                        value={newMacro.action?.type}
                                        onChange={(e) => {
                                            const type = e.target.value as MacroAction["type"];
                                            setNewMacro({
                                                ...newMacro,
                                                action: type === "DeleteBack" ? { type } : { type, value: "" } as MacroAction,
                                            });
                                        }}
                                    >
                                        <option value="TypeText">Type Text...</option>
                                        <option value="PressKey">Press Key...</option>
                                        <option value="DeleteBack">Delete Previous Word</option>
                                    </select>
                                    {newMacro.action?.type !== "DeleteBack" && (
                                        <input
                                            type="text"
                                            placeholder={newMacro.action?.type === "PressKey" ? "Enter, Tab, Backspace..." : "Text to insert..."}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                            value={(newMacro.action as any)?.value || ""}
                                            onChange={(e) =>
                                                setNewMacro({
                                                    ...newMacro,
                                                    action: { ...newMacro.action, value: e.target.value } as MacroAction,
                                                })
                                            }
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={handleAddMacro}
                                    disabled={!newMacro.name || !newMacro.trigger}
                                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    Create Macro
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SettingsGroup>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl transition-all hover:bg-amber-100/50 dark:hover:bg-amber-900/30">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="text-sm text-amber-800 dark:text-amber-400">
                        <p className="font-bold">Pro Tip</p>
                        <p className="mt-0.5 leading-relaxed opacity-90 text-[13px]">
                            TalkyTexty looks for macros at the end of your utterance. Try saying your sentence and then the trigger word immediately after (e.g., "Hello world newline").
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

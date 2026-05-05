import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowLeft, ArrowRight, Check, X, Brain, Trophy, ChevronRight, Loader2, Info, Timer, RotateCcw } from "lucide-react";
import { generateScenario, CBTScenario } from "../services/cbtService";

const ROUNDS_PER_SESSION = 5;
const SECONDS_PER_ROUND = 45;

export default function TrainingGame({ onClose }: { onClose: () => void }) {
  const [scenario, setScenario] = useState<CBTScenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThought, setSelectedThought] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [level, setLevel] = useState(1);
  const [correctInLevel, setCorrectInLevel] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_ROUND);
  const [isGameOver, setIsGameOver] = useState(false);
  const [highScore, setHighScore] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("clarity_high_score");
    if (saved) setHighScore(parseInt(saved));
    
    // Also try to load level progress if any, but start at 1 for session freshness
    // Actually, user starts at Level 1 per requirement.
  }, []);

  useEffect(() => {
    if (isGameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem("clarity_high_score", score.toString());
    }
  }, [isGameOver, score, highScore]);

  const loadNewScenario = async () => {
    if (round > ROUNDS_PER_SESSION) {
      setIsGameOver(true);
      return;
    }
    
    setIsLoading(true);
    setSelectedThought(null);
    setShowResult(false);
    setTimeLeft(SECONDS_PER_ROUND);
    
    try {
      const data = await generateScenario(level, history);
      setScenario(data);
      setHistory(prev => {
        const newHistory = [data.situation, ...prev];
        return newHistory.slice(0, 10);
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNewScenario();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !showResult && !isGameOver && scenario) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading, showResult, isGameOver, scenario]);

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowResult(true);
    setStreak(0);
  };

  const handleSelect = (index: number) => {
    if (showResult || isGameOver) return;
    if (timerRef.current) clearInterval(timerRef.current);
    
    setSelectedThought(index);
    setShowResult(true);
    
    if (scenario?.reframedThoughts[index].isCorrect) {
      const timeBonus = Math.floor(timeLeft * 2);
      setScore(prev => prev + 10 + timeBonus);
      setStreak(prev => prev + 1);
      
      // Progression Logic
      const newCorrectCount = correctInLevel + 1;
      if (newCorrectCount >= 3 && level < 3) {
        setLevel(prev => prev + 1);
        setCorrectInLevel(0);
      } else {
        setCorrectInLevel(newCorrectCount);
      }
    } else {
      setStreak(0);
    }
  };

  const nextRound = () => {
    if (round < ROUNDS_PER_SESSION) {
      setRound(prev => prev + 1);
      loadNewScenario();
    } else {
      setIsGameOver(true);
    }
  };

  const restartGame = () => {
    setRound(1);
    setScore(0);
    setStreak(0);
    setLevel(1);
    setCorrectInLevel(0);
    setIsGameOver(false);
    loadNewScenario();
  };

  if (isGameOver) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl"
      >
        <div className="w-full max-w-lg bg-app-card rounded-[32px] md:rounded-[40px] shadow-2xl border border-app-border overflow-hidden flex flex-col p-8 md:p-12 text-center space-y-6 md:space-y-8">
          <div className="flex justify-center">
             <div className="w-16 h-16 md:w-24 md:h-24 bg-app-bg rounded-full flex items-center justify-center border-2 md:border-4 border-app-border">
                <Trophy className="w-8 h-8 md:w-12 md:h-12 text-amber-500" />
             </div>
          </div>
          <div className="space-y-1 md:space-y-2">
            <h2 className="text-2xl md:text-3xl font-black text-app-text italic leading-tight">Clarity Restored!</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="px-3 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-[10px] font-black uppercase tracking-widest">Lv.{level}</span>
              <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 font-medium">You completed {ROUNDS_PER_SESSION} training rounds.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 md:gap-4">
             <div className="p-4 md:p-6 bg-app-bg rounded-2xl md:rounded-3xl border border-app-border relative">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Final Score</p>
                <p className="text-2xl md:text-3xl font-bold text-app-text">{score}</p>
                {score >= highScore && score > 0 && (
                  <div className="absolute -top-2 -right-1 bg-amber-500 text-white text-[7px] md:text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-lg">New Best</div>
                )}
             </div>
             <div className="p-4 md:p-6 bg-app-bg rounded-2xl md:rounded-3xl border border-app-border">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Best Score</p>
                <p className="text-2xl md:text-3xl font-bold text-app-text">{Math.max(score, highScore)}</p>
             </div>
          </div>

          <div className="p-4 md:p-6 bg-app-bg rounded-2xl md:rounded-3xl text-app-text text-left space-y-3">
             <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">The Purpose</h4>
             <p className="text-[10px] md:text-xs opacity-80 leading-relaxed font-medium">
                Wrong thinking leads to wrong decisions. This game uses cognitive restructuring to correct your thought patterns before you act, building a habit of logical decision-making.
             </p>
             <div className="pt-2 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-app-card rounded text-[8px] md:text-[9px] font-bold uppercase tracking-tighter">Cognitive Restructuring</span>
                <span className="px-2 py-1 bg-app-card rounded text-[8px] md:text-[9px] font-bold uppercase tracking-tighter">Decision Training</span>
             </div>
          </div>

          <div className="flex flex-col gap-2 md:gap-3">
            <motion.button
              onClick={restartGame}
              whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
              className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-4 md:px-8 md:py-5 rounded-2xl md:rounded-3xl font-black text-sm md:text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/20"
            >
              <RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> Play Again
            </motion.button>
            <button
              onClick={onClose}
              className="px-6 py-3 md:px-8 md:py-5 rounded-2xl md:rounded-3xl font-bold text-xs md:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-xl"
    >
      <div className="w-full max-w-2xl bg-app-card rounded-[32px] md:rounded-[40px] shadow-2xl border border-app-border overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
        {/* Header */}
        <header className="p-4 md:p-6 border-b border-app-border flex items-center bg-app-bg/50 shrink-0">
          <div className="flex-1 flex items-center">
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.9, transition: { duration: 0.12 } }}
              className="p-2 md:p-2.5 hover:bg-app-card rounded-full transition-colors group"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 h-6 text-app-text group-hover:-translate-x-1 transition-transform" />
            </motion.button>
          </div>

          <div className="flex-[2] text-center">
            <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-app-text truncate">
              Clarity Training
            </h2>
            <div className="flex items-center justify-center gap-2">
               <span className="text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-400">
                Round {round}/{ROUNDS_PER_SESSION}
              </span>
              <div className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
              <span className="text-[8px] md:text-[9px] uppercase font-black tracking-widest text-amber-500">
                Level {level}
              </span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-2 md:gap-4">
             <div className="bg-app-bg px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl flex items-center gap-2">
                <Timer className={`w-3.5 h-3.5 md:w-4 md:h-4 ${timeLeft < 3 ? "text-red-500 animate-bounce" : "text-zinc-400"}`} />
                <span className={`text-xs md:text-sm font-mono font-bold ${timeLeft < 3 ? "text-red-500" : "text-app-text"}`}>{timeLeft}s</span>
             </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 md:py-20 flex flex-col items-center justify-center space-y-4"
              >
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500 dark:text-zinc-400" />
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium animate-pulse">Scanning the fog...</p>
              </motion.div>
            ) : scenario && (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 md:space-y-10"
              >
                {/* Situation & Emotion */}
                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        The Situation
                      </div>
                      {scenario.emotion && (
                        <div className="px-2 py-0.5 md:px-3 md:py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                          Feeling: {scenario.emotion}
                        </div>
                      )}
                    </div>
                    <p className="text-lg md:text-xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {scenario.situation}
                    </p>
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      Confused Thought
                    </div>
                    <div className="p-6 md:p-8 bg-app-card border-2 border-dashed border-app-border rounded-[24px] md:rounded-[32px] relative transform -rotate-1">
                       <p className="text-xl md:text-3xl font-light italic leading-relaxed text-app-text">
                          "{scenario.distortedThought}"
                       </p>
                    </div>
                  </div>
                </div>

                {/* Choices */}
                <div className="space-y-4">
                   <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    Choose the clearer thought
                  </div>
                  <div className="grid gap-3 md:gap-4">
                    {scenario.reframedThoughts.map((thought, i) => {
                      const isSelected = selectedThought === i;
                      const isCorrect = thought.isCorrect;
                      
                      let bgColor = "bg-app-bg hover:opacity-80";
                      let borderColor = "border-app-border";
                      let textColor = "text-app-text";

                      if (showResult) {
                        if (isCorrect) {
                          bgColor = "bg-green-50 dark:bg-green-950/20";
                          borderColor = "border-green-500 shadow-lg shadow-green-500/10";
                          textColor = "text-green-700 dark:text-green-300";
                        } else if (isSelected && !isCorrect) {
                          bgColor = "bg-red-50 dark:bg-red-950/20";
                          borderColor = "border-red-500";
                          textColor = "text-red-700 dark:text-red-300";
                        } else {
                          bgColor = "opacity-30";
                        }
                      }

                      return (
                        <motion.button
                          key={i}
                          onClick={() => handleSelect(i)}
                          disabled={showResult}
                          whileTap={!showResult ? { scale: 0.95, transition: { duration: 0.12 } } : {}}
                          className={`w-full p-4 md:p-6 rounded-2xl md:rounded-[24px] border-2 text-left transition-all relative group flex gap-3 md:gap-4 items-start ${bgColor} ${borderColor} ${textColor} ${!showResult ? "active:scale-[0.98] hover:-translate-y-0.5" : ""}`}
                        >
                          <div className={`mt-1 w-5 h-5 md:w-6 md:h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                             showResult && isCorrect ? "bg-green-500 border-green-500 text-white" : 
                             showResult && isSelected && !isCorrect ? "bg-red-500 border-red-500 text-white" :
                             "bg-app-bg border-app-border"
                          }`}>
                            {showResult && isCorrect && <Check className="w-3 h-3 md:w-4 md:h-4" />}
                            {showResult && isSelected && !isCorrect && <X className="w-3 h-3 md:w-4 md:h-4" />}
                          </div>
                          <div className="flex-1">
                             <span className="text-base md:text-lg font-medium leading-snug">{thought.text}</span>
                             {showResult && (
                               <div className="mt-1 md:mt-2 text-[10px] md:text-xs opacity-60">
                                 {thought.type} thinking
                               </div>
                             )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <AnimatePresence>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-6 md:p-8 bg-app-bg rounded-[24px] md:rounded-[32px] text-app-text space-y-3 md:space-y-4 shadow-inner"
                    >
                      <div className="flex items-center gap-2">
                        {timeLeft === 0 && !selectedThought ? (
                          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-widest text-[10px]">
                             <Timer className="w-3 h-3" /> Time Expired
                          </div>
                        ) : selectedThought !== null && scenario.reframedThoughts[selectedThought].isCorrect ? (
                          <div className="flex items-center gap-2 text-green-400 font-bold uppercase tracking-widest text-[10px]">
                             <Sparkles className="w-3 h-3" /> Perfect Clarity!
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-widest text-[10px]">
                             Foggy Thinking
                          </div>
                        )}
                      </div>
                      <p className="text-base md:text-xl font-light italic leading-relaxed">
                        {selectedThought !== null ? scenario.reframedThoughts[selectedThought].explanation : "Selection expired. Try to decide quickly next time."}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="p-6 md:p-8 border-t border-app-border flex flex-col md:flex-row items-center gap-4 md:justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4 text-app-text opacity-60 text-[10px] font-bold uppercase tracking-widest">
            <span>Score: {score}</span>
            <div className="w-1 h-1 bg-app-text rounded-full opacity-30" />
            <span>Streak: {streak} 🔥</span>
          </div>
          {showResult ? (
            <motion.button
              onClick={nextRound}
              whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-zinc-50 dark:text-zinc-950 px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-sm md:text-base hover:scale-105 active:scale-95 transition-all shadow-xl shadow-zinc-900/20"
            >
              {round < ROUNDS_PER_SESSION ? "Next Challenge" : "See Results"} <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </motion.button>
          ) : (
             <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[10px] font-medium italic">
                <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Pick the most realistic thought
             </div>
          )}
        </footer>
      </div>
    </motion.div>
  );
}


import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, MessageSquare, ArrowLeft, ArrowRight, Loader2, RefreshCw, Plus, User, Check, X, Anchor, HelpCircle, Info, Coffee, Clock, BookOpen, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getClarity, getNextStep, getStuckTask, decideForMe, planMyDay, getCookingClarity, getMinimalClarity, getNoTimeClarity, getOverthinkingClarity, getStudyClarity, getDifferentApproach, getFollowUpQuestion } from "./services/gemini";
import TrainingGame from "./components/TrainingGame";

const DEMO_SCENARIOS = [
  {
    icon: "💼",
    title: "Overwhelmed Professional",
    category: "Work",
    problem: "I have a mountain of tasks, three deadlines tomorrow, and my inbox is exploding. I feel paralyzed and don't know where to start.",
    description: "Learn how to slice an overwhelming workload into three simple, actionable steps.",
    sampleSolution: "1. Focus strictly on the 'Tomorrow' deadlines first. Map each to a 90-minute block. Anything not due tomorrow is invisible for the next 4 hours.\n2. Set an auto-responder for your inbox saying you're in 'Deep Work' mode and will check at 4 PM. This kills the mental pinging.\n3. Complete one 'Small Win' task (less than 5 mins) right now to break the freeze response."
  },
  {
    icon: "🎨",
    title: "The Creative Block",
    category: "Personal",
    problem: "I want to start a side project—either a podcast or a tech blog—but I've been thinking about it for months without taking a single step. I'm afraid of picking the wrong one.",
    description: "See how Clarity AI breaks decision paralysis and gets you moving.",
    sampleSolution: "1. You aren't picking a life mission, you're picking a 30-day experiment. Flip a coin to choose one today.\n2. Set a 'Micro-Goal': Spend exactly 20 minutes creating the first outline or recording a 2-minute test note. No more, no less.\n3. Accept that 'Wrong' is better than 'None'. You can pivot in 30 days with the skills you've learned."
  },
  {
    icon: "🏠",
    title: "Life Decision Fatigue",
    category: "Health",
    problem: "I need to move out soon, but I'm torn between staying in the city for the social life or moving to the suburbs to save money. Both have huge pros and cons and I'm stuck in a loop.",
    description: "Witness the AI's objective analysis of a complex personal dilemma.",
    sampleSolution: "1. Distinguish between 'Daily Life' and 'Weekend Life'. Most people overestimate how much they use city amenities on weekdays. Map your last 14 days of activity.\n2. Use the 'Two-Year Test': Where will you be in 24 months? If savings enable a major life goal (like a business or travel), the suburbs wins. If your career depends on networking, the city wins.\n3. Rent an Airbnb in the suburbs for 3 days next week. Experience the commute and the quiet before committing."
  }
];

export default function App() {
  const [userName, setUserName] = useState("");
  const [userBio, setUserBio] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [categories, setCategories] = useState<string[]>(["Work", "Personal", "Health"]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [problem, setProblem] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [previousProblem, setPreviousProblem] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [stuckTask, setStuckTask] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("Great job! 🔥");
  const [isLoading, setIsLoading] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingStuck, setIsLoadingStuck] = useState(false);
  const [isLoadingDecide, setIsLoadingDecide] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isLoadingCook, setIsLoadingCook] = useState(false);
  const [isLoadingMinimal, setIsLoadingMinimal] = useState(false);
  const [isLoadingNoTime, setIsLoadingNoTime] = useState(false);
  const [isLoadingOverthinking, setIsLoadingOverthinking] = useState(false);
  const [isLoadingStudy, setIsLoadingStudy] = useState(false);
  const [isLoadingDifferent, setIsLoadingDifferent] = useState(false);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const REWARDS = [
    "You're doing great! 🌟",
    "I knew you could do it! ✨",
    "Taking charge, I love it! 🚀",
    "One win at a time. Proud of you! 👣",
    "You've got this! 🔥",
    "Energy boost! 🔋",
    "Small steps, big progress. 🎯",
    "That felt good, didn't it? ⚡",
    "Keep that momentum going! ⭐",
    "You're making this look easy. 🏆"
  ];

  const parseSteps = (text: string | null) => {
    if (!text) return { intro: "", steps: [] };
    const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
    const intro = lines[0] || "";
    const steps = lines
      .filter(line => /^\d+\./.test(line))
      .map(line => line.replace(/^\d+\.\s*/, ""));
    return { intro, steps: steps.slice(0, 3) }; // Ensure we only get the 3 steps
  };

  const { intro, steps: initialSteps } = parseSteps(suggestion);
  const allTasks = [...initialSteps, ...nextSteps];
  const totalSteps = allTasks.length + (stuckTask ? 1 : 0);
  const progress = totalSteps > 0 ? (completedTaskIds.length / totalSteps) * 100 : 0;

  useEffect(() => {
    const savedName = localStorage.getItem("clarity_user_name");
    const savedBio = localStorage.getItem("clarity_user_bio");
    if (savedName) setUserName(savedName);
    if (savedBio) setUserBio(savedBio);

    const savedTheme = localStorage.getItem("clarity_theme");
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDarkMode(true);
    }

    const savedCategories = localStorage.getItem("clarity_categories");
    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }
  }, []);


  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("clarity_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("clarity_theme", "light");
    }
  }, [isDarkMode]);

  const saveProfile = () => {
    localStorage.setItem("clarity_user_name", userName);
    localStorage.setItem("clarity_user_bio", userBio);
    setIsEditingProfile(false);
  };

  const addCategory = () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      const updated = [...categories, newCategoryName.trim()];
      setCategories(updated);
      localStorage.setItem("clarity_categories", JSON.stringify(updated));
      setSelectedCategory(newCategoryName.trim());
      setNewCategoryName("");
      setIsAddingCategory(false);
    }
  };

  const handleGetClarity = async () => {
    if (!problem.trim() || isLoading) return;

    // Capture current context before resetting/updating
    const currentSuggestion = suggestion;
    const currentFollowUp = followUpQuestion;
    const currentProblemContent = previousProblem; 
    const newProblemContent = problem;

    setIsLoading(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const clarity = await getClarity(newProblemContent, {
        previousProblem: currentProblemContent || undefined,
        previousSuggestion: currentSuggestion || undefined,
        followUp: currentFollowUp || undefined,
        category: selectedCategory || undefined,
        history: interactionHistory
      }, {
        name: userName,
        bio: userBio
      });
      
      setSuggestion(clarity || "No clarity found. Reach deeper.");
      setPreviousProblem(newProblemContent); // Store this as the "previous" problem for next turn
      setInteractionHistory(prev => [newProblemContent, ...prev].slice(0, 3));
      setProblem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSuggestion(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecideForMe = async () => {
    if (!problem.trim() || isLoadingDecide) return;

    setIsLoadingDecide(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const decision = await decideForMe(problem, {
        previousProblem: previousProblem || undefined,
        history: interactionHistory
      }, {
        name: userName,
        bio: userBio
      });
      setSuggestion(decision || "I'm balanced between the scales.");
      setInteractionHistory(prev => [problem, ...prev].slice(0, 3));
      setPreviousProblem(problem);
      setProblem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "My scales are broken. Try again.");
    } finally {
      setIsLoadingDecide(false);
    }
  };

  const handlePlanMyDay = async () => {
    if (!problem.trim() || isLoadingPlan) return;

    setIsLoadingPlan(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const plan = await planMyDay(problem, {
        previousProblem: previousProblem || undefined,
        history: interactionHistory
      }, {
        name: userName,
        bio: userBio
      });
      setSuggestion(plan || "I couldn't structure your day. Just pick one thing and start.");
      setInteractionHistory(prev => [problem, ...prev].slice(0, 3));
      setPreviousProblem(problem);
      setProblem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "I couldn't plan the day. Try again.");
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleCookingClarity = async () => {
    if (!problem.trim() || isLoadingCook) return;

    setIsLoadingCook(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const decision = await getCookingClarity(problem, {
        previousProblem: previousProblem || undefined,
        history: interactionHistory
      }, {
        name: userName,
        bio: userBio
      });
      setSuggestion(decision || "I'm still looking through the pantry.");
      setInteractionHistory(prev => [problem, ...prev].slice(0, 3));
      setPreviousProblem(problem);
      setProblem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "I couldn't decide what to cook. Try again.");
    } finally {
      setIsLoadingCook(false);
    }
  };

  const handleMinimalClarity = async () => {
    if (isLoadingMinimal) return;

    setIsLoadingMinimal(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const response = await getMinimalClarity({
        name: userName,
        bio: userBio
      });
      setSuggestion(response || "Take all the time you need.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "It's okay to rest. Try again when you're ready.");
    } finally {
      setIsLoadingMinimal(false);
    }
  };

  const handleNoTimeClarity = async () => {
    if (isLoadingNoTime) return;

    setIsLoadingNoTime(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const response = await getNoTimeClarity({
        name: userName,
        bio: userBio
      });
      setSuggestion(response || "Take just one breath.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "You have enough time to sit for one minute. Try again.");
    } finally {
      setIsLoadingNoTime(false);
    }
  };

  const handleOverthinkingClarity = async () => {
    if (isLoadingOverthinking) return;

    setIsLoadingOverthinking(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const response = await getOverthinkingClarity({
        name: userName,
        bio: userBio
      });
      setSuggestion(response || "Stop thinking. Pick one thing and start.");
      setProblem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stop. Do the first thing you see. Now.");
    } finally {
      setIsLoadingOverthinking(false);
    }
  };

  const handleStudyClarity = async () => {
    if (!problem.trim() || isLoadingStudy) return;

    setIsLoadingStudy(true);
    setError(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);

    try {
      const response = await getStudyClarity(problem, {
        previousProblem: previousProblem || undefined,
        history: interactionHistory
      }, {
        name: userName,
        bio: userBio
      });
      setSuggestion(response || "Open your book. Read one sentence.");
      setInteractionHistory(prev => [problem, ...prev].slice(0, 3));
      setPreviousProblem(problem);
      setProblem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Focus. Open your notes now.");
    } finally {
      setIsLoadingStudy(false);
    }
  };

  const handleThisDidntHelp = async () => {
    const contextProblem = problem || previousProblem;
    if (!contextProblem || !suggestion || isLoadingDifferent) return;
    setFollowUpQuestion(null);
    setIsLoadingDifferent(true);
    try {
      const response = await getDifferentApproach(contextProblem, suggestion, { history: interactionHistory });
      setSuggestion(response);
      setNextSteps([]);
      setStuckTask(null);
      setFollowUpQuestion(null);
    } finally {
      setIsLoadingDifferent(false);
    }
  };

  const handleContinue = async () => {
    const contextProblem = problem || previousProblem;
    if (!contextProblem || !suggestion || isLoadingFollowUp) return;
    setFollowUpQuestion(null);
    setIsLoadingFollowUp(true);
    try {
      const question = await getFollowUpQuestion(contextProblem, suggestion, { history: interactionHistory });
      setFollowUpQuestion(question);
    } finally {
      setIsLoadingFollowUp(false);
    }
  };

  const removeCategory = (cat: string) => {
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    localStorage.setItem("clarity_categories", JSON.stringify(updated));
    if (selectedCategory === cat) setSelectedCategory(null);
  };

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds(prev => {
      const isCompleted = prev.includes(taskId);
      if (isCompleted) {
        return prev.filter(id => id !== taskId);
      } else {
        const randomReward = REWARDS[Math.floor(Math.random() * REWARDS.length)];
        setRewardMessage(randomReward);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
        return [...prev, taskId];
      }
    });
  };

  const handleComplete = () => {
    // Find first incomplete task and complete it
    const incompleteTask = allTasks.find(task => !completedTaskIds.includes(task)) || stuckTask;
    if (incompleteTask) {
      toggleTask(incompleteTask);
    }
  };

  const handleStuck = async () => {
    if (isLoadingStuck) return;
    setIsLoadingStuck(true);
    try {
      const activeProblem = problem || previousProblem;
      const task = await getStuckTask(activeProblem || undefined, { history: interactionHistory });
      setStuckTask(task);
    } finally {
      setIsLoadingStuck(false);
    }
  };

  const launchDemo = (scenario: typeof DEMO_SCENARIOS[0]) => {
    reset();
    setProblem(scenario.problem);
    setSelectedCategory(scenario.category);
    setIsDemoOpen(false);
    // Smooth scroll to the input if needed
    const input = document.getElementById('problem-input');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const viewSampleSolution = (scenario: typeof DEMO_SCENARIOS[0]) => {
    reset();
    setProblem(scenario.problem);
    setSelectedCategory(scenario.category);
    setSuggestion(scenario.sampleSolution);
    setIsDemoOpen(false);
    // Suggestion section will auto-show
  };

  const handleNextStep = async () => {
    const activeProblem = problem || previousProblem;
    if (isLoadingNext || !activeProblem || !suggestion) return;

    setIsLoadingNext(true);
    try {
      const context = suggestion + (nextSteps.length > 0 ? ". " + nextSteps.join(". ") : "");
      const step = await getNextStep(activeProblem, context, { history: interactionHistory });
      if (step) {
        setNextSteps((prev) => [...prev, step]);
      }
    } finally {
      setIsLoadingNext(false);
    }
  };

  const reset = () => {
    setProblem("");
    setPreviousProblem(null);
    setInteractionHistory([]);
    setSuggestion(null);
    setNextSteps([]);
    setStuckTask(null);
    setFollowUpQuestion(null);
    setCompletedTaskIds([]);
    setShowCelebration(false);
    setError(null);
    setIsPlanningMode(false);
    setIsCookingMode(false);
    setIsStudyMode(false);
    inputRef.current?.focus();
  };

  const handleBack = () => {
    if (isDemoOpen) setIsDemoOpen(false);
    else if (isHelpOpen) setIsHelpOpen(false);
    else if (isAboutOpen) setIsAboutOpen(false);
    else if (suggestion || error) {
      setSuggestion(null);
      setError(null);
      if (previousProblem) {
        setProblem(previousProblem);
      }
    } else {
      setIsPlanningMode(false);
      setIsCookingMode(false);
      setIsStudyMode(false);
    }
  };

  const getScreenTitle = () => {
    if (isDemoOpen) return "Interactive Demos";
    if (isHelpOpen) return "User Guide";
    if (isAboutOpen) return "Clarity Story";
    if (suggestion) return "Your Path to Clarity";
    if (error) return "System Notice";
    if (isPlanningMode) return "Planning Studio";
    if (isCookingMode) return "Cooking Compass";
    if (isStudyMode) return "Study Sanctuary";
    return "";
  };

  const isNonHome = isPlanningMode || isCookingMode || isStudyMode || !!suggestion || !!error;

  const isAnyLoading = isLoading || isLoadingDecide || isLoadingPlan || isLoadingCook || isLoadingMinimal || isLoadingNoTime || isLoadingOverthinking || isLoadingStudy || isLoadingDifferent || isLoadingFollowUp || isLoadingNext || isLoadingStuck;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-screen bg-app-bg text-app-text flex flex-col items-center pt-32 pb-20 px-6 md:p-12 font-sans transition-colors duration-500"
    >
      {/* Top Progress Bar */}
      <AnimatePresence>
        {isAnyLoading && (
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 h-1 bg-zinc-900 dark:bg-white z-[100] origin-left"
          />
        )}
      </AnimatePresence>

      {/* Navigation Header for Non-Home Screens */}
      <AnimatePresence>
        {(isNonHome || isDemoOpen || isHelpOpen || isAboutOpen) && !isGameOpen && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-[70] bg-app-bg/95 backdrop-blur-xl border-b border-app-border h-16 md:h-20 flex items-center px-4 md:px-8 shadow-sm"
          >
            <div className="flex-1 flex items-center">
              <motion.button
                onClick={handleBack}
                whileTap={{ scale: 0.9, transition: { duration: 0.12 } }}
                className="p-2 md:p-3 hover:bg-app-card rounded-full transition-colors group"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 h-6 text-app-text group-hover:-translate-x-1 transition-transform" />
              </motion.button>
            </div>
            
            <div className="flex-[2] text-center">
              <motion.h2 
                key={getScreenTitle()}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-app-text truncate"
              >
                {getScreenTitle()}
              </motion.h2>
            </div>

            <div className="flex-1 flex justify-end">
              <button 
                 onClick={reset}
                 className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors"
                title="Reset to Home"
              >
                Reset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar (Only visible on Home) */}
      <AnimatePresence>
        {!isNonHome && !isDemoOpen && !isHelpOpen && !isAboutOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-40 p-4 md:p-6 flex flex-wrap items-center justify-center md:justify-end gap-2 bg-app-bg/80 backdrop-blur-md md:bg-transparent md:backdrop-blur-none"
          >
        <motion.button
          onClick={() => setIsDarkMode(!isDarkMode)}
          whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
          className="flex items-center gap-2 bg-app-card border border-app-border px-3 py-2 md:px-4 md:py-2.5 rounded-full text-app-text hover:opacity-80 transition-all shadow-sm"
          title="Toggle Theme"
        >
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em]">Light / Dark</span>
        </motion.button>
        <motion.button
          onClick={() => setIsDemoOpen(true)}
          whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
          className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-[10px] md:text-xs font-bold hover:scale-105 transition-all shadow-sm group"
        >
          <Sparkles className="w-3.5 h-3.5 md:w-4 h-4 group-hover:rotate-12 transition-transform" />
          Try Demo
        </motion.button>
        <motion.button
          onClick={() => setIsGameOpen(true)}
          whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
          className="flex items-center md:flex-col items-start bg-app-card border border-app-border px-4 py-2 md:px-5 md:py-2.5 rounded-full md:rounded-3xl text-app-text hover:opacity-80 transition-all shadow-sm group"
          title="Training Game"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 md:w-4 h-4 group-hover:scale-110 transition-transform text-zinc-500 dark:text-zinc-400" />
            <span className="text-[10px] md:text-sm font-black whitespace-nowrap">Train Mind</span>
          </div>
          <span className="hidden md:block text-[9px] text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Clarity Prep</span>
        </motion.button>
        <motion.button
          onClick={() => setIsHelpOpen(true)}
          whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
          className="p-2 md:p-2.5 bg-app-card border border-app-border rounded-full text-app-text hover:opacity-80 transition-all shadow-sm"
          title="How to use"
        >
          <HelpCircle className="w-3.5 h-3.5 md:w-4 h-4" />
        </motion.button>
        <motion.button
          onClick={() => setIsAboutOpen(true)}
          whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
          className="p-2 md:p-2.5 bg-app-card border border-app-border rounded-full text-app-text hover:opacity-80 transition-all shadow-sm"
          title="About the app"
        >
          <Info className="w-3.5 h-3.5 md:w-4 h-4" />
        </motion.button>
        <motion.button
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          whileTap={{ scale: 0.9, transition: { duration: 0.12 } }}
          className="flex items-center gap-2 bg-app-card border border-app-border px-3 py-2 md:px-4 md:py-2 rounded-full text-[10px] md:text-sm font-medium text-app-text hover:opacity-80 transition-all shadow-sm max-w-[120px] md:max-w-none"
        >
          <User className="w-3.5 h-3.5 md:w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <span className="truncate">{userName || "Profile"}</span>
        </motion.button>

        <AnimatePresence>
          {isEditingProfile && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-4 md:right-0 top-16 md:mt-4 w-[calc(100vw-32px)] md:w-96 bg-white border border-zinc-200 rounded-[24px] p-6 md:p-8 shadow-2xl space-y-6 z-50"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Profile Settings</h3>
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-white text-black border border-[#ccc] p-[12px] text-[16px] rounded-lg focus:ring-2 focus:ring-black outline-none transition-all block opacity-100 visible"
                    style={{ opacity: 1, visibility: 'visible' }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">About</label>
                  <textarea
                    value={userBio}
                    onChange={(e) => setUserBio(e.target.value)}
                    placeholder="A brief bio..."
                    className="w-full bg-white text-black border border-[#ccc] p-[12px] text-[16px] rounded-lg focus:ring-2 focus:ring-black outline-none transition-all block opacity-100 visible min-h-[100px] resize-none"
                    style={{ opacity: 1, visibility: 'visible' }}
                  />
                </div>
              </div>

              <motion.button
                onClick={() => {
                  saveProfile();
                  setIsEditingProfile(false);
                }}
                whileTap={{ scale: 0.98, transition: { duration: 0.12 } }}
                className="w-full bg-zinc-900 border border-black text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-md active:scale-[0.98] mt-2 cursor-pointer"
              >
                Save Profile
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )}
  </AnimatePresence>

      {/* Demo Modal */}
      <AnimatePresence>
        {isDemoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsDemoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-app-card w-full max-w-2xl rounded-3xl p-8 pt-24 md:pt-28 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >

              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-app-bg rounded-2xl">
                  <Sparkles className="w-6 h-6 text-app-text" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-app-text tracking-tight">Interactive Demos</h2>
                  <p className="text-xs text-zinc-500 uppercase font-black tracking-widest mt-1">Experience the clarity</p>
                </div>
              </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DEMO_SCENARIOS.map((scenario, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-start text-left p-6 bg-app-bg border border-app-border rounded-3xl transition-all group shadow-sm hover:border-zinc-400 dark:hover:border-zinc-500"
                  >
                    <span className="text-3xl mb-4 group-hover:scale-110 transition-transform block">{scenario.icon}</span>
                    <h3 className="font-bold text-app-text mb-2 tracking-tight leading-tight">{scenario.title}</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed opacity-80 mb-6">
                      {scenario.description}
                    </p>
                    <div className="mt-auto w-full space-y-2">
                      <motion.button 
                        onClick={() => launchDemo(scenario)}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="w-full py-2 bg-app-bg border border-app-border rounded-xl text-[10px] font-black uppercase tracking-widest text-app-text hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                      >
                        Try this scenario <ArrowRight className="w-3 h-3" />
                      </motion.button>
                      <motion.button 
                        onClick={() => viewSampleSolution(scenario)}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        See Sample Result <Sparkles className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">How it works</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                  Selecting a demo will pre-fill the input area with a real-world problem. Click "Get Clarity" to see how the AI guides you through the mess into a clear path forward.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGameOpen && (
          <TrainingGame onClose={() => setIsGameOpen(false)} />
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      {/* Help Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsHelpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-app-card w-full max-w-lg rounded-3xl p-8 pt-24 md:pt-28 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >

              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-app-bg rounded-2xl">
                  <Sparkles className="w-6 h-6 text-app-text" />
                </div>
                <h2 className="text-2xl font-bold text-app-text">How to use Clarity</h2>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">Just talk</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    Type whatever is on your mind. I'm not corporate software; I'm here to talk and help you find clarity like a friend would.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">Ending Confusion</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    If you're stuck on what to do, use <strong>Get Clarity</strong> or <strong>Decide for me</strong>. Simple steps, zero stress.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">No pressure</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    I'll never say "Task Completed" and force you to stop. The conversation stays open as long as you need.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">What's for dinner?</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    Can't decide what to cook? List your options or ingredients, and I'll pick the best one for you.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">Context matters</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    Selecting a category helps me understand the direction of our conversation better.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">Clarity Training</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    Confusion often starts with distorted thinking. This tool uses <strong>Cognitive Restructuring</strong> to help you spot these patterns early, correcting your mindset before you take action or make decisions. It’s mental preparation for real-world clarity.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-2">Absolutely Stuck?</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    If your mind is totally blocked, use <strong>I'm still stuck</strong> for a tiny 2-minute reset task to get your flow back.
                  </p>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAboutOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-app-card w-full max-w-sm rounded-3xl p-8 pt-24 md:pt-28 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-app-bg rounded-full flex items-center justify-center overflow-hidden">
                  <User className="w-8 h-8 text-zinc-400" />
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-app-text">Why this exists</h2>
                  <div className="space-y-4 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                    <p>
                      Hi, I'm <strong>Maham Arshad</strong> from Pakistan.
                    </p>
                    <p>
                      I built this because I struggled with overthinking and decision fatigue. Every small thing felt confusing.
                    </p>
                    <p>
                      I wanted a space that guides me like a friend, not like corporate software. Zero stress, pure clarity.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-center">
                  <div className="px-5 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span> Made with Love in Pakistan
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsResetConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-app-card w-full max-w-sm rounded-3xl p-8 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-app-text mb-2">Are you sure?</h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-8">
                This will clear everything and take you back to the start.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    reset();
                    setIsResetConfirmOpen(false);
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl text-sm font-bold transition-colors"
                >
                  Clear everything
                </button>
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="flex-1 bg-app-card text-zinc-600 dark:text-zinc-400 py-3 rounded-2xl text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {suggestion && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-0 left-0 w-full h-1.5 bg-zinc-100 dark:bg-zinc-900 z-50"
          >
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-app-text opacity-80"
            />
            <div className="absolute top-4 right-6 text-[10px] font-bold tracking-widest text-zinc-600 dark:text-zinc-400 uppercase">
              Progress: {Math.round(progress)}%
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl flex flex-col items-center text-center space-y-12"
      >
        <header className="space-y-4 px-4 md:px-0">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative flex items-center justify-center mb-4"
          >
            <div className="p-3 bg-app-card rounded-2xl shadow-sm text-app-text">
              <Sparkles className="w-6 h-6" />
            </div>
            
            <AnimatePresence>
              {showCelebration && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: 1, y: -40, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute whitespace-nowrap font-display font-bold text-lg md:text-xl text-app-text text-center px-4"
                >
                  {rewardMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-app-text leading-tight">
            {userName ? `Clarity for ${userName}` : "Clarity AI"}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-base sm:text-lg md:text-xl font-light max-w-lg mx-auto">
            {userBio || "Distill the noise into truth."}
          </p>
        </header>

        <main className="w-full space-y-8 px-4 md:px-0">
          {/* Category Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-full overflow-hidden">
            {categories.map((cat) => (
              <div key={cat} className="group/cat relative shrink-0">
                <button
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`px-3 py-1.5 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${
                    selectedCategory === cat
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg"
                      : "bg-app-card text-zinc-500 dark:text-zinc-400 hover:opacity-80"
                  }`}
                >
                  {cat}
                </button>
                {!["Work", "Personal", "Health"].includes(cat) && (
                  <AnimatePresence>
                    {categoryToDelete === cat ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 z-20 flex items-center justify-center gap-1 bg-red-600 rounded-full px-2"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCategory(cat);
                            setCategoryToDelete(null);
                          }}
                          className="text-[8px] font-black uppercase text-white hover:underline"
                        >
                          Yes
                        </button>
                        <span className="text-[8px] text-white/50">/</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToDelete(null);
                          }}
                          className="text-[8px] font-black uppercase text-white hover:underline"
                        >
                          No
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryToDelete(cat);
                        }}
                        whileTap={{ scale: 0.8 }}
                        whileHover={{ scale: 1.2, rotate: 90 }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border border-app-border rounded-full shadow-xl z-10 transition-colors hover:bg-red-500 dark:hover:bg-red-500 hover:text-white dark:hover:text-white"
                        title={`Delete ${cat}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}
              </div>
            ))}
            
            <div className="relative shrink-0">
              {!isAddingCategory ? (
                <motion.button
                  onClick={() => setIsAddingCategory(true)}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 bg-app-card border border-dashed border-app-border rounded-full text-zinc-400 hover:text-app-text transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </motion.button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 bg-app-card border border-app-border p-1 rounded-full shadow-xl"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    placeholder="Category..."
                    className="bg-transparent border-none outline-none px-3 py-0.5 text-xs font-medium w-24 md:w-28 text-app-text"
                  />
                  <button onClick={addCategory} className="p-1 text-green-500 hover:scale-110 transition-transform">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsAddingCategory(false)} className="p-1 text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          <div className="relative w-full group">
            <motion.textarea
              ref={inputRef}
              id="problem-input"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={
                isPlanningMode ? "What do you need to do today?" : 
                isCookingMode ? "What are your options?" : 
                isStudyMode ? "When is your exam and what subject?" :
                "What is weighing on your mind?"
              }
              whileFocus={{ 
                boxShadow: isDarkMode 
                  ? "0 0 40px rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.1)" 
                  : "0 0 40px rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.05)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"
              }}
              className="w-full bg-app-card border border-app-border rounded-[32px] p-6 md:p-8 text-lg sm:text-xl md:text-3xl font-light text-app-text placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 transition-all min-h-[160px] md:min-h-[200px] resize-none shadow-sm group-hover:shadow-md dark:shadow-none relative z-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (isPlanningMode) handlePlanMyDay();
                  else if (isCookingMode) handleCookingClarity();
                  else if (isStudyMode) handleStudyClarity();
                  else handleGetClarity();
                }
              }}
            />
          </div>

          <div className="flex flex-col items-center gap-6 md:gap-8 w-full mt-4">
            {!isPlanningMode && !isCookingMode && !isStudyMode ? (
              <div className="w-full flex flex-col items-center gap-6 md:gap-8">
                {/* Primary Action */}
                <button
                  id="get-clarity-button"
                  onClick={handleGetClarity}
                  disabled={isLoading || isLoadingDecide || !problem.trim()}
                  className="group w-full md:max-w-sm relative flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-5 md:px-12 md:py-6 rounded-full text-xl md:text-2xl font-bold hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-2xl shadow-zinc-900/20 dark:shadow-none cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Get Clarity
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                {/* Secondary Actions Row 1 */}
                <div className="w-full max-w-2xl flex flex-wrap justify-center gap-2 md:gap-3">
                  <motion.button
                    id="decide-button"
                    onClick={handleDecideForMe}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    disabled={isLoading || isLoadingDecide || !problem.trim()}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-app-card text-app-text px-4 py-3 md:px-6 md:py-3 rounded-full text-xs md:text-sm font-semibold border border-app-border hover:opacity-80 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    {isLoadingDecide ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Decide <span className="hidden sm:inline">for me</span>
                        <HelpCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-400" />
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    id="plan-mode-button"
                    onClick={() => {
                      setIsPlanningMode(true);
                      setIsCookingMode(false);
                      setIsStudyMode(false);
                      setProblem("");
                      inputRef.current?.focus();
                    }}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-app-card text-zinc-600 dark:text-zinc-400 px-4 py-3 md:px-6 md:py-3 rounded-full text-xs md:text-sm font-semibold border border-app-border hover:opacity-80 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Anchor className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-400" />
                    Plan <span className="hidden sm:inline">my day</span>
                  </motion.button>

                  <motion.button
                    id="cook-mode-button"
                    onClick={() => {
                      setIsCookingMode(true);
                      setIsPlanningMode(false);
                      setIsStudyMode(false);
                      setProblem("");
                      inputRef.current?.focus();
                    }}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-app-card text-zinc-600 dark:text-zinc-400 px-4 py-3 md:px-6 md:py-3 rounded-full text-xs md:text-sm font-semibold border border-app-border hover:opacity-80 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-400" />
                    Cook <span className="hidden sm:inline">something</span>
                  </motion.button>

                  <motion.button
                    id="study-mode-button"
                    onClick={() => {
                      setIsStudyMode(true);
                      setIsPlanningMode(false);
                      setIsCookingMode(false);
                      setProblem("");
                      inputRef.current?.focus();
                    }}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-app-card text-zinc-600 dark:text-zinc-400 px-4 py-3 md:px-6 md:py-3 rounded-full text-xs md:text-sm font-semibold border border-app-border hover:opacity-80 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-400" />
                    Study <span className="hidden sm:inline">help</span>
                  </motion.button>
                </div>

                {/* Secondary Actions Row 2 (Minimalist options) */}
                <div className="w-full max-w-2xl flex flex-col sm:flex-row flex-wrap justify-center gap-2">
                  <motion.button
                    id="minimal-mode-button"
                    onClick={handleMinimalClarity}
                    disabled={isLoadingMinimal}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    className="flex items-center justify-center gap-2 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-500 px-4 py-2.5 rounded-full text-[10px] md:text-xs font-medium border border-zinc-200 dark:border-zinc-800 border-dotted hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {isLoadingMinimal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coffee className="w-3 h-3 opacity-50" />}
                    I don’t feel like doing anything
                  </motion.button>

                  <motion.button
                    id="no-time-mode-button"
                    onClick={handleNoTimeClarity}
                    disabled={isLoadingNoTime}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    className="flex items-center justify-center gap-2 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-500 px-4 py-2.5 rounded-full text-[10px] md:text-xs font-medium border border-zinc-200 dark:border-zinc-800 border-dotted hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {isLoadingNoTime ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3 opacity-50" />}
                    I have no time
                  </motion.button>

                  <motion.button
                    id="overthinking-mode-button"
                    onClick={handleOverthinkingClarity}
                    disabled={isLoadingOverthinking}
                    whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                    className="flex items-center justify-center gap-2 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-500 px-4 py-2.5 rounded-full text-[10px] md:text-xs font-medium border border-zinc-200 dark:border-zinc-800 border-dotted hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {isLoadingOverthinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 opacity-50" />}
                    I keep overthinking
                  </motion.button>
                </div>
              </div>
            ) : isPlanningMode ? (
                <button
                  id="plan-action-button"
                  onClick={handlePlanMyDay}
                  disabled={isLoadingPlan || !problem.trim()}
                  className="group flex-1 max-w-sm relative flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black px-10 py-5 rounded-full text-xl font-medium hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-none cursor-pointer"
                >
                  {isLoadingPlan ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Plan my day
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    </>
                  )}
                </button>
            ) : isCookingMode ? (
                <button
                  id="cook-action-button"
                  onClick={handleCookingClarity}
                  disabled={isLoadingCook || !problem.trim()}
                  className="group flex-1 max-w-sm relative flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black px-10 py-5 rounded-full text-xl font-medium hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-none cursor-pointer"
                >
                  {isLoadingCook ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Decide meal
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
            ) : (
                <button
                  id="study-action-button"
                  onClick={handleStudyClarity}
                  disabled={isLoadingStudy || !problem.trim()}
                  className="group flex-1 max-w-sm relative flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black px-10 py-5 rounded-full text-xl font-medium hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-none cursor-pointer"
                >
                  {isLoadingStudy ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Make study plan
                      <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </button>
            )}

            {(suggestion || problem || error) && (
              <button
                onClick={() => setIsResetConfirmOpen(true)}
                className="w-full md:w-auto text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center justify-center gap-2 text-sm font-medium py-3 px-8 rounded-full"
              >
                <RefreshCw className="w-4 h-4" />
                Start over
              </button>
            )}
          </div>

          {isNonHome && (
            <div className="flex flex-col items-center gap-4 mt-12 pb-12">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={reset}
                whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                className="text-[12px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Home
              </motion.button>
              <p className="text-[10px] text-zinc-500 opacity-60">You can also use the back button at top left</p>
            </div>
          )}
        </main>

        <AnimatePresence mode="wait">
          {isAnyLoading && !suggestion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-xl mx-auto flex flex-col items-center justify-center py-20 px-6 bg-app-card/30 rounded-[40px] border border-app-border/50 border-dashed"
            >
              <div className="relative w-16 h-16 mb-8">
                <motion.div 
                  className="absolute inset-0 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                />
                <motion.div 
                  className="absolute inset-0 border-2 border-t-zinc-900 dark:border-t-white border-transparent rounded-2xl"
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-zinc-400 animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-4 text-center">
                <motion.h3 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-sm md:text-base font-black uppercase tracking-[0.3em] text-app-text"
                >
                  Finding Clarity
                </motion.h3>
                <p className="text-xs text-zinc-500 font-medium max-w-[200px] leading-relaxed">
                  {isCookingMode ? "Analyzing ingredients and possibilities..." :
                   isStudyMode ? "Structuring your knowledge sanctuary..." :
                   isPlanningMode ? "Optimizing your daily flow..." :
                   "Distilling your thoughts into actionable steps..."}
                </p>
              </div>

              <div className="flex gap-2 mt-8">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [0, -4, 0],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1, 
                      delay: i * 0.2 
                    }}
                    className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {(suggestion || error) && (
              <motion.section
                key={suggestion || error}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`w-full p-6 md:p-10 rounded-[32px] ${
                  error ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30" : "bg-app-card border-app-border"
                } border shadow-2xl dark:shadow-none space-y-4 overflow-hidden`}
              >
              <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-widest text-[10px] font-bold">
                <div className="w-1 h-1 bg-zinc-400 dark:bg-zinc-500 rounded-full" />
                The Next Steps
              </div>
              <div className="text-lg md:text-2xl font-light leading-relaxed text-left markdown-body prose prose-zinc dark:prose-invert max-w-none">
                {error ? (
                  <p>{error}</p>
                ) : (
                  <>
                    {initialSteps.length > 0 ? (
                      <>
                        <p className="text-lg md:text-2xl font-semibold mb-6 md:mb-8 text-app-text tracking-tight">{intro}</p>
                        
                        <div className="space-y-4">
                          {initialSteps.map((step, i) => {
                            const isFirst = i === 0;
                            const isCompleted = completedTaskIds.includes(step);
                            return (
                              <motion.div
                                key={`initial-${i}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className={`flex gap-3 md:gap-4 items-start p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all cursor-pointer ${
                                  isFirst && !isCompleted
                                    ? "bg-app-card border-app-border scale-[1.01] md:scale-[1.02] shadow-xl shadow-zinc-900/5"
                                    : isCompleted
                                      ? "bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/20 text-zinc-400 dark:text-zinc-500 scale-[0.98]"
                                      : "bg-app-card/50 border-app-border text-app-text hover:border-zinc-300 dark:hover:border-zinc-600"
                                }`}
                                onClick={() => toggleTask(step)}
                              >
                                <div className={`mt-1 w-5 h-5 md:w-6 md:h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                                  isCompleted
                                    ? "bg-green-600 border-green-600 text-white"
                                    : isFirst && !isCompleted
                                      ? "bg-app-text/5 border-app-border text-app-text"
                                      : "bg-app-bg border-app-border"
                                }`}>
                                  {isCompleted && <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                  {isFirst && !isCompleted && <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                                </div>
                                <div className="flex-1">
                                  {isFirst && !isCompleted && (
                                    <span className="block text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1 md:mb-2">
                                      Start here
                                    </span>
                                  )}
                                  <span className={`${isFirst && !isCompleted ? "text-lg md:text-2xl font-bold leading-tight" : "text-sm md:text-base font-medium opacity-80"}`}>
                                    {step}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}

                          {nextSteps.map((step, i) => (
                            <motion.div
                              key={`next-${i}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex gap-3 md:gap-4 items-start p-4 rounded-2xl border transition-all cursor-pointer ${
                                completedTaskIds.includes(step)
                                  ? "bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/20 text-zinc-400 dark:text-zinc-500 scale-[0.98]"
                                  : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600"
                                }`}
                                onClick={() => toggleTask(step)}
                              >
                                <div className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                  completedTaskIds.includes(step)
                                    ? "bg-green-600 border-green-600 text-white"
                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                                }`}>
                                  {completedTaskIds.includes(step) && <Check className="w-3 h-3" />}
                                </div>
                                <span className="flex-1 text-sm md:text-base font-medium opacity-80">{step}</span>
                              </motion.div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="markdown-body text-base md:text-lg">
                          <ReactMarkdown>{suggestion || ""}</ReactMarkdown>
                        </div>
                      )}
                    
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-8">
                      <motion.button
                        onClick={handleComplete}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-semibold text-white bg-green-600 border border-green-700 px-5 py-3 rounded-full hover:bg-green-700 hover:scale-105 transition-all active:scale-95 shadow-lg shadow-green-900/10 dark:shadow-none"
                      >
                        I did this ✅
                      </motion.button>

                      <motion.button
                        onClick={handleNextStep}
                        disabled={isLoadingNext}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="flex-1 md:flex-none group flex items-center justify-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 px-5 py-3 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isLoadingNext ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400 dark:text-zinc-500" />
                        ) : (
                          <Plus className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                        )}
                        One More Step
                      </motion.button>

                      <motion.button
                        onClick={handleStuck}
                        disabled={isLoadingStuck}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-950/30 px-5 py-3 rounded-full hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isLoadingStuck ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Anchor className="w-4 h-4" />
                        )}
                        I feel stuck
                      </motion.button>
                    </div>

                    <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
                      <motion.button
                        onClick={reset}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 text-sm font-bold text-white bg-zinc-900 dark:bg-app-text dark:text-app-bg px-6 py-4 md:py-3 rounded-2xl hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-zinc-900/10"
                      >
                         I'm clear now ✨
                      </motion.button>
                      
                      <motion.button
                        onClick={() => {
                          const input = document.getElementById('problem-input');
                          if (input) {
                            input.focus();
                            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        whileTap={{ scale: 0.95, transition: { duration: 0.12 } }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-6 py-4 md:py-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Talk more
                      </motion.button>

                      <button
                        onClick={handleContinue}
                        disabled={isLoadingFollowUp}
                        className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
                      >
                        {isLoadingFollowUp ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <Sparkles className="w-4 h-4" />}
                        Ask me something
                      </button>

                      <div className="hidden md:block flex-1" />

                      <button
                        onClick={handleThisDidntHelp}
                        disabled={isLoadingDifferent}
                        className="text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors opacity-60 hover:opacity-100"
                      >
                        Not helpful
                      </button>
                    </div>

                    <AnimatePresence>
                      {followUpQuestion && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="mt-8 p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 relative overflow-hidden group shadow-sm"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-black dark:bg-white opacity-20" />
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-4">
                            <HelpCircle className="w-3 h-3" />
                            Question for you
                          </div>
                          <p className="text-xl font-medium leading-relaxed italic">{followUpQuestion}</p>
                          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-wide flex items-center gap-2">
                             Answer below or just keep original conversation.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {stuckTask && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 p-6 bg-orange-50/50 dark:bg-orange-950/10 rounded-2xl border border-orange-100 dark:border-orange-900/20 text-orange-900 dark:text-orange-200 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-orange-400 dark:text-orange-500">
                              <span className="w-1.5 h-1.5 bg-orange-400 dark:bg-orange-500 rounded-full animate-pulse" />
                              2-Minute Reset Task
                            </div>
                            <motion.button 
                              onClick={handleStuck}
                              disabled={isLoadingStuck}
                              whileTap={{ scale: 0.9 }}
                              className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 transition-colors"
                            >
                              <RefreshCw className={`w-3 h-3 ${isLoadingStuck ? "animate-spin" : ""}`} />
                              Try another
                            </motion.button>
                          </div>
                          <p className="text-lg font-medium">{stuckTask}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </motion.div>

      <div className="fixed bottom-8 text-zinc-600 dark:text-zinc-400 text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-4">
        <span>Clarity AI</span>
        <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
        <span>V 3.1</span>
      </div>
    </motion.div>
  );
}


"use client";

import { useState, useEffect } from "react";
import { LEVELS } from "@/lib/levels";
import { supabase } from "@/lib/supabase";

export type Stats = {
  Health: number;
  Agility: number;
  Strength: number;
  Intellect: number;
  Creativity: number;
  Accuracy: number;
};

type TaskLog = {
  text: string;
  date: string;
  count: number;
};

type Level = {
  id: number;
  name: string;
  requirements: Partial<Stats>;
  completed: boolean;
};

export default function Home() {
  const [gold, setGold] = useState(0);
  const [taskText, setTaskText] = useState("");
  const [timeSpent, setTimeSpent] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats>({
    Health: 1,
    Agility: 1,
    Strength: 1,
    Intellect: 1,
    Creativity: 1,
    Accuracy: 1,
  });

  const [unspentPoints, setUnspentPoints] = useState(0);
  const [eligibleStats, setEligibleStats] = useState<(keyof Stats)[]>([]);
  const [showStatModal, setShowStatModal] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [levels, setLevels] = useState<Level[]>(LEVELS);
  const [showAnimalUnlock, setShowAnimalUnlock] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    { id: string; username: string; points: number }[]
  >([]);
  const [username, setUsername] = useState<string | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [showChestModal, setShowChestModal] = useState(false);
  const [chestResult, setChestResult] = useState<{
    rarity: "Common" | "Rare" | "Epic";
    gold: number;
    stat?: keyof Stats;
    statAmount?: number;
  } | null>(null);
  const [chestPity, setChestPity] = useState(0);

  const [taskLog, setTaskLog] = useState<TaskLog[]>(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("bloomquest_tasks") || "[]");
  });

  /* ---------------- AUTH GUARD ---------------- */
  useEffect(() => {
  const initAuth = async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      window.location.href = "/login";
      return;
    }

    setUserId(data.session.user.id);
    setLoadingAuth(false);
  };

  initAuth();
}, []);


  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  /* ---------------- LOCAL SAVE ---------------- */
  const saveTaskLog = async (log: TaskLog[]) => {
  setTaskLog(log);

  if (!userId) return;

  await supabase
    .from("users")
    .update({ task_log: log })
    .eq("id", userId);
};

  const saveProgress = async (
  updatedStats: Stats,
  updatedGold: number,
  updatedLevels: Level[]
) => {
  if (!userId) return;

  await supabase
    .from("users")
    .update({
      stats: updatedStats,
      gold: updatedGold,
      levels: updatedLevels,
    })
    .eq("id", userId);
};


  useEffect(() => {
    if (!userId) return;

    const loadUserData = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("stats, gold, levels, task_log, username")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Failed to load user data:", error);
        return;
      }

      if (data.stats) setStats(data.stats);
      if (typeof data.gold === "number") setGold(data.gold);
      if (Array.isArray(data.levels) && data.levels.length)
      setLevels(data.levels);
      if (Array.isArray(data.task_log)) setTaskLog(data.task_log);
      if (data.username) {
        setUsername(data.username);
      } else {
        setShowUsernameModal(true);
      }
    };

    loadUserData();
  }, [userId]);

  const saveUsername = async () => {
    if (!userId || !usernameInput.trim()) return;

    await supabase
      .from("users")
      .update({ username: usernameInput.trim() })
      .eq("id", userId);

    setUsername(usernameInput.trim());
    setShowUsernameModal(false);
  };


  /* ---------------- CONFIDENCE WEIGHTING ---------------- */
  const applyConfidenceWeighting = (
    basePoints: number,
    taskText: string
  ) => {
    const totalCount = taskLog
      .filter((t) => t.text === taskText)
      .reduce((sum, t) => sum + t.count, 0);

    if (totalCount >= 6) return Math.max(1, basePoints - 1);
    if (totalCount >= 12) return Math.max(1, basePoints - 2);

    return basePoints;
  };

  /* ---------------- GAME LOGIC ---------------- */
  const canBeatLevel = (level: Level) =>
    Object.entries(level.requirements).every(
      ([stat, value]) => stats[stat as keyof Stats] >= value
    );

    const getCurrentPoints = () => {
      return (
        stats.Health * 1.2 +
        stats.Agility * 1.4 +
        stats.Strength * 1.3 +
        stats.Intellect * 1.6 +
        stats.Creativity * 1.5 +
        stats.Accuracy * 1.4
      );
    };

  const beatLevel = (levelId: number) => {
    const updatedLevels = levels.map((lvl) =>
      lvl.id === levelId ? { ...lvl, completed: true } : lvl
    );

    const updatedGold = gold + 50;

    setLevels(updatedLevels);
    setGold(updatedGold);
    saveProgress(stats, updatedGold, updatedLevels);
    const currentPoints = getCurrentPoints();
    rollChest(levelId,currentPoints);
    if (levelId % 5 === 0) setShowAnimalUnlock(true);
    
  };

  const handleSubmitTask = async () => {
    if (!taskText || timeSpent <= 0 || isEvaluating) return;

    setIsEvaluating(true);

    const res = await fetch("/api/analyze-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskText, timeSpent }),
    });

    const data = await res.json();
    setIsEvaluating(false);

    if (!data.points || !data.eligibleStats) return;

    const weightedPoints = applyConfidenceWeighting(
      data.points,
      taskText
    );

    const today = new Date().toISOString().slice(0, 10);
    const existing = taskLog.find(
      (t) => t.text === taskText && t.date === today
    );

    const updatedLog = existing
      ? taskLog.map((t) =>
          t === existing ? { ...t, count: t.count + 1 } : t
        )
      : [...taskLog, { text: taskText, date: today, count: 1 }];

    saveTaskLog(updatedLog);

    const updatedGold = gold + weightedPoints * 10;
    setGold(updatedGold);
    saveProgress(stats, updatedGold, levels);

    setUnspentPoints(weightedPoints);
    setEligibleStats(data.eligibleStats);
    setShowStatModal(true);
    setTaskText("");
    setTimeSpent(0);
  };

  const investPoint = (stat: keyof Stats) => {
    if (unspentPoints <= 0) return;

    const updatedStats = { ...stats, [stat]: stats[stat] + 1 };
    setStats(updatedStats);
    setUnspentPoints((p) => p - 1);
    saveProgress(updatedStats, gold, levels);
  };

  /* ---------------- JOURNAL GROUPING ---------------- */
  const groupedJournal = taskLog.reduce<Record<string, TaskLog[]>>(
    (acc, task) => {
      if (!acc[task.date]) acc[task.date] = [];
      acc[task.date].push(task);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(groupedJournal).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const calculatePointsFromStats = (stats: Stats) => {
    return (
      stats.Health * 1.2 +
      stats.Agility * 1.4 +
      stats.Strength * 1.3 +
      stats.Intellect * 1.6 +
      stats.Creativity * 1.5 +
      stats.Accuracy * 1.4
    );
  };

  const loadLeaderboard = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, stats")

    if (error) {
      console.error("Failed to load leaderboard:", error);
      return;
    }

    const ranked = data
      .map((user) => ({
         id: user.id,
         username: user.username || "Unknown",
         points: calculatePointsFromStats(user.stats || {}),
      }))
      .sort((a, b) => b.points - a.points);

    setLeaderboard(ranked);
  };

  const rollChance = (percent: number) => {
    return Math.random() * 100 < percent;
  };

  const randomStat = (): keyof Stats => {
    const keys: (keyof Stats)[] = [
      "Health",
      "Agility",
      "Strength",
      "Intellect",
      "Creativity",
      "Accuracy",
    ];
    return keys[Math.floor(Math.random() * keys.length)];
  };

const rollChest = (levelId: number, currentPoints: number) => {
  /*
    DROP CHANCE DESIGN:
    - Level gives slow linear growth
    - Points give diminishing returns
    - Pity guarantees fairness
  */

  // --- BASE CHANCE (map progression) ---
  let dropChance = 12 + levelId * 1.5; // slow growth

  // --- POWER SCALING (soft cap) ---
  // logarithmic-ish scaling via sqrt
  dropChance += Math.sqrt(currentPoints) * 1.2;

  // --- PITY SYSTEM ---
  // every failed level adds +5%
  dropChance += chestPity * 5;

  // --- HARD CAPS ---
  dropChance = Math.min(dropChance, 55); // never guaranteed

  // --- ROLL ---
  if (!rollChance(dropChance)) {
    setChestPity((p) => p + 1);
    return;
  }

  // 🎉 CHEST DROPPED → reset pity
  setChestPity(0);

  // --- RARITY ROLL (unchanged core logic) ---
  const roll = Math.random();
  let rarity: "Common" | "Rare" | "Epic" = "Common";

  if (roll > 0.92) rarity = "Epic";
  else if (roll > 0.68) rarity = "Rare";

  let gold = 0;
  let stat: keyof Stats | undefined;
  let statAmount = 0;

  if (rarity === "Common") {
    gold = 20 + Math.floor(Math.random() * 20);
  }

  if (rarity === "Rare") {
    gold = 50 + Math.floor(Math.random() * 30);
    stat = randomStat();
    statAmount = 1;
  }

  if (rarity === "Epic") {
    gold = 100 + Math.floor(Math.random() * 50);
    stat = randomStat();
    statAmount = 2;
  }

  const result = { rarity, gold, stat, statAmount };

  applyChestReward(result);
  setChestResult(result);
  setShowChestModal(true);
};


  const applyChestReward = (reward: {
    rarity: "Common" | "Rare" | "Epic";
    gold: number;
    stat?: keyof Stats;
    statAmount?: number;
  }) => {
    let updatedStats = { ...stats };
    let updatedGold = gold + reward.gold;

    if (reward.stat && reward.statAmount) {
      updatedStats[reward.stat] += reward.statAmount;
    }

    setStats(updatedStats);
    setGold(updatedGold);
    saveProgress(updatedStats, updatedGold, levels);
  };

  const NODE_POSITIONS: Record<number, { x: number; y: number }> = {
    1: { x: 50, y: 70 },
    2: { x: 120, y: 120 },
    3: { x: 200, y: 90 },
    4: { x: 260, y: 160 },
    5: { x: 180, y: 220 },
    6: { x: 100, y: 200 },
    7: { x: 150, y: 280 },
  };





  /* ---------------- LOADING ---------------- */
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl">
        🌱 Loading BloomQuest...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-emerald-50 flex flex-col items-center p-6 gap-6">
      <h1 className="text-4xl font-bold">🌱 BloomQuest</h1>

      <div className="absolute top-6 right-6 flex gap-3">
        <button
          onClick={() => setShowJournal(true)}
          className="text-2xl cursor-pointer hover:scale-110 active:scale-95 transition"
        >
          📖
        </button>
        <button
          onClick={() => {
            loadLeaderboard();
            setShowLeaderboard(true);
          }}
          className="text-xl cursor-pointer hover:scale-110 active:scale-95 transition"
        >
          🏆
        </button>
        <button
          onClick={logout}
          className="text-sm bg-red-500 text-white px-3 py-1 rounded-lg cursor-pointer hover:bg-red-600 active:scale-95 transition"
        >
          Logout
        </button>
      </div>

      {isEvaluating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl text-center space-y-3 animate-pulse">
            <div className="text-3xl">🧠✨</div>
            <p className="font-semibold">Evaluating your task...</p>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="bg-white rounded-xl shadow p-4 w-full max-w-sm space-y-1">
        <p>💰 Gold: {gold}</p>
        {Object.entries(stats).map(([k, v]) => (
          <p key={k}>
            {k}: {v}
          </p>
        ))}
      </div>

      {/* LEVEL MAP */}
      {/* WORLD MAP */}
      <div className="bg-white rounded-xl shadow p-4 w-full max-w-sm">
        <h2 className="font-semibold mb-3">🌍 World Map</h2>

        <div
         className="relative w-full h-[360px] rounded-lg overflow-hidden border"
         style={{
          backgroundImage: "url(/forest-map.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        >
        {levels.map((level) => {
          const unlocked = canBeatLevel(level);
          const completed = level.completed;
          const pos = NODE_POSITIONS[level.id];

          if (!pos) return null;

          return (
            <div
              key={level.id}
              className="absolute group"
              style={{
                left: pos.x,
                top: pos.y,
              }}
            >
           {/* NODE */}
           <button
            onClick={() => unlocked && !completed && beatLevel(level.id)}
            className={`
              w-12 h-12 rounded-full flex items-center justify-center
              border-2 transition-all duration-200
              ${
                completed
                  ? "bg-emerald-500 border-emerald-600 text-white"
                  : unlocked
                  ? "bg-white border-emerald-500 hover:scale-110"
                  : "bg-gray-300 border-gray-400 opacity-60 cursor-not-allowed"
              }
            `}
           >
            {completed ? "✓" : level.id}
           </button>

          {/* TOOLTIP */}
          <div
            className="
              absolute left-1/2 -translate-x-1/2 bottom-full mb-2
              w-max max-w-[200px]
              bg-black text-white text-xs rounded-lg px-3 py-2
              opacity-0 group-hover:opacity-100
              pointer-events-none transition
              z-20
            "
          >
            <p className="font-semibold mb-1">{level.name}</p>
            <p className="opacity-80">
              Requires:{" "}
              {Object.entries(level.requirements)
                .map(([k, v]) => `${k} ${v}`)
                .join(", ")}
            </p>
            {!unlocked && <p className="text-red-300 mt-1">Locked</p>}
            {completed && <p className="text-emerald-300 mt-1">Completed</p>}
          </div>
        </div>
      );
    })}
  </div>
      </div>

      {/* TASK INPUT */}
      <div className="bg-white rounded-xl shadow p-4 w-full max-w-sm flex flex-col gap-3">
        <input
          className="border rounded p-2"
          placeholder="What did you do?"
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
        />
        <input
          type="number"
          className="border rounded p-2"
          placeholder="Minutes spent"
          value={timeSpent || ""}
          onChange={(e) => setTimeSpent(Number(e.target.value))}
        />
        <button
          onClick={handleSubmitTask}
          disabled={isEvaluating}
          className="bg-emerald-500 text-white py-2 rounded-xl cursor-pointer hover:bg-emerald-600 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Submit Task
        </button>
      </div>

      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 text-center">
            <h2 className="text-xl font-bold">Choose your name 🌱</h2>

            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Your adventurer name"
              className="border rounded p-2 w-full"
            />
            <button
              onClick={saveUsername}
              className="w-full bg-emerald-500 text-white py-2 rounded-xl cursor-pointer hover:bg-emerald-600 active:scale-95 transition"
            >
              Confirm
            </button>
          </div>
        </div>
      )}


      {/* STAT MODAL */}
      {showStatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80 text-center space-y-4">
            <h2 className="text-xl font-bold">✨ Level Up!</h2>

            <p className="text-sm text-gray-600">
              You have <strong>{unspentPoints}</strong> stat point
              {unspentPoints !== 1 && "s"} remaining
            </p>

            {eligibleStats.map((stat) => (
              <button
                key={stat}
                disabled={unspentPoints <= 0}
                onClick={() => investPoint(stat)}
                className="w-full bg-emerald-100 hover:bg-emerald-200 cursor-pointer active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 rounded-lg py-2"
              >
                +1 {stat}
              </button>
            ))}

            {unspentPoints === 0 && (
              <button
                onClick={() => setShowStatModal(false)}
                className="bg-emerald-500 text-white w-full py-2 rounded-xl cursor-pointer hover:bg-emerald-600 active:scale-95 transition"
              >
                Confirm
              </button>
            )}
          </div>
        </div>
      )}

      {/* JOURNAL MODAL */}
      {showJournal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[26rem] max-h-[75vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold text-center">📖 Bloom Journal</h2>

            {taskLog.length === 0 && (
              <p className="text-center text-gray-500">
                No memories yet. Start blooming 🌱
              </p>
            )}

            {sortedDates.map((date) => (
              <div key={date} className="border rounded-lg p-3">
                <p className="font-semibold text-emerald-600 mb-2">
                  {new Date(date).toDateString()}
                </p>

                {groupedJournal[date].map((task, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-sm py-1"
                  >
                    <span className="font-medium">{task.text}</span>
                    <span className="text-gray-500">×{task.count}</span>
                  </div>
                ))}
              </div>
            ))}

            <button
              onClick={() => setShowJournal(false)}
              className="w-full bg-emerald-500 text-white py-2 rounded-xl hover:bg-emerald-600"
            >
              Close Journal
            </button>
          </div>
        </div>
      )}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[24rem] max-h-[70vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold text-center">🏆 Leaderboard</h2>

              {leaderboard.length === 0 && (
                <p className="text-center text-gray-500">
                  No adventurers yet 🌱
                </p>
              )}

            {leaderboard.map((user, idx) => (
            <div
              key={idx}
              className={`flex justify-between items-center border-b py-2 text-sm transition-all duration-300 ${user.id === userId ? "bg-emerald-100 font-bold rounded px-2 scale-[1.02]" : ""}`}
            >
              <span className="font-medium">
                #{idx + 1} {user.username}
              </span>
              <span className="font-semibold text-emerald-600">
                {Math.round(user.points)} pts
              </span>
            </div>
            ))}

            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full bg-emerald-500 text-white py-2 rounded-xl cursor-pointer hover:bg-emerald-600 active:scale-95 transition"
            >
              Close Leaderboard
            </button>
          </div>
        </div>
      )}
      {showChestModal && chestResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 text-center space-y-4 animate-scale-in">
            <h2 className="text-2xl font-bold">
              🎁 {chestResult.rarity} Chest!
            </h2>

            <p className="text-lg">💰 +{chestResult.gold} Gold</p>

            {chestResult.stat && (
              <p className="text-lg">
                📈 +{chestResult.statAmount} {chestResult.stat}
              </p>
            )}

            <button
              onClick={() => setShowChestModal(false)}
              className="w-full bg-emerald-500 text-white py-2 rounded-xl cursor-pointer hover:bg-emerald-600 active:scale-95 transition"
            >
              Collect
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

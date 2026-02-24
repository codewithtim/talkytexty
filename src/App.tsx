import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { OverlayPage } from "./pages/overlay";
import { PickerPage } from "./pages/picker";
import { useRecording } from "./hooks/use-recording";
import { Sidebar } from "./components/sidebar";
import { GeneralPanel } from "./components/panels/general-panel";
import { ModelsPanel } from "./components/panels/models-panel";
import { HotkeysPanel } from "./components/panels/hotkeys-panel";
import { AboutPanel } from "./components/panels/about-panel";
import type { SettingsSection } from "./types";

const ROUTE_TO_SECTION: Record<string, SettingsSection> = {
  "/": "general",
  "/models": "models",
  "/hotkeys": "hotkeys",
};

const PANELS: Record<SettingsSection, React.ReactNode> = {
  general: <GeneralPanel />,
  models: <ModelsPanel />,
  hotkeys: <HotkeysPanel />,
  about: <AboutPanel />,
};

function NotTauriFallback() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Text to Code</h1>
        <p className="text-gray-500 dark:text-gray-400">
          This app must be run inside Tauri. Start it with{" "}
          <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">pnpm tauri dev</code>
        </p>
      </div>
    </main>
  );
}

/** Mounts useRecording for its hotkey side-effects without causing parent re-renders. */
function RecordingListener() {
  useRecording();
  return null;
}

function MainWindow() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  // Listen for tray navigation events and map routes to sections
  useEffect(() => {
    const unlistenNav = listen<string>("navigate", (event) => {
      const section = ROUTE_TO_SECTION[event.payload];
      if (section) {
        setActiveSection(section);
      }
    });

    // Listen for target-selector hotkey — switch to General panel where the toggle lives
    const unlistenTarget = listen("hotkey-open-target-selector", () => {
      setActiveSection("general");
    });

    return () => {
      void unlistenNav.then((f) => f());
      void unlistenTarget.then((f) => f());
    };
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-[#1e1e1e]">
      <RecordingListener />
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="flex-1 overflow-y-auto p-8">
        {PANELS[activeSection]}
      </main>
    </div>
  );
}

function App() {
  if (!isTauri()) {
    return <NotTauriFallback />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayPage />} />
        <Route path="/picker" element={<PickerPage />} />
        <Route path="/*" element={<MainWindow />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

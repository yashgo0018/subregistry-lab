import { Agentation } from "agentation";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import LabPage from "./pages/LabPage";
import { LabProvider } from "./state/LabContext";

/**
 * Root app. Single page: the subregistry lab wizard.
 * Agentation toolbar (dev only) for visual annotations synced to the agent via MCP.
 */
function App() {
  return (
    <div className="min-h-screen w-screen">
      <LabProvider>
        <Routes>
          <Route path="/" element={<LabPage />} />
        </Routes>
      </LabProvider>
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

export default App;

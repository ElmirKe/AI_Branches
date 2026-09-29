import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { StartScreen } from "./components/StartScreen";
import { TreeCanvas } from "./components/TreeCanvas";
import { BranchPanel } from "./components/BranchPanel";

export default function App() {
  const { state, currentTree } = useStore();
  const empty = currentTree.messages.length === 0;
  return (
    <div className={`app theme-${state.theme}`}>
      <Sidebar />
      <main className="canvas-area">{empty ? <StartScreen /> : <TreeCanvas />}</main>
      {!empty && state.selectedId && <BranchPanel />}
    </div>
  );
}

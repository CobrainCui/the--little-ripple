import Background from "@/components/ui/Background";
import DebugPanel from "@/components/ui/DebugPanel";
import InteractiveLayer from "@/components/ui/InteractiveLayer";
import ThoughtInput from "@/components/ui/ThoughtInput";
import Uploader from "@/components/ui/Uploader";
import WeatherEngine from "@/components/visuals/WeatherEngine";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Background />
      <WeatherEngine />
      <Uploader />
      <ThoughtInput />
      <InteractiveLayer />
      <DebugPanel />
    </main>
  );
}

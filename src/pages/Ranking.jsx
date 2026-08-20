import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import RankingPanel from "@/components/shared/RankingPanel";

export default function Ranking() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>
      <RankingPanel />
    </div>
  );
}
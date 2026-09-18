import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export const TryTreButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate('/demo-chat')}
      className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
      size="lg"
    >
      <Sparkles className="w-5 h-5 mr-2" />
      Tre'yi Dene
    </Button>
  );
};

export default TryTreButton;

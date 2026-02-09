import aiLogo from '@/assets/ai-logo.jpg';

export const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-glow mb-4 sm:mb-6">
        <img src={aiLogo} alt="TreFriend AI" className="w-full h-full object-cover" />
      </div>
      
      <h2 className="text-xl sm:text-2xl font-bold text-foreground text-glow mb-2 sm:mb-3">
        TreFriend
      </h2>
      
      <p className="text-sm sm:text-base text-muted-foreground max-w-md">
        Bir şey yazın, ben buradayım.
      </p>
    </div>
  );
};

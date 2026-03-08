import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/store/theme';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors',
        'dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
        className,
      )}
    >
      {theme === 'light' ? (
        <>
          <Moon className="h-4 w-4" />
          Dark mode
        </>
      ) : (
        <>
          <Sun className="h-4 w-4" />
          Light mode
        </>
      )}
    </button>
  );
}

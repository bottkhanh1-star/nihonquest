"use client";

import { SessionProvider } from "next-auth/react";
import { SoundAndThemeProvider } from "./SoundAndThemeContext";
import { UserProgressProvider } from "./UserProgressContext";
import { LanguageProvider } from "./LanguageContext";
import { AiScreenProvider } from "./ai-sensei/AiScreenContext";
import { KawaiiSenseiBubble } from "./ai-sensei/KawaiiSenseiBubble";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SoundAndThemeProvider>
          <UserProgressProvider>
            <AiScreenProvider>
              {children}
              <KawaiiSenseiBubble />
            </AiScreenProvider>
          </UserProgressProvider>
        </SoundAndThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}

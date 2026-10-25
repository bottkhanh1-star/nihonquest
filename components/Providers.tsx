"use client";

import { SessionProvider } from "next-auth/react";
import { SoundAndThemeProvider } from "./SoundAndThemeContext";
import { UserProgressProvider } from "./UserProgressContext";
import { LanguageProvider } from "./LanguageContext";
import { SeasonProvider } from "./SeasonContext";
import { AiScreenProvider } from "./ai-sensei/AiScreenContext";
import { KawaiiSenseiBubble } from "./ai-sensei/KawaiiSenseiBubble";
import { GlobalCallProvider } from "./social/GlobalCallContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SoundAndThemeProvider>
          <SeasonProvider>
            <UserProgressProvider>
              <GlobalCallProvider>
                <AiScreenProvider>
                  {children}
                  <KawaiiSenseiBubble />
                </AiScreenProvider>
              </GlobalCallProvider>
            </UserProgressProvider>
          </SeasonProvider>
        </SoundAndThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}

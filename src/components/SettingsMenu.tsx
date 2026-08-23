import React from "react";
import {
  Moon,
  Sun,
  Languages,
  Settings,
  Check,
  MessageSquareQuote,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import { useLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n";

interface SettingsMenuProps {
  onOpenFeedback?: () => void;
  onOpenAdminFeedback?: () => void;
}

export function SettingsMenu({ onOpenFeedback, onOpenAdminFeedback }: SettingsMenuProps) {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="btn-open-settings"
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs font-medium border-border/80 bg-card text-foreground hover:bg-accent/50 shadow-xs"
          title={t("settings")}
          aria-label={t("settings")}
        >
          <Settings className="h-4 w-4 text-muted-foreground transition-transform group-hover:rotate-45" />
          <span className="hidden sm:inline">{t("settings")}</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground border-l border-border pl-1.5 ml-0.5">
            {theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              {language.toUpperCase()}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 p-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
      >
        {/* Theme Section */}
        <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Sun className="h-3.5 w-3.5 text-primary" />
          <span>{t("theme")}</span>
        </DropdownMenuLabel>

        <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/50 rounded-lg border border-border/50">
          <button
            type="button"
            id="btn-theme-light"
            onClick={() => setTheme("light")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              theme === "light"
                ? "bg-card text-foreground shadow-xs font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>{t("lightMode")}</span>
          </button>

          <button
            type="button"
            id="btn-theme-dark"
            onClick={() => setTheme("dark")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              theme === "dark"
                ? "bg-card text-foreground shadow-xs font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Moon className="h-3.5 w-3.5 text-blue-400" />
            <span>{t("darkMode")}</span>
          </button>
        </div>

        <DropdownMenuSeparator className="my-2" />

        {/* Language Section */}
        <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Languages className="h-3.5 w-3.5 text-primary" />
          <span>{t("language")}</span>
        </DropdownMenuLabel>

        <DropdownMenuGroup className="space-y-0.5">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <DropdownMenuItem
                key={lang.code}
                id={`btn-lang-${lang.code}`}
                onClick={() => setLanguage(lang.code)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{lang.flag}</span>
                  <div className="flex flex-col">
                    <span className="leading-tight">{lang.nativeLabel}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {lang.label}
                    </span>
                  </div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {onOpenFeedback && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              id="btn-settings-open-feedback"
              onClick={onOpenFeedback}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors font-medium"
            >
              <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
              <span>💬 {t("feedbackBtn")}</span>
            </DropdownMenuItem>
          </>
        )}

        {onOpenAdminFeedback && (
          <DropdownMenuItem
            id="btn-settings-open-admin-feedback"
            onClick={onOpenAdminFeedback}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors font-medium"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>🔒 {t("adminPortal")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

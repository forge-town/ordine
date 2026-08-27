import { useNavigate } from "@tanstack/react-router";
import { useStore } from "zustand";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppSidebar as SharedAppSidebar } from "@repo/views/AppSidebar";
import { useSidebarStore } from "@repo/views/store/sidebarStore";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Button } from "@repo/ui/button";
import { SidebarMenu, SidebarMenuItem } from "@repo/ui/sidebar";
import { useSession, signOut } from "@/integrations/better-auth-client";
import { HOME_PIPELINE_AGENT_SESSION_KEY } from "@repo/views/PipelineCreationWorkspace";

const WebUserFooter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut();
    await navigate({ to: "/login" });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent"
            render={<Button type="button" variant="ghost" />}
          >
            <Avatar size="sm">
              {session?.user?.image && (
                <AvatarImage alt={session.user.name ?? ""} src={session.user.image} />
              )}
              <AvatarFallback>{session?.user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden group-data-[state=collapsed]/sidebar:hidden">
              <span className="truncate text-xs font-medium">{session?.user?.name ?? "User"}</span>
              <span className="truncate text-[10px] text-foreground/70">
                {session?.user?.email ?? ""}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[state=collapsed]/sidebar:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" side="top">
            <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("nav.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export const AppSidebar = () => {
  const navigate = useNavigate();
  const store = useSidebarStore();
  const handleNewPipelineWorkspaceReset = useStore(
    store,
    (state) => state.handleNewPipelineWorkspaceReset,
  );
  const handleNewPipeline = () => {
    globalThis.window?.localStorage.removeItem(HOME_PIPELINE_AGENT_SESSION_KEY);
    handleNewPipelineWorkspaceReset();
    void navigate({ to: "/" });
  };

  return <SharedAppSidebar footer={<WebUserFooter />} onNewPipeline={handleNewPipeline} />;
};

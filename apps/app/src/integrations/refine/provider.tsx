import { Refine } from "@refinedev/core";
import { type FC, type PropsWithChildren } from "react";
import { PlatformProvider } from "@repo/views/platform";
import { AuthProvider } from "@repo/views/auth";
import { dataProvider } from "./dataProvider";
import { notificationProvider } from "./notificationProvider";
import { webPlatform } from "../platform";
import { webAuth } from "../auth";

export const RefineProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Refine dataProvider={dataProvider} notificationProvider={notificationProvider}>
      <PlatformProvider value={webPlatform}>
        <AuthProvider value={webAuth}>{children}</AuthProvider>
      </PlatformProvider>
    </Refine>
  );
};
